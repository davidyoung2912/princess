import { describe, expect, it } from 'vitest'
import { createHttp } from './http'

const make = (respond: (url: string, init: RequestInit) => Response) => {
  const calls: { url: string; init: RequestInit }[] = []
  const http = createHttp({
    baseUrl: '/api/v1', token: () => 'tok', refresh: async () => false, online: () => true,
    fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return respond(url, init) }) as unknown as typeof fetch,
  })
  return { http, calls }
}

describe('sending and fetching pictures', () => {
  it('sends the bytes as the body with their own type and the sign-in token, and the details in the query', async () => {
    const { http, calls } = make(() => new Response(JSON.stringify({ id: 'x' }), { status: 200 }))
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    expect(await http.upload('/me/media', file, { query: { purpose: 'cabin', ref: 'balcony', caption: 'a b' } })).toEqual({ id: 'x' })
    const { url, init } = calls[0]
    expect(url).toBe('/api/v1/me/media?purpose=cabin&ref=balcony&caption=a%20b')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(file)
    expect((init.headers as Record<string, string>)['content-type']).toBe('image/jpeg')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('fetches a picture as bytes with the token', async () => {
    const { http, calls } = make(() => new Response(new Uint8Array([9, 9]), { status: 200, headers: { 'content-type': 'image/png' } }))
    const blob = await http.blob('/media/abc')
    expect(blob.size).toBe(2)
    expect(blob.type).toBe('image/png')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect((calls[0].init.headers as Record<string, string>).accept).toBe('*/*')
  })

  it('turns a refusal into the server’s own word, for a picture too', async () => {
    const { http } = make(() => new Response(JSON.stringify({ title: 'size' }), { status: 400, headers: { 'content-type': 'application/problem+json' } }))
    await expect(http.upload('/me/media', new Blob([new Uint8Array(1)], { type: 'image/png' }))).rejects.toMatchObject({ code: 'invalid', message: 'size' })
    const { http: missing } = make(() => new Response('', { status: 404 }))
    await expect(missing.blob('/media/abc')).rejects.toMatchObject({ code: 'notFound' })
  })

  it('leaves ordinary JSON calls as they were', async () => {
    const { http, calls } = make(() => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await http.post('/x', { a: 1 })
    expect(calls[0].init.body).toBe('{"a":1}')
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect((calls[0].init.headers as Record<string, string>).accept).toBe('application/json')
  })
})
