import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

import { CodeBlock } from './CodeBlock'

/** The notebooks embed some raw HTML; allow the safe subset only. */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'align'],
  },
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          table: ({ children }) => (
            <div className="my-5 -mx-1 overflow-x-auto px-1">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const text = String(children).replace(/\n$/, '')
            const match = /language-(\w+)/.exec(className ?? '')
            if (!match && !text.includes('\n')) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return <CodeBlock code={text} lang={match?.[1] ?? 'text'} />
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
