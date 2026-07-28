/**
 * CPython in the browser via Pyodide.
 *
 * Loaded lazily from the CDN the first time the learner opens the Python tab —
 * it is ~10 MB, so it must never be part of the app bundle. stdout/stderr are
 * streamed back so long-running loops print progressively.
 */

const PYODIDE_VERSION = '0.28.0'
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

/* Pyodide ships no types; the surface we use is tiny. */
interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (names: string[]) => Promise<void>
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
  globals: { get: (name: string) => unknown }
  FS: {
    writeFile: (path: string, data: string, options?: { encoding: string }) => void
    mkdirTree: (path: string) => void
  }
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideRuntime>
  }
}

let runtimePromise: Promise<PyodideRuntime> | null = null
let loadedPackages = new Set<string>()

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Chargement de Pyodide impossible')),
      )
      if (window.loadPyodide) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Chargement de Pyodide impossible'))
    document.head.appendChild(script)
  })
}

export interface PythonOutput {
  stdout: string
  stderr: string
  result: string | null
  elapsedMs: number
}

export async function loadPython(onProgress?: (message: string) => void): Promise<PyodideRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      onProgress?.('Téléchargement de Pyodide…')
      await injectScript(`${PYODIDE_URL}pyodide.js`)
      if (!window.loadPyodide) throw new Error('Pyodide indisponible')
      onProgress?.('Démarrage de l’interpréteur…')
      const runtime = await window.loadPyodide({ indexURL: PYODIDE_URL })
      onProgress?.('Préparation de l’espace de travail…')
      await seedWorkspace(runtime)
      return runtime
    })()
  }
  return runtimePromise
}

/** Mirrors the terminal's CSV files so both playgrounds share a dataset. */
async function seedWorkspace(runtime: PyodideRuntime): Promise<void> {
  const { VENTES_CSV, CLIENTS_CSV } = await import('./pythonFixtures')
  runtime.FS.mkdirTree('/home/pyodide/data')
  runtime.FS.writeFile('/home/pyodide/data/ventes.csv', VENTES_CSV, { encoding: 'utf8' })
  runtime.FS.writeFile('/home/pyodide/data/clients.csv', CLIENTS_CSV, { encoding: 'utf8' })
}

export async function ensurePackages(
  packages: string[],
  onProgress?: (message: string) => void,
): Promise<void> {
  const runtime = await loadPython(onProgress)
  const missing = packages.filter((name) => !loadedPackages.has(name))
  if (!missing.length) return
  onProgress?.(`Installation de ${missing.join(', ')}…`)
  await runtime.loadPackage(missing)
  missing.forEach((name) => loadedPackages.add(name))
}

/** Packages referenced by an `import` in the snippet, that Pyodide ships. */
const AVAILABLE = ['numpy', 'pandas', 'matplotlib', 'scipy', 'sqlite3', 'pyarrow']

export function detectPackages(code: string): string[] {
  const found = new Set<string>()
  const regex = /^\s*(?:import|from)\s+([a-zA-Z_][\w.]*)/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(code))) {
    const root = match[1].split('.')[0]
    if (AVAILABLE.includes(root)) found.add(root)
  }
  return [...found]
}

export async function runPython(
  code: string,
  options: {
    onProgress?: (message: string) => void
    onStream?: (chunk: string, stream: 'stdout' | 'stderr') => void
  } = {},
): Promise<PythonOutput> {
  const packages = detectPackages(code)
  const runtime = await loadPython(options.onProgress)
  if (packages.length) await ensurePackages(packages, options.onProgress)

  let stdout = ''
  let stderr = ''
  runtime.setStdout({
    batched: (text) => {
      stdout += text
      options.onStream?.(text, 'stdout')
    },
  })
  runtime.setStderr({
    batched: (text) => {
      stderr += text
      options.onStream?.(text, 'stderr')
    },
  })

  const started = performance.now()
  let result: string | null = null
  try {
    const value = await runtime.runPythonAsync(code)
    if (value !== undefined && value !== null) result = String(value)
  } catch (error) {
    stderr += (error as Error).message
  }
  return { stdout, stderr, result, elapsedMs: performance.now() - started }
}

export function resetPythonRuntime(): void {
  runtimePromise = null
  loadedPackages = new Set()
}
