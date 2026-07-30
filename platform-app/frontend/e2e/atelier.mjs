/**
 * Test de bout en bout dans un vrai navigateur.
 *
 * Couvre ce qu'aucun test unitaire ne voit : le terminal xterm doit être
 * *interactif* dès le premier affichage, sans rechargement de page. Le bug
 * d'origine — `fit()` appelé avant que l'hôte ait des dimensions — laissait une
 * bannière lisible mais un terminal qui n'acceptait aucune frappe.
 *
 * Prérequis : l'application accessible, et le compte de test existant.
 *
 *   npx playwright install chromium
 *   npm install --no-save playwright
 *   BASE=http://localhost:8010 SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run test:e2e
 */

import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:8010'
const CREDS = {
  email: process.env.SMOKE_EMAIL ?? 'demo@bootcamp.dev',
  password: process.env.SMOKE_PASSWORD ?? 'changeme-en-developpement',
}

const results = []
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

/** Le terminal est vivant si xterm a peint un écran de taille non nulle. */
async function terminalIsAlive(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('.xterm-screen')
    if (!screen) return { present: false }
    const { width, height } = screen.getBoundingClientRect()
    const text = document.querySelector('.xterm-rows')?.textContent ?? ''
    return { present: true, width, height, hasBanner: text.includes('bootcamp') }
  })
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))

try {
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.fill('#email', CREDS.email)
  await page.fill('#password', CREDS.password)
  await page.click('button[type=submit]')
  await page.waitForURL('**/app', { timeout: 15000 })
  check('connexion et arrivée sur le tableau de bord', true)

  // --------------------------------- 1er passage : clic sur « Atelier »
  await page.click('nav a[href="/app/atelier"]')
  await page.waitForURL('**/app/atelier', { timeout: 10000 })

  // On attend le terminal SANS jamais recharger : c'est tout l'enjeu.
  let alive = { present: false }
  for (let i = 0; i < 50; i++) {
    alive = await terminalIsAlive(page)
    if (alive.present && alive.height > 50 && alive.hasBanner) break
    await page.waitForTimeout(200)
  }
  check(
    'terminal affiché au premier clic, sans rechargement',
    alive.present && alive.height > 50 && alive.hasBanner,
    JSON.stringify(alive),
  )
  check(
    'la coquille (barre latérale) a survécu au chargement du chunk',
    (await page.locator('nav a[href="/app/atelier"]').count()) > 0,
  )

  await page.click('.xterm-screen')
  await page.keyboard.type('pwd')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const afterPwd = await page.evaluate(
    () => document.querySelector('.xterm-rows')?.textContent ?? '',
  )
  check('la commande pwd répond /home/de', afterPwd.includes('/home/de'), afterPwd.slice(-90))

  // --------------------------- 2e passage : quitter puis revenir
  await page.click('nav a[href="/app/glossaire"]')
  await page.waitForURL('**/app/glossaire', { timeout: 10000 })
  await page.waitForTimeout(600)
  check('navigation vers le glossaire', page.url().endsWith('/app/glossaire'))

  await page.click('nav a[href="/app/atelier"]')
  await page.waitForURL('**/app/atelier', { timeout: 10000 })
  alive = { present: false }
  for (let i = 0; i < 50; i++) {
    alive = await terminalIsAlive(page)
    if (alive.present && alive.height > 50 && alive.hasBanner) break
    await page.waitForTimeout(200)
  }
  check(
    'terminal réaffiché au retour, sans rechargement',
    alive.present && alive.height > 50 && alive.hasBanner,
    JSON.stringify(alive),
  )

  // ------------------------------------- onglets SQL puis retour terminal
  await page.getByRole('button', { name: /SQL/ }).first().click({ force: true })
  await page.waitForTimeout(3000)
  const sqlReady = await page.evaluate(
    () => !document.body.textContent.includes('Chargement de SQLite'),
  )
  check('onglet SQL chargé (SQLite WebAssembly)', sqlReady)

  await page.getByRole('button', { name: /Terminal/ }).first().click({ force: true })
  alive = { present: false }
  for (let i = 0; i < 40; i++) {
    alive = await terminalIsAlive(page)
    if (alive.present && alive.height > 50) break
    await page.waitForTimeout(200)
  }
  check('retour à l’onglet Terminal', alive.present && alive.height > 50, JSON.stringify(alive))

  // ------------------------------ autres routes paresseuses, même piège
  for (const [label, href] of [
    ['révision', '/app/revision'],
    ['réussites', '/app/reussites'],
    ['bibliothèque', '/app/bibliotheque'],
    ['modules', '/app/modules'],
  ]) {
    await page.click(`nav a[href="${href}"]`)
    await page.waitForURL(`**${href}`, { timeout: 10000 })
    await page.waitForTimeout(800)
    const shellOk = (await page.locator('nav a[href="/app/atelier"]').count()) > 0
    const hasContent = (await page.locator('main h1').count()) > 0
    check(`route « ${label} » : contenu affiché et coquille intacte`, shellOk && hasContent)
  }

  check('aucune erreur console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
} catch (error) {
  console.log(`\n⚠️  interruption du harnais : ${String(error).split('\n')[0]}`)
} finally {
  await page.screenshot({ path: process.env.SCREENSHOT ?? 'atelier.png' }).catch(() => {})
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log()
if (failed.length) {
  console.log(`❌ ${failed.length}/${results.length} vérification(s) en échec`)
  process.exit(1)
}
console.log(`✅ ${results.length} vérifications passent`)
