import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function cx(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ')
}

/* --------------------------------------------------------------- surface */

export function Card({
  children,
  className,
  as: As = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <As
      className={cx('rounded-2xl border', className)}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow)',
      }}
      {...rest}
    >
      {children}
    </As>
  )
}

/* --------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'subtle'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

function buttonStyle(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { background: 'var(--accent)', color: '#04121d', border: '1px solid transparent' }
    case 'outline':
      return { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }
    case 'subtle':
      return {
        background: 'var(--surface-3)',
        color: 'var(--text)',
        border: '1px solid transparent',
      }
    default:
      return {
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid transparent',
      }
  }
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(BUTTON_BASE, 'hover:brightness-110 active:scale-[0.98]', className)}
      style={buttonStyle(variant)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'primary',
  className,
  children,
  external,
}: {
  to: string
  variant?: ButtonVariant
  className?: string
  children: ReactNode
  external?: boolean
}) {
  const props = {
    className: cx(BUTTON_BASE, 'hover:brightness-110 active:scale-[0.98]', className),
    style: buttonStyle(variant),
  }
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" {...props}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} {...props}>
      {children}
    </Link>
  )
}

/* ----------------------------------------------------------------- misc */

export function Pill({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium',
        className,
      )}
      style={{
        background: color ? `${color}1f` : 'var(--surface-3)',
        color: color ?? 'var(--text-muted)',
        border: `1px solid ${color ? `${color}33` : 'transparent'}`,
      }}
    >
      {children}
    </span>
  )
}

export function ProgressBar({
  percent,
  color,
  className,
  height = 6,
}: {
  percent: number
  color?: string
  className?: string
  height?: number
}) {
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full', className)}
      style={{ background: 'var(--surface-3)', height }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: color ?? 'var(--accent)',
        }}
      />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-xl', className)}
      style={{ background: 'var(--surface-3)' }}
    />
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon && <div style={{ color: 'var(--text-muted)' }}>{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="max-w-md text-sm" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  accent?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[0.72rem] font-medium tracking-wide uppercase"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {hint}
            </p>
          )}
        </div>
        {icon && (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{
              background: `${accent ?? 'var(--accent)'}1f`,
              color: accent ?? 'var(--accent)',
            }}
          >
            {icon}
          </span>
        )}
      </div>
    </Card>
  )
}

export function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulté ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i <= level ? 'var(--accent)' : 'var(--surface-3)' }}
        />
      ))}
    </span>
  )
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}
