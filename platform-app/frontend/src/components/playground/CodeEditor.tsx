import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { sql, SQLite } from '@codemirror/lang-sql'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'

type Language = 'python' | 'sql' | 'javascript'

interface Props {
  value: string
  onChange: (value: string) => void
  language?: Language
  height?: string
  /** Table → columns map, feeds SQL autocompletion. */
  schema?: Record<string, string[]>
  /** Bound to Ctrl/Cmd + Enter. */
  onRun?: () => void
  readOnly?: boolean
}

const baseTheme = EditorView.theme({
  '&': { fontSize: '13px', background: '#0b1020' },
  '.cm-gutters': { background: '#0b1020', border: 'none', color: '#465878' },
  '.cm-activeLineGutter': { background: '#121a2e' },
  '.cm-activeLine': { background: '#101828' },
  '.cm-content': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", padding: '10px 0' },
  '.cm-scroller': { lineHeight: '1.6' },
  '&.cm-focused': { outline: 'none' },
})

export function CodeEditor({
  value,
  onChange,
  language = 'python',
  height = '260px',
  schema,
  onRun,
  readOnly = false,
}: Props) {
  const extensions = useMemo(() => {
    const list = [baseTheme, EditorView.lineWrapping]
    if (language === 'python') list.push(python())
    if (language === 'javascript') list.push(javascript({ typescript: true }))
    if (language === 'sql') list.push(sql({ dialect: SQLite, schema, upperCaseKeywords: true }))
    if (onRun) {
      list.push(
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              preventDefault: true,
              run: () => {
                onRun()
                return true
              },
            },
          ]),
        ),
      )
    }
    return list
  }, [language, schema, onRun])

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={extensions}
        editable={!readOnly}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightSelectionMatches: false,
        }}
      />
    </div>
  )
}
