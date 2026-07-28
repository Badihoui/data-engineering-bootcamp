import { describe, expect, it } from 'vitest'

import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  GLOSSARY,
  searchGlossary,
  type Category,
} from './glossary'

describe('contenu du glossaire', () => {
  it('couvre toutes les catégories annoncées', () => {
    const used = new Set(GLOSSARY.map((entry) => entry.category))
    for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
      expect(used.has(category), `aucune entrée pour « ${category} »`).toBe(true)
    }
  })

  it('donne un libellé et une couleur à chaque catégorie', () => {
    for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
      expect(CATEGORY_LABELS[category]).toBeTruthy()
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("n'a aucun terme en double", () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase())
    expect(new Set(terms).size).toBe(terms.length)
  })

  it('donne une définition substantielle à chaque terme', () => {
    for (const entry of GLOSSARY) {
      expect(entry.definition.length, entry.term).toBeGreaterThan(40)
    }
  })

  it('ne renvoie que vers des modules du programme', () => {
    for (const entry of GLOSSARY) {
      if (entry.moduleNumber === undefined) continue
      expect(entry.moduleNumber, entry.term).toBeGreaterThanOrEqual(1)
      expect(entry.moduleNumber, entry.term).toBeLessThanOrEqual(35)
    }
  })
})

describe('recherche dans le glossaire', () => {
  it('rend tout le glossaire pour une requête vide', () => {
    expect(searchGlossary(GLOSSARY, '')).toHaveLength(GLOSSARY.length)
    expect(searchGlossary(GLOSSARY, '   ')).toHaveLength(GLOSSARY.length)
  })

  it('trouve par terme, sans tenir compte de la casse', () => {
    const found = searchGlossary(GLOSSARY, 'SHUFFLE')
    expect(found.some((entry) => entry.term === 'Shuffle')).toBe(true)
  })

  it('trouve par alias', () => {
    const found = searchGlossary(GLOSSARY, 'medallion')
    expect(found.some((entry) => entry.term === 'Architecture médaillon')).toBe(true)
  })

  it('trouve dans le corps de la définition', () => {
    const found = searchGlossary(GLOSSARY, 'redistribution')
    expect(found.some((entry) => entry.term === 'Shuffle')).toBe(true)
  })

  it('trouve dans la nuance', () => {
    const found = searchGlossary(GLOSSARY, 'data swamp')
    expect(found.some((entry) => entry.term === 'Data Lake')).toBe(true)
  })

  it('renvoie une liste vide quand rien ne correspond', () => {
    expect(searchGlossary(GLOSSARY, 'zzzzznexistepas')).toEqual([])
  })
})
