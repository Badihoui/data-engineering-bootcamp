/**
 * SQLite compiled to WebAssembly, loaded on demand.
 *
 * The learner runs genuine SQL — joins, CTEs, window functions — against a
 * seeded database, entirely client-side. The wasm binary is copied to
 * `public/sql-wasm.wasm` by the `sync:wasm` npm script.
 */

import type { Database, SqlJsStatic } from 'sql.js'

import { DATASETS } from './datasets'

let enginePromise: Promise<SqlJsStatic> | null = null

async function getEngine(): Promise<SqlJsStatic> {
  if (!enginePromise) {
    enginePromise = import('sql.js').then((mod) =>
      (mod.default as unknown as (config: { locateFile: () => string }) => Promise<SqlJsStatic>)({
        locateFile: () => '/sql-wasm.wasm',
      }),
    )
  }
  return enginePromise
}

export interface QueryResult {
  columns: string[]
  rows: (string | number | null | Uint8Array)[][]
  rowsAffected: number
  elapsedMs: number
}

export class SqlSession {
  private db: Database | null = null
  datasetId: string

  constructor(datasetId = DATASETS[0].id) {
    this.datasetId = datasetId
  }

  async open(datasetId = this.datasetId): Promise<void> {
    const SQL = await getEngine()
    const dataset = DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0]
    this.db?.close()
    this.db = new SQL.Database()
    this.db.run(dataset.sql)
    this.datasetId = dataset.id
  }

  async reset(): Promise<void> {
    await this.open(this.datasetId)
  }

  /** Runs a script and returns the result of its last statement. */
  async exec(sql: string): Promise<QueryResult[]> {
    if (!this.db) await this.open()
    const db = this.db!
    const started = performance.now()
    const results = db.exec(sql)
    const elapsed = performance.now() - started

    if (results.length === 0) {
      return [
        {
          columns: [],
          rows: [],
          rowsAffected: db.getRowsModified(),
          elapsedMs: elapsed,
        },
      ]
    }
    return results.map((result) => ({
      columns: result.columns,
      rows: result.values as QueryResult['rows'],
      rowsAffected: db.getRowsModified(),
      elapsedMs: elapsed,
    }))
  }

  /** Table and column names for the editor's completion + schema panel. */
  async schema(): Promise<{ table: string; columns: { name: string; type: string }[] }[]> {
    if (!this.db) await this.open()
    const db = this.db!
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    if (!tables.length) return []
    return (tables[0].values as [string][]).map(([table]) => {
      const info = db.exec(`PRAGMA table_info(${table})`)
      const columns = info.length
        ? (info[0].values as [number, string, string][]).map(([, name, type]) => ({ name, type }))
        : []
      return { table, columns }
    })
  }

  close(): void {
    this.db?.close()
    this.db = null
  }
}
