import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from 'axios'

const auth = vi.hoisted(() => ({
  token: 'expired-access',
  refreshToken: 'valid-refresh',
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('~/stores/auth.store', () => ({ useAuthStore: () => auth }))

let axios: AxiosStatic
let api: AxiosInstance

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  auth.token = 'expired-access'
  auth.refreshToken = 'valid-refresh'
  auth.setToken.mockImplementation(token => { auth.token = token })
  auth.setRefreshToken.mockImplementation(token => { auth.refreshToken = token })
  axios = (await import('axios')).default
  api = (await import('../services/api')).useApi()
})
afterEach(() => vi.restoreAllMocks())

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config,
  })
}

// Bound the wait so a forgotten queued promise fails instead of hanging the suite.
async function settledWithin<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Requests remained pending after refresh finished')), 500)
      }),
    ])
  } finally { clearTimeout(timer) }
}

async function startConcurrentRequests(allowRetry = true) {
  const refresh = deferred<{ data: { access_token: string; refresh_token: string } }>()
  const post = vi.spyOn(axios, 'post').mockReturnValue(refresh.promise as ReturnType<typeof axios.post>)
  const attempts: string[] = []
  api.defaults.adapter = async config => {
    attempts.push(config.url!)
    if (!allowRetry || config.headers.Authorization !== 'Bearer fresh-access') throw unauthorized(config)
    return { data: config.url, status: 200, statusText: 'OK', headers: {}, config }
  }
  // Attach rejection handlers immediately, including on the initiating request.
  const results = Promise.allSettled(['/classes', '/chats', '/users/me'].map(url => api.get(url)))
  // Let all three 401 responses reach the interceptor while refresh is deferred.
  await vi.waitFor(() => {
    expect(attempts).toHaveLength(3)
    expect(post).toHaveBeenCalledTimes(1)
  })
  return { refresh, post, attempts, results }
}

describe('concurrent requests during token refresh', () => {
  it('refreshes once and retries every waiting request with the new token', async () => {
    const { refresh, post, attempts, results } = await startConcurrentRequests()
    refresh.resolve({ data: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' } })
    const settled = await settledWithin(results)
    expect(settled.map(result => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled'])
    expect(attempts).toHaveLength(6)
    expect(post).toHaveBeenCalledTimes(1)
    expect(auth.setRefreshToken).toHaveBeenCalledWith('fresh-refresh')
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it.each(['expired refresh token', 'network unavailable'])('rejects every request when refresh fails: %s', async message => {
    const { refresh, results, attempts } = await startConcurrentRequests()
    refresh.reject(new Error(message))
    const settled = await settledWithin(results)
    expect(settled.map(result => result.status)).toEqual(['rejected', 'rejected', 'rejected'])
    // Preserve the original request's 401, including its URL, for each caller.
    expect(settled.map(result => result.status === 'rejected' && result.reason.config.url))
      .toEqual(['/classes', '/chats', '/users/me'])
    expect(attempts).toHaveLength(3)
    expect(auth.logout).toHaveBeenCalledTimes(1)
  })

  it('does not start another refresh if retried requests still return 401', async () => {
    const { refresh, post, results } = await startConcurrentRequests(false)
    refresh.resolve({ data: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' } })
    const settled = await settledWithin(results)
    expect(settled.map(result => result.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(post).toHaveBeenCalledTimes(1)
  })
})
