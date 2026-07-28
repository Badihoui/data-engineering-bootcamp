/**
 * Thin fetch wrapper around the Django API.
 *
 * Holds the JWT pair in localStorage and transparently refreshes the access
 * token once on a 401 before giving up.
 */

const BASE = '/api'
const ACCESS_KEY = 'bootcamp.access'
const REFRESH_KEY = 'bootcamp.refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access, refresh }: { access: string; refresh?: string }) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(status: number, payload: unknown) {
    super(typeof payload === 'string' ? payload : `Erreur ${status}`)
    this.status = status
    this.payload = payload
  }

  /** First human-readable message out of a DRF error body. */
  get detail(): string {
    const p = this.payload as Record<string, unknown> | string | null
    if (!p) return this.message
    if (typeof p === 'string') return p
    if (typeof p.detail === 'string') return p.detail
    const first = Object.values(p)[0]
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
    return this.message
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  const response = await fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!response.ok) {
    tokens.clear()
    return false
  }
  const data = await response.json()
  tokens.set({ access: data.access, refresh: data.refresh })
  return true
}

interface RequestOptions {
  method?: string
  body?: unknown
  auth?: boolean
  retry?: boolean
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const access = tokens.access
  if (auth && access) headers.Authorization = `Bearer ${access}`

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && retry && auth && tokens.refresh) {
    if (await refreshAccessToken()) {
      return request<T>(path, { ...options, retry: false })
    }
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
