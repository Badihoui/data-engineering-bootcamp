/**
 * ⌘K / Ctrl-K palette host.
 *
 * Always mounted but nearly weightless: it owns the shortcut and downloads the
 * palette (cmdk, search) only the first time it is opened.
 */

import { Suspense, lazy, useEffect, useState } from 'react'

const PaletteBody = lazy(() =>
  import('./CommandPaletteBody').then((m) => ({ default: m.PaletteBody })),
)

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setEverOpened(true)
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!everOpened) return null
  return (
    <Suspense fallback={null}>
      <PaletteBody open={open} setOpen={setOpen} />
    </Suspense>
  )
}
