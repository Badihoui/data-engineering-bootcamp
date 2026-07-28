/**
 * Motion primitives shared across the app.
 *
 * All of them honour `prefers-reduced-motion`: the hook returns instant
 * variants so the interface stays usable for people who disable animation.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react'

/* ------------------------------------------------------------- variants */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Page-level wrapper — every route mounts through this. */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Reveals its children once they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : 'hidden'}
      animate={inView || reduced ? 'visible' : 'hidden'}
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Staggered list container — pair with `<StaggerItem>`. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : 'hidden'}
      animate={inView || reduced ? 'visible' : 'hidden'}
      variants={staggerChildren}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}

/* -------------------------------------------------------------- numbers */

/** Counts up to `value` when it enters the viewport. */
export function CountUp({
  value,
  duration = 1.1,
  suffix = '',
  decimals = 0,
}: {
  value: number
  duration?: number
  suffix?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)

  useEffect(() => {
    if (!inView || reduced) {
      setDisplay(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / (duration * 1000))
      // easeOutExpo keeps the last digits from crawling.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(value * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, value, duration, reduced])

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

/* ---------------------------------------------------------------- rings */

/** Circular progress indicator with a spring-animated arc. */
export function ProgressRing({
  percent,
  size = 96,
  stroke = 8,
  color = 'var(--accent)',
  label,
  sublabel,
}: {
  percent: number
  size?: number
  stroke?: number
  color?: string
  label?: ReactNode
  sublabel?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const reduced = useReducedMotion()

  const target = useMotionValue(reduced ? percent : 0)
  const spring = useSpring(target, { stiffness: 90, damping: 20 })
  const offset = useTransform(spring, (value) => circumference * (1 - Math.min(100, value) / 100))

  useEffect(() => {
    target.set(percent)
  }, [percent, target])

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--surface-3)"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <span className="absolute grid place-items-center text-center leading-tight">
        <span className="text-lg font-semibold tabular-nums">
          {label ?? <CountUp value={percent} suffix=" %" />}
        </span>
        {sublabel && (
          <span className="text-[0.62rem]" style={{ color: 'var(--text-muted)' }}>
            {sublabel}
          </span>
        )}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- accents */

/** Celebratory burst used when a lesson or quiz is completed. */
export function Confetti({ trigger }: { trigger: number }) {
  const reduced = useReducedMotion()
  const pieces = 18
  if (reduced || !trigger) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {Array.from({ length: pieces }, (_, index) => {
        const angle = (index / pieces) * Math.PI * 2
        const distance = 140 + Math.random() * 160
        const colors = ['#38bdf8', '#34d399', '#facc15', '#f472b6', '#a78bfa']
        return (
          <motion.span
            key={`${trigger}-${index}`}
            className="absolute top-1/2 left-1/2 block h-2 w-2 rounded-[2px]"
            style={{ background: colors[index % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance + 120,
              opacity: 0,
              rotate: Math.random() * 540 - 270,
            }}
            transition={{ duration: 1.1 + Math.random() * 0.5, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

/** Subtle lift on hover, shared by every clickable card. */
export const hoverLift = {
  whileHover: { y: -3, transition: { duration: 0.18 } },
  whileTap: { scale: 0.985 },
}
