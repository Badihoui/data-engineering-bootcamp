import { describe, expect, it } from 'vitest'

import { DATASETS } from './datasets'

describe('bases du playground SQL', () => {
  it('déclare au moins deux jeux de données', () => {
    expect(DATASETS.length).toBeGreaterThanOrEqual(2)
  })

  it('donne un identifiant unique à chaque base', () => {
    const ids = DATASETS.map((dataset) => dataset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('crée bien chaque table annoncée dans le panneau latéral', () => {
    for (const dataset of DATASETS) {
      for (const table of dataset.tables) {
        expect(dataset.sql, `${dataset.id} · ${table.name}`).toContain(`CREATE TABLE ${table.name}`)
      }
    }
  })

  it('insère des lignes dans chaque table', () => {
    for (const dataset of DATASETS) {
      for (const table of dataset.tables) {
        expect(dataset.sql, `${dataset.id} · ${table.name}`).toContain(
          `INSERT INTO ${table.name}`,
        )
      }
    }
  })

  it('annonce le bon nombre de lignes par table', () => {
    for (const dataset of DATASETS) {
      for (const table of dataset.tables) {
        // Les VALUES sont écrites une par ligne ou groupées : on compte les
        // tuples ouvrants du bloc INSERT correspondant.
        const start = dataset.sql.indexOf(`INSERT INTO ${table.name}`)
        const end = dataset.sql.indexOf(';', start)
        const block = dataset.sql.slice(start, end)
        const tuples = block.match(/\(\s*\d+/g) ?? []
        expect(tuples.length, `${dataset.id} · ${table.name}`).toBe(table.rows)
      }
    }
  })

  it('propose des requêtes d’exemple qui ciblent des tables existantes', () => {
    for (const dataset of DATASETS) {
      expect(dataset.samples.length).toBeGreaterThan(0)
      const names = dataset.tables.map((table) => table.name)
      for (const sample of dataset.samples) {
        expect(sample.title).toBeTruthy()
        const mentionsATable = names.some((name) => sample.query.includes(name))
        expect(mentionsATable, `${dataset.id} · ${sample.title}`).toBe(true)
      }
    }
  })

  it('termine chaque requête d’exemple par un point-virgule', () => {
    for (const dataset of DATASETS) {
      for (const sample of dataset.samples) {
        expect(sample.query.trim().endsWith(';'), `${dataset.id} · ${sample.title}`).toBe(true)
      }
    }
  })
})
