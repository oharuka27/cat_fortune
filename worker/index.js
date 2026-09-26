const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/api/cat') return env.ASSETS.fetch(request)

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } })
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
