import { WINDOW_LIMIT, WINDOW_MS } from './limits.js'
import quotes from './quotes.json' with { type: 'json' }

const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search'

// 枠を1回分確保します。1回目のリクエストから1分以上経っていれば枠を作り直します。
// 同時にリクエストが来ても上限を超えないよう、確認と加算を1つの SQL でアトミックに行います。
// 上限に達していれば更新されず、行は返りません。
const RESERVE_SQL = `
  INSERT INTO api_window (id, started_at, request_count) VALUES (1, ?, 1)
  ON CONFLICT (id) DO UPDATE SET
    started_at = CASE WHEN excluded.started_at - started_at >= ${WINDOW_MS} THEN excluded.started_at ELSE started_at END,
    request_count = CASE WHEN excluded.started_at - started_at >= ${WINDOW_MS} THEN 1 ELSE request_count + 1 END
  WHERE request_count < ${WINDOW_LIMIT} OR excluded.started_at - started_at >= ${WINDOW_MS}
  RETURNING started_at, request_count`

// 現在の枠のキャッシュからランダムに1件選びます。前回表示した画像は、ほかに候補がない場合だけ選びます。
const PICK_CACHED_SQL = `
  SELECT c.image_id, c.image_url, c.quote_id, c.quote_text, c.author, c.profile, w.started_at
  FROM api_window w LEFT JOIN cat_cache c ON c.window_started_at = w.started_at
  WHERE w.id = 1
  ORDER BY c.image_id = ?, RANDOM()
  LIMIT 1`

const json = (body, init) =>
  Response.json(body, { ...init, headers: { 'Cache-Control': 'no-store', ...init?.headers } })

const pick = (items) => items[Math.floor(Math.random() * items.length)]

const toPayload = (row, cached) => ({
  image: { id: row.image_id, url: row.image_url },
  quote: { id: row.quote_id, text: row.quote_text, author: row.author, profile: row.profile },
  cached,
})

async function fetchCatImage(apiKey) {
  const response = await fetch(CAT_API_URL, { headers: { 'x-api-key': apiKey } })
  if (!response.ok) throw new Error(`TheCatAPI responded ${response.status}`)
  const [image] = await response.json()
  if (!image?.id || !image?.url) throw new Error('TheCatAPI returned no image')
  return image
}

async function serveFromCache(env, previousImageId, now) {
  const row = await env.DB.prepare(PICK_CACHED_SQL).bind(previousImageId).first()
  if (row?.image_id) return json(toPayload(row, true))

  // 枠内の取得がまだ終わっていない・失敗したなどでキャッシュが空なら、枠が空くまで待ってもらいます。
  const retryAfter = row ? Math.max(1, Math.ceil((row.started_at + WINDOW_MS - now) / 1000)) : 1
  return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': String(retryAfter) } })
}

async function handleCat(url, env) {
  const previousImageId = url.searchParams.get('previousImage') ?? ''
  const previousQuoteId = Number(url.searchParams.get('previousQuote'))
  const now = Date.now()

  const reserved = await env.DB.prepare(RESERVE_SQL).bind(now).first()
  if (!reserved) return serveFromCache(env, previousImageId, now)

  if (reserved.request_count === 1) {
    // 新しい枠の1回目なので、前の枠のキャッシュを消します。
    await env.DB.prepare('DELETE FROM cat_cache WHERE window_started_at < ?').bind(reserved.started_at).run()
  }

  let image
  try {
    image = await fetchCatImage(env.THECATAPI_KEY)
  } catch {
    return new Response('TheCatAPI request failed', { status: 502 })
  }

  const candidates = quotes.filter((quote) => quote.id !== previousQuoteId)
  const quote = pick(candidates.length > 0 ? candidates : quotes)
  const row = {
    image_id: image.id,
    image_url: image.url,
    quote_id: quote.id,
    quote_text: quote.text,
    author: quote.author,
    profile: quote.profile,
  }
  await env.DB.prepare(
    `INSERT INTO cat_cache (window_started_at, image_id, image_url, quote_id, quote_text, author, profile)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(reserved.started_at, row.image_id, row.image_url, row.quote_id, row.quote_text, row.author, row.profile)
    .run()

  return json(toPayload(row, false))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (url.pathname !== '/api/cat') return new Response('Not Found', { status: 404 })

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } })
    }

    // 同じIPからの連続アクセスで D1 やキャッシュを使い切られないよう、回数を制限します。
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: clientIp })
    if (!success) {
      return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60' } })
    }

    if (!env.THECATAPI_KEY) {
      return new Response('TheCatAPI key is not configured', { status: 503 })
    }

    return handleCat(url, env)
  },
}
