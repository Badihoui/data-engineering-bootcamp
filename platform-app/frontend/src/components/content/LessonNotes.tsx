/**
 * Personal notes attached to a lesson.
 *
 * Saved server-side (one row per note), so they follow the learner across
 * devices. Autosaves after a pause rather than on every keystroke.
 */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Loader2, NotebookPen, Trash2 } from 'lucide-react'

import { Button, Card } from '@/components/ui'
import { useDeleteNote, useLessonNote, useSaveNote } from '@/lib/queries'
import { useAuth } from '@/store/auth'

const AUTOSAVE_DELAY = 1200

export function LessonNotes({ lessonId, lessonSlug }: { lessonId: number; lessonSlug: string }) {
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const { data: note, isLoading } = useLessonNote(lessonSlug)
  const save = useSaveNote()
  const remove = useDeleteNote()

  const [body, setBody] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const loadedFor = useRef<string | null>(null)

  // Adopt the server value once per lesson, without clobbering local edits.
  useEffect(() => {
    if (isLoading || loadedFor.current === lessonSlug) return
    setBody(note?.body ?? '')
    setDirty(false)
    loadedFor.current = lessonSlug
  }, [isLoading, note, lessonSlug])

  useEffect(() => {
    if (!dirty || !authenticated) return
    const timer = setTimeout(() => {
      save.mutate(
        { id: note?.id, lesson: lessonId, body },
        {
          onSuccess: () => {
            setDirty(false)
            setSavedAt(Date.now())
          },
        },
      )
    }, AUTOSAVE_DELAY)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, dirty, authenticated])

  if (!authenticated) return null

  const clear = () => {
    if (note?.id) remove.mutate(note.id)
    setBody('')
    setDirty(false)
  }

  return (
    <Card className="mt-6 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen size={15} style={{ color: 'var(--accent)' }} />
          Mes notes
        </h2>
        <AnimatePresence mode="wait">
          {save.isPending ? (
            <motion.span
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <Loader2 size={11} className="animate-spin" /> Enregistrement…
            </motion.span>
          ) : dirty ? (
            <motion.span
              key="dirty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Modifications non enregistrées
            </motion.span>
          ) : savedAt ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs"
              style={{ color: '#34d399' }}
            >
              <Check size={11} /> Enregistré
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <textarea
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
          setDirty(true)
        }}
        rows={5}
        placeholder="Ce que vous voulez retenir, une commande à réessayer, une question à creuser…"
        className="w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      />

      {body && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={clear} disabled={remove.isPending}>
            <Trash2 size={14} /> Effacer
          </Button>
        </div>
      )}
    </Card>
  )
}
