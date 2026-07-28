import { create } from 'zustand'

export type WorkshopTab = 'shell' | 'sql' | 'python'

/** Languages a lesson snippet can be sent to, and where they land. */
const LANGUAGE_TO_TAB: Record<string, WorkshopTab> = {
  python: 'python',
  py: 'python',
  sql: 'sql',
  bash: 'shell',
  shell: 'shell',
  sh: 'shell',
  console: 'shell',
}

export function tabForLanguage(language: string | undefined): WorkshopTab | null {
  if (!language) return null
  return LANGUAGE_TO_TAB[language.toLowerCase()] ?? null
}

interface PendingSnippet {
  tab: WorkshopTab
  code: string
  /** Where the learner came from, so the workshop can offer a way back. */
  origin?: { label: string; path: string }
}

interface WorkshopState {
  pending: PendingSnippet | null
  /** Set by a lesson, consumed once by the workshop on mount. */
  send: (snippet: PendingSnippet) => void
  consume: () => PendingSnippet | null
}

export const useWorkshop = create<WorkshopState>((set, get) => ({
  pending: null,
  send: (pending) => set({ pending }),
  consume: () => {
    const { pending } = get()
    if (pending) set({ pending: null })
    return pending
  },
}))
