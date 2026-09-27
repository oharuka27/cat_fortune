const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (url.pathname !== '/api/cat') return new Response('Not Found', { status: 404 })

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } })
    }

    // 同じIPからの連続アクセスで TheCatAPI の利用枠を使い切られないよう、回数を制限します。
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: clientIp })
    if (!success) {
      return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60' } })
    }

    if (!env.THECATAPI_KEY) {
      return new Response('TheCatAPI key is not configured', { status: 503 })
    }

    try {
      const response = await fetch(CAT_API_URL, {
        headers: { 'x-api-key': env.THECATAPI_KEY },
      })
      if (!response.ok) {
        return new Response('TheCatAPI request failed', { status: 502 })
      }

      return new Response(response.body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    } catch {
      return new Response('TheCatAPI request failed', { status: 502 })
    }
  },
}
