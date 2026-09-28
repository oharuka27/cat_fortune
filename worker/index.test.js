import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import worker from './index.js'
import { WINDOW_LIMIT, WINDOW_MS } from './limits.js'

const BASE_URL = 'https://cat-fortune.example'
const START = Date.UTC(2026, 8, 28, 12, 0, 0)
const MIGRATION = readFileSync(new URL('../migrations/0001_create_cat_cache.sql', import.meta.url), 'utf8')

// D1 の prepare().bind().first()/run() を、node:sqlite の実際の SQLite で再現します。
const createD1 = () => {
  const db = new DatabaseSync(':memory:')
  db.exec(MIGRATION)
  const statement = (sql, params = []) => ({
    bind: (...args) => statement(sql, args),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => {
      db.prepare(sql).run(...params)
      return { success: true }
    },
  })
  return { prepare: (sql) => statement(sql), sqlite: db }
}

const createEnv = ({ apiKey = 'test-key', allowed = true } = {}) => ({
  THECATAPI_KEY: apiKey,
  DB: createD1(),
  ASSETS: { fetch: mock.fn(async () => new Response('asset')) },
  RATE_LIMITER: { limit: mock.fn(async () => ({ success: allowed })) },
})

const request = (path, init) =>
  new Request(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'CF-Connecting-IP': '203.0.113.1', ...init?.headers },
  })

// 呼ばれるたびに別の画像を返す TheCatAPI のモック
const mockCatApi = () => {
  let count = 0
  return mock.method(globalThis, 'fetch', async () => {
    count += 1
    return Response.json([{ id: `cat${count}`, url: `https://cdn2.thecatapi.com/images/cat${count}.jpg` }])
  })
}

const getCat = async (env, previous) => {
  const params = previous ? `?previousImage=${previous.image.id}&previousQuote=${previous.quote.id}` : ''
  return worker.fetch(request(`/api/cat${params}`), env)
}

describe('worker', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: START })
  })

  afterEach(() => {
    mock.restoreAll()
    mock.timers.reset()
  })

  it('/api/ 以外は静的ファイルに渡す', async () => {
    const env = createEnv()
    const response = await worker.fetch(request('/about'), env)

    assert.equal(await response.text(), 'asset')
    assert.equal(env.ASSETS.fetch.mock.callCount(), 1)
  })

  it('未知の /api/* は 404 を返す', async () => {
    const env = createEnv()
    const response = await worker.fetch(request('/api/foo'), env)

    assert.equal(response.status, 404)
    assert.equal(env.ASSETS.fetch.mock.callCount(), 0)
  })

  it('GET 以外は 405 を返す', async () => {
    const response = await worker.fetch(request('/api/cat', { method: 'POST' }), createEnv())

    assert.equal(response.status, 405)
    assert.equal(response.headers.get('Allow'), 'GET')
  })

  it('IP ごとの回数制限を超えたら TheCatAPI を呼ばずに 429 を返す', async () => {
    const upstream = mockCatApi()
    const env = createEnv({ allowed: false })
    const response = await getCat(env)

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '60')
    assert.deepEqual(env.RATE_LIMITER.limit.mock.calls[0].arguments, [{ key: '203.0.113.1' }])
    assert.equal(upstream.mock.callCount(), 0)
  })

  it('API キーが未設定なら 503 を返す', async () => {
    const response = await getCat(createEnv({ apiKey: '' }))

    assert.equal(response.status, 503)
  })

  it('TheCatAPI がエラーを返したら 502 を返す', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('error', { status: 500 }))
    const response = await getCat(createEnv())

    assert.equal(response.status, 502)
  })

  it('TheCatAPI に接続できなければ 502 を返す', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('network error')
    })
    const response = await getCat(createEnv())

    assert.equal(response.status, 502)
  })

  it('取得した画像と名言をキャッシュさせずに返し、D1 に保存する', async () => {
    const upstream = mockCatApi()
    const env = createEnv()
    const response = await getCat(env)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(body.cached, false)
    assert.deepEqual(body.image, { id: 'cat1', url: 'https://cdn2.thecatapi.com/images/cat1.jpg' })
    assert.ok(body.quote.text && body.quote.author)
    assert.equal(upstream.mock.calls[0].arguments[1].headers['x-api-key'], 'test-key')

    const window = env.DB.sqlite.prepare('SELECT started_at, request_count FROM api_window').get()
    assert.deepEqual({ ...window }, { started_at: START, request_count: 1 })
    const cached = env.DB.sqlite.prepare('SELECT image_id, quote_text, author FROM cat_cache').all()
    assert.deepEqual(cached.map((row) => ({ ...row })), [
      { image_id: 'cat1', quote_text: body.quote.text, author: body.quote.author },
    ])
  })

  it('1分以内は全員で10回まで TheCatAPI を呼び、11回目以降はキャッシュから返す', async () => {
    const upstream = mockCatApi()
    const env = createEnv()

    for (let i = 0; i < WINDOW_LIMIT; i += 1) {
      mock.timers.tick(1000)
      assert.equal((await (await getCat(env)).json()).cached, false)
    }
    assert.equal(upstream.mock.callCount(), WINDOW_LIMIT)

    mock.timers.tick(WINDOW_MS - WINDOW_LIMIT * 1000 - 1)
    const response = await getCat(env)
    const body = await response.json()

    assert.equal(body.cached, true)
    assert.match(body.image.id, /^cat([1-9]|10)$/)
    assert.equal(upstream.mock.callCount(), WINDOW_LIMIT)
  })

  it('キャッシュからは前回表示した画像を避けて返す', async () => {
    mockCatApi()
    const env = createEnv()
    const shown = new Set()
    for (let i = 0; i < WINDOW_LIMIT; i += 1) shown.add((await (await getCat(env)).json()).image.id)

    let previous = await (await getCat(env)).json()
    for (let i = 0; i < 50; i += 1) {
      const body = await (await getCat(env, previous)).json()
      assert.equal(body.cached, true)
      assert.notEqual(body.image.id, previous.image.id)
      assert.ok(shown.has(body.image.id))
      previous = body
    }
  })

  it('1回目から1分経ったらキャッシュを消して TheCatAPI を呼び、その時刻から新しい枠を数える', async () => {
    const upstream = mockCatApi()
    const env = createEnv()
    for (let i = 0; i < WINDOW_LIMIT + 1; i += 1) await getCat(env)

    mock.timers.tick(WINDOW_MS)
    const body = await (await getCat(env)).json()

    assert.equal(body.cached, false)
    assert.equal(body.image.id, `cat${WINDOW_LIMIT + 1}`)
    assert.equal(upstream.mock.callCount(), WINDOW_LIMIT + 1)
    const window = env.DB.sqlite.prepare('SELECT started_at, request_count FROM api_window').get()
    assert.deepEqual({ ...window }, { started_at: START + WINDOW_MS, request_count: 1 })
    const cached = env.DB.sqlite.prepare('SELECT image_id FROM cat_cache').all()
    assert.deepEqual(cached.map((row) => row.image_id), [`cat${WINDOW_LIMIT + 1}`])
  })

  it('上限に達したのにキャッシュが空なら、枠が空くまでの秒数を付けて 429 を返す', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('error', { status: 500 }))
    const env = createEnv()
    for (let i = 0; i < WINDOW_LIMIT; i += 1) await getCat(env)

    mock.timers.tick(15_500)
    const response = await getCat(env)

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '45')
  })
})
