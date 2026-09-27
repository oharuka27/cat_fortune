import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import worker from './index.js'

const BASE_URL = 'https://cat-fortune.example'

const createEnv = ({ apiKey = 'test-key', allowed = true } = {}) => ({
  THECATAPI_KEY: apiKey,
  ASSETS: { fetch: mock.fn(async () => new Response('asset')) },
  RATE_LIMITER: { limit: mock.fn(async () => ({ success: allowed })) },
})

const request = (path, init) =>
  new Request(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'CF-Connecting-IP': '203.0.113.1', ...init?.headers },
  })

describe('worker', () => {
  beforeEach(() => {
    mock.restoreAll()
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

  it('回数制限を超えたら TheCatAPI を呼ばずに 429 を返す', async () => {
    const upstream = mock.method(globalThis, 'fetch', async () => Response.json([]))
    const env = createEnv({ allowed: false })
    const response = await worker.fetch(request('/api/cat'), env)

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Retry-After'), '60')
    assert.deepEqual(env.RATE_LIMITER.limit.mock.calls[0].arguments, [{ key: '203.0.113.1' }])
    assert.equal(upstream.mock.callCount(), 0)
  })

  it('API キーが未設定なら 503 を返す', async () => {
    const response = await worker.fetch(request('/api/cat'), createEnv({ apiKey: '' }))

    assert.equal(response.status, 503)
  })

  it('TheCatAPI がエラーを返したら 502 を返す', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('error', { status: 500 }))
    const response = await worker.fetch(request('/api/cat'), createEnv())

    assert.equal(response.status, 502)
  })

  it('TheCatAPI に接続できなければ 502 を返す', async () => {
    mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('network error')
    })
    const response = await worker.fetch(request('/api/cat'), createEnv())

    assert.equal(response.status, 502)
  })

  it('成功時は TheCatAPI の結果をキャッシュさせずに返す', async () => {
    const images = [{ id: 'abc', url: 'https://cdn2.thecatapi.com/images/abc.jpg' }]
    const upstream = mock.method(globalThis, 'fetch', async () => Response.json(images))
    const response = await worker.fetch(request('/api/cat'), createEnv())

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), images)
    assert.equal(upstream.mock.calls[0].arguments[1].headers['x-api-key'], 'test-key')
  })
})
