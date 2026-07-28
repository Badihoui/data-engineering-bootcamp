import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import type {
  Bookmark,
  CatalogStats,
  Certificate,
  Dashboard,
  Flashcard,
  FlashcardStats,
  LeaderboardEntry,
  Lesson,
  Module,
  Note,
  ProgressSnapshot,
  QuizResult,
  Track,
} from '@/lib/types'

const STATIC = { staleTime: 1000 * 60 * 30 }

export function useTracks() {
  return useQuery({
    queryKey: ['tracks'],
    queryFn: () => api.get<{ results: Track[] }>('/tracks/').then((r) => r.results),
    ...STATIC,
  })
}

export function useTrack(slug: string | undefined) {
  return useQuery({
    queryKey: ['track', slug],
    queryFn: () => api.get<Track>(`/tracks/${slug}/`),
    enabled: Boolean(slug),
    ...STATIC,
  })
}

export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => api.get<Module[]>('/modules/'),
    ...STATIC,
  })
}

export function useModule(slug: string | undefined) {
  return useQuery({
    queryKey: ['module', slug],
    queryFn: () => api.get<Module>(`/modules/${slug}/`),
    enabled: Boolean(slug),
    ...STATIC,
  })
}

export function useLesson(moduleSlug: string | undefined, lessonSlug: string | undefined) {
  return useQuery({
    queryKey: ['lesson', moduleSlug, lessonSlug],
    queryFn: () => api.get<Lesson>(`/lessons/${lessonSlug}/?module=${moduleSlug}`),
    enabled: Boolean(moduleSlug && lessonSlug),
    ...STATIC,
  })
}

export function useCatalogStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<CatalogStats>('/stats/'),
    ...STATIC,
  })
}

export function useDashboard() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/me/dashboard/'),
    enabled: authenticated,
  })
}

export function useProgress() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressSnapshot>('/me/progress/'),
    enabled: authenticated,
  })
}

interface TrackLessonPayload {
  moduleSlug: string
  lessonSlug: string
  status?: 'in_progress' | 'completed'
  seconds_spent?: number
  scroll_ratio?: number
}

export function useTrackLesson() {
  const queryClient = useQueryClient()
  const patchUser = useAuth((s) => s.patchUser)

  return useMutation({
    mutationFn: ({ moduleSlug, lessonSlug, ...rest }: TrackLessonPayload) =>
      api.post<{ awarded_xp: number; xp: number; current_streak: number; new_badges: unknown[] }>(
        `/lessons/${lessonSlug}/track/`,
        { module: moduleSlug, ...rest },
      ),
    onSuccess: (data) => {
      patchUser({ xp: data.xp, current_streak: data.current_streak })
      queryClient.invalidateQueries({ queryKey: ['progress'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/* ------------------------------------------------------------------ notes */

export function useLessonNote(lessonSlug: string | undefined) {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['note', lessonSlug],
    queryFn: () =>
      api
        .get<Note[]>(`/notes/?lesson__slug=${lessonSlug}`)
        .then((notes) => notes[0] ?? null),
    enabled: authenticated && Boolean(lessonSlug),
  })
}

export function useSaveNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, lesson, body }: { id?: number; lesson: number; body: string }) =>
      id
        ? api.patch<Note>(`/notes/${id}/`, { body })
        : api.post<Note>('/notes/', { lesson, body }),
    onSuccess: (note) => {
      queryClient.setQueryData(['note', note.lesson_slug], note)
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/notes/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useAllNotes() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['notes'],
    queryFn: () => api.get<Note[]>('/notes/'),
    enabled: authenticated,
  })
}

/* -------------------------------------------------------------- bookmarks */

export function useBookmarks() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => api.get<Bookmark[]>('/bookmarks/'),
    enabled: authenticated,
  })
}

export function useToggleBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ moduleId, existingId }: { moduleId: number; existingId?: number }) => {
      if (existingId) {
        await api.delete<void>(`/bookmarks/${existingId}/`)
        return null
      }
      return api.post<Bookmark>('/bookmarks/', { module: moduleId })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  })
}

export function useSubmitQuiz(moduleSlug: string | undefined) {
  const queryClient = useQueryClient()
  const patchUser = useAuth((s) => s.patchUser)

  return useMutation({
    mutationFn: (answers: Record<number, number>) =>
      api.post<QuizResult>(`/modules/${moduleSlug}/quiz/submit/`, { answers }),
    onSuccess: (data) => {
      patchUser({ xp: data.xp })
      queryClient.invalidateQueries({ queryKey: ['progress'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/* ------------------------------------------------------------- flashcards */

export function useFlashcardSession(limit = 15) {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['flashcards', limit],
    queryFn: () =>
      api.get<{ cards: Flashcard[]; stats: FlashcardStats }>(`/me/flashcards/?limit=${limit}`),
    enabled: authenticated,
    // A session is a snapshot: refetching mid-deck would shuffle the cards.
    staleTime: Infinity,
    refetchOnMount: false,
  })
}

export function useFlashcardStats() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['flashcard-stats'],
    queryFn: () => api.get<FlashcardStats>('/me/flashcards/stats/'),
    enabled: authenticated,
  })
}

export function useGradeFlashcard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, grade }: { questionId: number; grade: number }) =>
      api.post<{ review: Flashcard; stats: FlashcardStats }>(
        `/me/flashcards/${questionId}/grade/`,
        { grade },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flashcard-stats'] }),
  })
}

/* ------------------------------------------------- classement & certificats */

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () =>
      api.get<{ entries: LeaderboardEntry[]; my_rank: number | null; total: number }>(
        '/leaderboard/',
      ),
  })
}

export function useCertificates() {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  return useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.get<Certificate[]>('/me/certificates/'),
    enabled: authenticated,
  })
}
