import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFeedback, postFeedback } from '../src/feedback/api'
import { deviceClass } from '../src/feedback/device'

const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('deviceClass', () => {
  it('splits at the app\'s own breakpoints: phone below 768, tablet below 1280, desktop above', () => {
    expect(deviceClass(390)).toBe('phone')
    expect(deviceClass(767)).toBe('phone')
    expect(deviceClass(768)).toBe('tablet')
    expect(deviceClass(1279)).toBe('tablet')
    expect(deviceClass(1280)).toBe('desktop')
  })
})

describe('postFeedback', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('posts exactly what the backend accepts: no name, no address, no browser details', async () => {
    const f = vi.fn(async () => jsonRes(201, { id: 'u-1', created_at: '2026-11-18T01:02:03.456Z' }))
    vi.stubGlobal('fetch', f)
    window.innerWidth = 390
    const receipt = await postFeedback({ rating: 4, comment: 'Kia ora, clear page' }, '/the-breast')
    expect(receipt).toEqual({ id: 'u-1', created_at: '2026-11-18T01:02:03.456Z' })
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:8082/api/feedback')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      rating: 4,
      comment: 'Kia ora, clear page',
      page: '/the-breast',
      device: 'phone',
      app_version: '0.0.0-test',
      mode: 'standalone',
    })
  })

  it('keeps the page path within the backend\'s 200 characters', async () => {
    const f = vi.fn(async () => jsonRes(201, { id: 'u', created_at: 't' }))
    vi.stubGlobal('fetch', f)
    await postFeedback({ rating: 3, comment: '' }, `/${'x'.repeat(300)}`)
    const body = JSON.parse((f.mock.calls[0]! as unknown as [string, RequestInit])[1].body as string)
    expect(body.page).toHaveLength(200)
  })

  it('passes on the backend\'s own message, as on a 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(429, {
      detail: { code: 'rate_limited', summary: 'Too many messages — please try again later.' },
    })))
    await expect(postFeedback({ rating: 1, comment: '' }, '/')).rejects.toEqual({
      status: 429,
      summary: 'Too many messages — please try again later.',
    })
  })

  it('reads FastAPI\'s own 422, whose detail is a list, as a plain sentence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(422, { detail: [{ type: 'value_error', msg: 'x' }] })))
    await expect(postFeedback({ rating: null, comment: '' }, '/')).rejects.toEqual({
      status: 422,
      summary: 'The message could not be sent (HTTP 422).',
    })
  })

  it('says the server could not be reached when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(postFeedback({ rating: 2, comment: '' }, '/')).rejects.toEqual({
      status: 0,
      summary: 'The server could not be reached. Check your connection and try again.',
    })
  })
})

describe('fetchFeedback', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends the password in a header, never the URL', async () => {
    const f = vi.fn(async () => jsonRes(200, { total: 0, items: [] }))
    vi.stubGlobal('fetch', f)
    expect(await fetchFeedback('qwerty')).toEqual({ total: 0, items: [] })
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:8082/api/feedback')
    expect(url).not.toContain('qwerty')
    expect((init.headers as Record<string, string>)['X-Feedback-Password']).toBe('qwerty')
    expect(init.cache).toBe('no-store')
  })

  it('rejects with status 401 on a wrong password', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(401, { detail: { code: 'bad_password', summary: 'Wrong password.' } })))
    await expect(fetchFeedback('nope')).rejects.toEqual({ status: 401, summary: 'Wrong password.' })
  })
})
