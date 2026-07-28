import { create } from 'zustand'

type Theme = 'light' | 'dark'
const KEY = 'bootcamp.theme'

function initial(): Theme {
  const stored = localStorage.getItem(KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(KEY, theme)
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  init: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'dark',
  init() {
    const theme = initial()
    apply(theme)
    set({ theme })
  },
  toggle() {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    apply(theme)
    set({ theme })
  },
}))
