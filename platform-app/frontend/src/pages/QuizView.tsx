import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'

import { Markdown } from '@/components/content/Markdown'
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Pill,
  ProgressBar,
  Skeleton,
  cx,
} from '@/components/ui'
import { useModule, useSubmitQuiz } from '@/lib/queries'
import { useAuth } from '@/store/auth'
import type { Question, QuizResult } from '@/lib/types'

function OpenQuestion({ question, index }: { question: Question; index: number }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Card className="p-5">
      <p className="text-sm font-medium">
        <span style={{ color: 'var(--text-muted)' }}>Q{index + 1}.</span> {question.prompt}
      </p>
      {revealed ? (
        <div className="mt-3 rounded-xl p-3.5 text-sm" style={{ background: 'var(--surface-2)' }}>
          <Markdown>{question.explanation}</Markdown>
        </div>
      ) : (
        <Button variant="outline" className="mt-3" onClick={() => setRevealed(true)}>
          Afficher la réponse
        </Button>
      )}
      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        Question ouverte — auto-évaluation, non comptée dans le score.
      </p>
    </Card>
  )
}

function McqQuestion({
  question,
  index,
  selected,
  onSelect,
  result,
}: {
  question: Question
  index: number
  selected: number | undefined
  onSelect: (choiceId: number) => void
  result: QuizResult | undefined
}) {
  const detail = result?.details.find((d) => d.question_id === question.id)

  return (
    <Card className="p-5">
      <p className="text-sm font-medium">
        <span style={{ color: 'var(--text-muted)' }}>Q{index + 1}.</span> {question.prompt}
      </p>

      <ul className="mt-3.5 space-y-2">
        {question.choices.map((choice) => {
          const isSelected = selected === choice.id
          const isCorrect = detail?.correct_choice_id === choice.id
          const isWrong = detail && isSelected && !detail.is_correct

          let borderColor = 'var(--border)'
          let background = 'var(--surface-2)'
          if (detail) {
            if (isCorrect) {
              borderColor = '#34d399'
              background = '#34d3991a'
            } else if (isWrong) {
              borderColor = '#f87171'
              background = '#f871711a'
            }
          } else if (isSelected) {
            borderColor = 'var(--accent)'
            background = 'var(--accent-soft)'
          }

          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={Boolean(detail)}
                onClick={() => onSelect(choice.id)}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
                  detail ? 'cursor-default' : 'hover:brightness-105',
                )}
                style={{ borderColor, background }}
              >
                <span
                  className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.7rem] font-semibold uppercase"
                  style={{
                    background: isSelected || isCorrect ? 'var(--accent)' : 'var(--surface-3)',
                    color: isSelected || isCorrect ? '#04121d' : 'var(--text-muted)',
                  }}
                >
                  {choice.label || '·'}
                </span>
                <span className="flex-1">{choice.text}</span>
                {detail && isCorrect && <Check size={15} className="mt-0.5 text-emerald-400" />}
                {isWrong && <X size={15} className="mt-0.5 text-red-400" />}
              </button>
            </li>
          )
        })}
      </ul>

      {detail?.explanation && (
        <div
          className="mt-3 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          {detail.explanation}
        </div>
      )}
    </Card>
  )
}

export function QuizView() {
  const { moduleSlug } = useParams()
  const { data: module, isLoading } = useModule(moduleSlug)
  const submit = useSubmitQuiz(moduleSlug)
  const authenticated = useAuth((s) => s.status === 'authenticated')
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<QuizResult | undefined>()

  const quiz = module?.quiz
  const mcq = useMemo(() => quiz?.questions.filter((q) => q.kind === 'mcq') ?? [], [quiz])
  const open = useMemo(() => quiz?.questions.filter((q) => q.kind === 'open') ?? [], [quiz])
  const answered = Object.keys(answers).length

  if (isLoading || !module) return <Skeleton className="h-96" />

  if (!quiz) {
    return (
      <EmptyState
        title="Pas de quiz pour ce module"
        description="Ce module n'a pas encore de questions de validation dans le notebook source."
        action={
          <ButtonLink to={`/app/modules/${module.slug}`} variant="outline">
            Retour au module
          </ButtonLink>
        }
      />
    )
  }

  const send = () => {
    submit.mutate(answers, { onSuccess: (data) => setResult(data) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const retry = () => {
    setAnswers({})
    setResult(undefined)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <Link
          to={`/app/modules/${module.slug}`}
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> {module.title}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{quiz.title}</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {quiz.description} · {mcq.length} questions notées
          {open.length > 0 && ` · ${open.length} questions ouvertes`} · seuil de réussite{' '}
          {quiz.pass_score} %
        </p>
      </header>

      {/* --------------------------------------------------------- result */}
      {result && (
        <Card className="animate-rise p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold tabular-nums"
                style={{
                  background: result.attempt.passed ? '#34d3991f' : '#f871711f',
                  color: result.attempt.passed ? '#34d399' : '#f87171',
                }}
              >
                {result.attempt.score}
              </span>
              <div>
                <p className="font-semibold">
                  {result.attempt.passed ? 'Quiz réussi 🎉' : 'Pas encore validé'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {result.attempt.correct_count} / {result.attempt.total_count} bonnes réponses
                  {result.awarded_xp > 0 && ` · +${result.awarded_xp} XP`}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={retry}>
              <RotateCcw size={15} /> Refaire le quiz
            </Button>
          </div>

          <ProgressBar
            percent={result.attempt.score}
            color={result.attempt.passed ? '#34d399' : '#f87171'}
            className="mt-5"
          />

          {result.new_badges.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Trophy size={15} style={{ color: '#facc15' }} />
              <span className="text-sm font-medium">Nouveaux badges :</span>
              {result.new_badges.map((badge) => (
                <Pill key={badge.slug} color={badge.color}>
                  {badge.icon} {badge.name}
                </Pill>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------ questions */}
      <div className="space-y-4">
        {mcq.map((question, index) => (
          <McqQuestion
            key={question.id}
            question={question}
            index={index}
            selected={answers[question.id]}
            result={result}
            onSelect={(choiceId) => setAnswers((prev) => ({ ...prev, [question.id]: choiceId }))}
          />
        ))}
      </div>

      {!result && mcq.length > 0 && (
        <div
          className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 backdrop-blur-xl"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {answered} / {mcq.length} questions répondues
          </span>
          {authenticated ? (
            <Button onClick={send} disabled={answered < mcq.length || submit.isPending}>
              <Sparkles size={15} />
              {submit.isPending ? 'Correction…' : 'Valider mes réponses'}
            </Button>
          ) : (
            <ButtonLink to="/connexion" variant="outline">
              Se connecter pour être noté
            </ButtonLink>
          )}
        </div>
      )}

      {open.length > 0 && (
        <section className="space-y-4">
          <h2 className="pt-4 font-semibold">Questions ouvertes</h2>
          {open.map((question, index) => (
            <OpenQuestion key={question.id} question={question} index={index} />
          ))}
        </section>
      )}
    </div>
  )
}
