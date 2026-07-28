/**
 * Renders a schema as a real figure — never as terminal art.
 *
 * The backend classifies every box-drawing block from the notebooks into a
 * format; each one gets a dedicated visual treatment here:
 *   mermaid → SVG flowchart      tree   → indented node tree
 *   stack   → layered rows       panels → comparison cards
 *   svg     → inline authored SVG
 * `ascii` is the last-resort fallback for layouts nobody has converted yet; it
 * is still presented as a captioned figure rather than a code block.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { CornerDownRight, Layers, Maximize2, X } from 'lucide-react'

import { useTheme } from '@/store/theme'
import type { Diagram, TreeNode } from '@/lib/types'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function getMermaid(dark: boolean) {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  const mermaid = await mermaidPromise
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: "'Inter', system-ui, sans-serif",
    flowchart: { curve: 'basis', padding: 18, nodeSpacing: 42, rankSpacing: 52, htmlLabels: true },
    themeVariables: dark
      ? {
          background: '#111726',
          primaryColor: '#1c2740',
          primaryTextColor: '#e8edf7',
          primaryBorderColor: '#38bdf8',
          lineColor: '#4c5f80',
          secondaryColor: '#152033',
          tertiaryColor: '#0d1320',
          clusterBkg: '#0d1320',
          clusterBorder: '#263047',
          fontSize: '14px',
        }
      : {
          background: '#ffffff',
          primaryColor: '#eff6ff',
          primaryTextColor: '#0f172a',
          primaryBorderColor: '#0284c7',
          lineColor: '#94a3b8',
          secondaryColor: '#f8fafc',
          tertiaryColor: '#f1f5f9',
          clusterBkg: '#f8fafc',
          clusterBorder: '#dbe3ee',
          fontSize: '14px',
        },
  })
  return mermaid
}

function MermaidFigure({ source }: { source: string }) {
  const theme = useTheme((s) => s.theme)
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMermaid(theme === 'dark')
      .then((mermaid) => mermaid.render(`m${id}`, source))
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source, theme, id])

  if (failed) return <pre className="overflow-x-auto p-4 text-xs">{source}</pre>
  if (!svg) {
    return (
      <div
        className="h-40 animate-pulse rounded-xl"
        style={{ background: 'var(--surface-3)' }}
        aria-label="Chargement du schéma"
      />
    )
  }
  return <div className="mermaid-figure" dangerouslySetInnerHTML={{ __html: svg }} />
}

function TreeBranch({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <li className="relative">
      <div className="flex items-start gap-2 py-1">
        {depth > 0 && (
          <CornerDownRight
            size={14}
            className="mt-1 shrink-0"
            style={{ color: 'var(--text-muted)' }}
          />
        )}
        <span className="font-mono text-[0.86rem] font-medium">{node.label}</span>
        {node.note && (
          <span className="text-[0.78rem]" style={{ color: 'var(--text-muted)' }}>
            — {node.note}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="ml-3 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
          {node.children.map((child, index) => (
            <TreeBranch key={`${child.label}-${index}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function TreeFigure({ diagram }: { diagram: Diagram }) {
  const { root, nodes = [] } = diagram.data
  return (
    <div className="px-1 py-2">
      {root && <p className="mb-1 font-mono text-sm font-semibold">{root}</p>}
      <ul className="ml-1 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
        {nodes.map((node, index) => (
          <TreeBranch key={`${node.label}-${index}`} node={node} />
        ))}
      </ul>
    </div>
  )
}

function StackFigure({ diagram }: { diagram: Diagram }) {
  const { title, rows = [] } = diagram.data
  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers size={15} style={{ color: 'var(--accent)' }} />
          {title}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="grid grid-cols-1 gap-1 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(140px,0.4fr)_1fr] sm:gap-4"
            style={{
              borderColor: 'var(--border)',
              background: index % 2 ? 'var(--surface-2)' : 'var(--surface)',
            }}
          >
            <span className="text-sm font-semibold">{row.label}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {row.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelsFigure({ diagram }: { diagram: Diagram }) {
  const panels = diagram.data.panels ?? []
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {panels.map((panel, index) => (
        <div
          key={`${panel.title}-${index}`}
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          {panel.caption && (
            <p
              className="mb-1 text-[0.7rem] font-semibold tracking-wide uppercase"
              style={{ color: 'var(--accent)' }}
            >
              {panel.caption}
            </p>
          )}
          <p className="text-sm font-semibold">{panel.title}</p>
          <ul className="mt-2 space-y-1">
            {panel.lines.map((line, i) => (
              <li key={i} className="text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CalloutFigure({ diagram }: { diagram: Diagram }) {
  const { title, body = [] } = diagram.data
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold">{title}</p>}
      <div className="space-y-1.5">
        {body.map((item, index) => {
          if (item.kind === 'heading') {
            return (
              <p
                key={index}
                className="pt-2 text-[0.72rem] font-semibold tracking-wide uppercase first:pt-0"
                style={{ color: 'var(--accent)' }}
              >
                {item.text}
              </p>
            )
          }
          if (item.kind === 'bullet') {
            return (
              <p key={index} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>{item.text}</span>
              </p>
            )
          }
          return (
            <p key={index} className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {item.text}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function AsciiFigure({ diagram }: { diagram: Diagram }) {
  return (
    <pre
      className="overflow-x-auto rounded-xl p-4 font-mono text-[0.72rem] leading-[1.45]"
      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
    >
      {diagram.source_ascii}
    </pre>
  )
}

function Body({ diagram }: { diagram: Diagram }) {
  switch (diagram.fmt) {
    case 'mermaid':
      return <MermaidFigure source={diagram.mermaid} />
    case 'svg':
      return <div className="mermaid-figure" dangerouslySetInnerHTML={{ __html: diagram.svg }} />
    case 'tree':
      return <TreeFigure diagram={diagram} />
    case 'stack':
      return <StackFigure diagram={diagram} />
    case 'panels':
      return <PanelsFigure diagram={diagram} />
    case 'callout':
      return <CalloutFigure diagram={diagram} />
    default:
      return <AsciiFigure diagram={diagram} />
  }
}

export function DiagramView({ diagram }: { diagram: Diagram | undefined }) {
  const [zoomed, setZoomed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!zoomed) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setZoomed(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  if (!diagram) return null
  const zoomable = diagram.fmt === 'mermaid' || diagram.fmt === 'svg'

  return (
    <>
      <figure
        className="group relative my-6 overflow-hidden rounded-2xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {diagram.title && (
          <figcaption className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span
              className="inline-block h-4 w-1 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            {diagram.title}
          </figcaption>
        )}
        <div className="overflow-x-auto">
          <Body diagram={diagram} />
        </div>
        {diagram.caption && (
          <p className="mt-3 text-[0.82rem]" style={{ color: 'var(--text-muted)' }}>
            {diagram.caption}
          </p>
        )}
        {zoomable && (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Agrandir le schéma"
            className="absolute top-3 right-3 rounded-lg border p-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <Maximize2 size={14} />
          </button>
        )}
      </figure>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label={diagram.title || 'Schéma'}
        >
          <div
            ref={dialogRef}
            className="relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl p-6"
            style={{ background: 'var(--surface)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Fermer"
              className="absolute top-4 right-4 rounded-lg border p-1.5"
              style={{ borderColor: 'var(--border)' }}
            >
              <X size={16} />
            </button>
            {diagram.title && <h3 className="mb-4 pr-10 font-semibold">{diagram.title}</h3>}
            <Body diagram={diagram} />
          </div>
        </div>
      )}
    </>
  )
}
