import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, PlayCircle, Terminal } from 'lucide-react'
import { tabForLanguage, useWorkshop } from '@/store/workshop'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import scala from 'highlight.js/lib/languages/scala'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

/* Only the languages the bootcamp actually uses — keeps the bundle small. */
const LANGUAGES = {
  bash,
  shell: bash,
  sh: bash,
  dockerfile,
  ini,
  toml: ini,
  java,
  javascript,
  js: javascript,
  json,
  plaintext,
  text: plaintext,
  python,
  py: python,
  scala,
  sql,
  typescript,
  ts: typescript,
  xml,
  html: xml,
  yaml,
  yml: yaml,
} as const

for (const [name, definition] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, definition)
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  bash: 'Bash',
  shell: 'Shell',
  sh: 'Shell',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  json: 'JSON',
  dockerfile: 'Dockerfile',
  scala: 'Scala',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  text: 'Texte',
}

function highlight(code: string, lang: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code, ['python', 'bash', 'sql', 'yaml', 'json']).value
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
  }
}

export function CodeBlock({
  code,
  lang = 'text',
  variant = 'code',
  origin,
}: {
  code: string
  lang?: string
  variant?: 'code' | 'exercise'
  /** Where this snippet lives, so the workshop can offer a way back. */
  origin?: { label: string; path: string }
}) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const send = useWorkshop((s) => s.send)
  const label = LANGUAGE_LABELS[lang] ?? lang.toUpperCase()
  const tab = tabForLanguage(lang)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const practise = () => {
    if (!tab) return
    send({ tab, code, origin })
    navigate('/app/atelier')
  }

  return (
    <div
      className="my-5 overflow-hidden rounded-xl border"
      style={{
        borderColor: variant === 'exercise' ? 'var(--accent)' : 'var(--border)',
        background: '#0d1320',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{ borderColor: '#1e2739', background: '#111726' }}
      >
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-slate-400 uppercase">
          <Terminal size={12} />
          {variant === 'exercise' ? `Exercice · ${label}` : label}
        </span>
        <span className="flex items-center gap-1">
          {tab && (
            <button
              type="button"
              onClick={practise}
              title="Ouvrir ce code dans l'atelier"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] transition hover:bg-white/5"
              style={{ color: '#38bdf8' }}
            >
              <PlayCircle size={12} />
              S'entraîner
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 text-[0.82rem] leading-[1.6]">
        <code
          className="hljs font-mono"
          dangerouslySetInnerHTML={{ __html: highlight(code, lang) }}
        />
      </pre>
    </div>
  )
}
