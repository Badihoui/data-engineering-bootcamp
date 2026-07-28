/**
 * Spaced-repetition review.
 *
 * The card is shown, the learner recalls silently, reveals, then rates their
 * own recall. Grades feed SM-2 server-side; the client only animates the deck.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Brain,
  CheckCircle2,
  Eye,
  Layers,
  RotateCcw,
  Sparkles,
  Timer,
  TrendingUp,
} from 'lucide-react'

import { Button, ButtonLink, Card, EmptyState, Pill, ProgressBar, Skeleton } from '@/components/ui'
import { Confetti, CountUp, ProgressRing } from '@/components/motion'
import { useFlashcardSession, useGradeFlashcard } from '@/lib/queries'
import type { Flashcard } from '@/lib/types'

const GRADES = [
  { value: 0, label: 'Oublié', hint: 'à revoir demain', color: '#f87171' },
  { value: 3, label: 'Difficile', hint: 'intervalle réduit', color: '#fb923c' },
  { value: 4, label: 'Correct', hint: 'intervalle normal', color: '#38bdf8' },
  { value: 5, label: 'Facile', hint: 'intervalle allongé', color: '#34d399' },
] as const

function intervalLabel(days: number): string {
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'demain'
  if (days < 30) return `dans ${days} jours`
  const months = Math.round(days / 30)
  return months === 1 ? 'dans un mois' : `dans ${months} mois`
}

function CardFace({ card, revealed }: { card: Flashcard; revealed: boolean }) {
  return (
    <div className="flex min-h-[260px] flex-col p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill>{card.module_title}</Pill>
        {card.is_new ? (
          <Pill color="#38bdf8">nouvelle</Pill>
        ) : (
          <Pill>
            <Timer size={10} /> vue {card.repetitions} fois
          </Pill>
        )}
        {card.lapses > 0 && <Pill color="#f87171">{card.lapses} oubli(s)</Pill>}
      </div>

      <p className="text-lg leading-snug font-medium text-balance">{card.prompt}</p>

      {card.kind === 'mcq' && card.choices.length > 0 && (
        <ul className="mt-5 space-y-2">
          {card.choices.map((choice) => {
            const isAnswer = revealed && choice.label === card.correct_label
            return (
              <li
                key={choice.id}
                className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition"
                style={{
                  borderColor: isAnswer ? '#34d399' : 'var(--border)',
                  background: isAnswer ? '#34d3991a' : 'var(--surface-2)',
                }}
              >
                <span
                  className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.7rem] font-semibold uppercase"
                  style={{
                    background: isAnswer ? '#34d399' : 'var(--surface-3)',
                    color: isAnswer ? '#04121d' : 'var(--text-muted)',
                  }}
                >
                  {choice.label || '·'}
                </span>
                <span className="flex-1">{choice.text}</span>
                {isAnswer && <CheckCircle2 size={15} className="mt-0.5 text-emerald-400" />}
              </li>
            )
          })}
        </ul>
      )}

      <AnimatePresence>
        {revealed && card.explanation && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            {card.explanation}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Review() {
  const { data, isLoading, refetch } = useFlashcardSession()
  const grade = useGradeFlashcard()

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [graded, setGraded] = useState<number[]>([])
  const [celebration, setCelebration] = useState(0)

  const cards = useMemo(() => data?.cards ?? [], [data])
  const card = cards[index]
  const finished = cards.length > 0 && index >= cards.length

  const answer = useCallback(
    (value: number) => {
      if (!card || grade.isPending) return
      grade.mutate({ questionId: card.question, grade: value })
      setGraded((previous) => [...previous, value])
      setRevealed(false)
      setIndex((previous) => {
        const next = previous + 1
        if (next >= cards.length) setCelebration((n) => n + 1)
        return next
      })
    },
    [card, cards.length, grade],
  )

  // Space reveals, 1-4 grade — the shortcuts every SRS user expects.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.code === 'Space' && !revealed) {
        event.preventDefault()
        setRevealed(true)
        return
      }
      if (!revealed) return
      const position = Number(event.key)
      if (position >= 1 && position <= 4) {
        event.preventDefault()
        answer(GRADES[position - 1].value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, answer])

  const restart = () => {
    setIndex(0)
    setRevealed(false)
    setGraded([])
    refetch()
  }

  if (isLoading) return <Skeleton className="h-96" />

  const stats = data?.stats
  const percent = cards.length ? Math.round((index / cards.length) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Confetti trigger={celebration} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Brain size={22} style={{ color: 'var(--accent)' }} />
            Révision
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Répétition espacée sur les questions des modules que vous avez ouverts. Espace pour
            révéler, 1 à 4 pour vous noter.
          </p>
        </div>
        {stats && (
          <div className="flex gap-2">
            <Pill color="#38bdf8">{stats.due} à revoir</Pill>
            <Pill>{stats.mature} consolidées</Pill>
          </div>
        )}
      </header>

      {cards.length > 0 && !finished && (
        <div>
          <div
            className="mb-1.5 flex justify-between text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              Carte {index + 1} sur {cards.length}
            </span>
            <span className="tabular-nums">{percent} %</span>
          </div>
          <ProgressBar percent={percent} height={5} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {cards.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <EmptyState
                icon={<Layers size={30} />}
                title="Rien à réviser pour le moment"
                description={
                  stats && stats.available === 0
                    ? "Ouvrez une première leçon d'un module doté d'un quiz : ses questions deviendront des cartes."
                    : 'Toutes vos cartes sont à jour. Revenez demain — le calendrier fait le reste.'
                }
                action={<ButtonLink to="/app/modules">Parcourir les modules</ButtonLink>}
              />
            </Card>
          </motion.div>
        ) : finished ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="p-8 text-center">
              <ProgressRing percent={100} size={110} label={<Sparkles size={26} />} />
              <h2 className="mt-4 text-xl font-semibold">Session terminée</h2>
              <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <CountUp value={graded.length} /> carte(s) révisée(s) ·{' '}
                {graded.filter((value) => value >= 4).length} sans hésitation
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={restart}>
                  <RotateCcw size={15} /> Nouvelle session
                </Button>
                <ButtonLink to="/app" variant="outline">
                  Retour au tableau de bord
                </ButtonLink>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24, rotateX: -4 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -24, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="overflow-hidden">
              <CardFace card={card} revealed={revealed} />

              <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
                {!revealed ? (
                  <Button className="w-full" onClick={() => setRevealed(true)}>
                    <Eye size={16} /> Révéler la réponse
                    <kbd className="ml-1 rounded px-1 text-[0.65rem] opacity-60">espace</kbd>
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {GRADES.map((item, position) => (
                      <motion.button
                        key={item.value}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => answer(item.value)}
                        disabled={grade.isPending}
                        className="rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50"
                        style={{ borderColor: item.color, background: `${item.color}12` }}
                      >
                        <span
                          className="block text-sm font-semibold"
                          style={{ color: item.color }}
                        >
                          {item.label}
                        </span>
                        <span
                          className="block text-[0.68rem]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {item.hint} · {position + 1}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {card.interval_days > 0 && (
              <p
                className="mt-3 flex items-center justify-center gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <TrendingUp size={12} />
                Dernier intervalle : {intervalLabel(card.interval_days)} · facilité{' '}
                {card.ease_factor.toFixed(2)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {stats && stats.available > 0 && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">État du paquet</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Nouvelles', value: stats.new, color: '#38bdf8' },
              { label: 'En cours', value: stats.learning, color: '#fb923c' },
              { label: 'Consolidées', value: stats.mature, color: '#34d399' },
              { label: 'Oublis', value: stats.lapses, color: '#f87171' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xl font-semibold" style={{ color: item.color }}>
                  <CountUp value={item.value} />
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Une carte est <em>consolidée</em> quand elle survit à plus de trois semaines entre deux
            révisions. Les <Link to="/app/modules" style={{ color: 'var(--accent)' }}>modules</Link>{' '}
            que vous ouvrez alimentent automatiquement le paquet.
          </p>
        </Card>
      )}
    </div>
  )
}
