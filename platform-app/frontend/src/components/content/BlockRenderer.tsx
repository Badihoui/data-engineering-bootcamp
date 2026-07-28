import { useState } from 'react'
import { ChevronRight, Lightbulb } from 'lucide-react'

import { CodeBlock } from './CodeBlock'
import { DiagramView } from './DiagramView'
import { Markdown } from './Markdown'
import type { Block, Diagram } from '@/lib/types'

function Solution({
  block,
  diagrams,
  origin,
}: {
  block: Block
  diagrams: Record<string, Diagram>
  origin?: { label: string; path: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="my-5 overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition hover:opacity-80"
      >
        <Lightbulb size={15} style={{ color: 'var(--accent)' }} />
        <span className="flex-1">{block.summary ?? 'Solution'}</span>
        <ChevronRight
          size={15}
          className="transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none', color: 'var(--text-muted)' }}
        />
      </button>
      {open && (
        <div className="animate-rise border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <BlockRenderer blocks={block.children ?? []} diagrams={diagrams} origin={origin} />
        </div>
      )}
    </div>
  )
}

export function BlockRenderer({
  blocks,
  diagrams,
  origin,
}: {
  blocks: Block[]
  diagrams: Record<string, Diagram>
  /** Passed down so the workshop can link back to this lesson. */
  origin?: { label: string; path: string }
}) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'markdown':
            return <Markdown key={index}>{block.md ?? ''}</Markdown>
          case 'code':
            return (
              <CodeBlock key={index} code={block.code ?? ''} lang={block.lang} origin={origin} />
            )
          case 'exercise':
            return (
              <CodeBlock key={index} code={block.code ?? ''} lang={block.lang} variant="exercise" />
            )
          case 'diagram':
            return <DiagramView key={index} diagram={diagrams[block.key ?? '']} />
          case 'solution':
            return <Solution key={index} block={block} diagrams={diagrams} origin={origin} />
          default:
            return null
        }
      })}
    </>
  )
}
