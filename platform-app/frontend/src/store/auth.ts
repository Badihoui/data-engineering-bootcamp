import { create } from 'zustand'

import { api, tokens } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  status: 'idle' | 'loading' | 'authenticated' | 'anonymous'
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    email: string
    username: string
    display_name: string
    password: string
  }) => Promise<void>
  logout: () => void
  patchUser: (patch: Partial<User>) => void
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',

  async hydrate() {
    if (!tokens.access) {
      set({ status: 'anonymous', user: null })
      return
    }
    set({ status: 'loading' })
    try {
      const user = await api.get<User>('/auth/me/')
      set({ user, status: 'authenticated' })
    } catch {
      tokens.clear()
      set({ user: null, status: 'anonymous' })
    }
  },

  async login(email, password) {
    const data = await api.post<{ access: string; refresh: string; user: User }>('/auth/login/', {
      email,
      password,
    })
    tokens.set({ access: data.access, refresh: data.refresh })
    set({ user: data.user, status: 'authenticated' })
  },

  async register(payload) {
    await api.post('/auth/register/', payload)
    await get().login(payload.email, payload.password)
  },

  logout() {
    tokens.clear()
    set({ user: null, status: 'anonymous' })
  },

  patchUser(patch) {
    const user = get().user
    if (user) set({ user: { ...user, ...patch } })
  },
}))
