// Verifies the GitHub Pages build of the Studio, served under /freshed/ like Pages does.
// Usage: pnpm --filter @freshed/studio build:pages && node scripts/verify-pages.mjs
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { serve } from './screenshots.mjs'

const BASE = 'http://localhost:4181/freshed/'
const server = await serve(4181)
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const checks = []
const check = async (name, fn) => {
  await fn()
  checks.push(name)
  console.log(`  ok  ${name}`)
}

try {
  await check('loads at /freshed/ with demo banner and repo link', async () => {
    await page.goto(`${BASE}?fresh`)
    await page.getByText('Demo mode.').waitFor()
    const href = await page.getByRole('link', { name: 'Self-host freshed' }).getAttribute('href')
    assert.equal(href, 'https://github.com/mauriciomsouza/freshed')
  })

  await check('deep link to a flow works (hash routing)', async () => {
    await page.goto(`${BASE}?fresh#/flows/onboarding`)
    await page.getByText('Every event has an edge').waitFor()
  })

  await check('clicking through the onboarding in the phone follows edges to the end', async () => {
    const phone = page.locator('.phone-body')
    await phone.getByText('Get started', { exact: true }).click()
    await phone.getByText('How do you take your coffee?').waitFor()
    await phone.getByText('Continue', { exact: true }).click()
    await phone.getByText('How often should we deliver?').waitFor()
    await phone.getByText('Back', { exact: true }).click()
    await phone.getByText('How do you take your coffee?').waitFor()
    await phone.getByText('Continue', { exact: true }).click()
    await phone.getByText('Continue', { exact: true }).click()
    await phone.getByText('Start brewing', { exact: true }).click()
    await page.getByText('Flow ended').waitFor()
  })

  await check('editing a screen updates the preview and marks it unpublished', async () => {
    await page.goto(`${BASE}?fresh#/screens/welcome`)
    await page.getByRole('treeitem').filter({ hasText: 'Fresh beans' }).click()
    const title = page.locator('.inspector input.input').nth(1)
    await title.fill('Coffee that shows up fresh')
    await page.locator('.phone-body').getByText('Coffee that shows up fresh').waitFor()
    await page.getByText('1 unpublished').waitFor()
  })

  await check('edits persist across reloads (localStorage)', async () => {
    await page.waitForTimeout(500)
    await page.goto(`${BASE}#/screens/welcome`)
    await page.locator('.phone-body').getByText('Coffee that shows up fresh').waitFor()
  })

  await check('publish creates v4, rollback creates v5 from v1', async () => {
    await page.goto(`${BASE}#/publish`)
    await page.getByLabel('What changed').fill('New welcome title')
    await page.getByRole('button', { name: 'Publish v4' }).click()
    await page.getByText('Published v4').waitFor()
    await page
      .locator('.timeline li')
      .filter({ hasText: 'Initial onboarding' })
      .getByRole('button', { name: 'Roll back' })
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Roll back' }).click()
    await page.getByText('Rolled back. v5 is live.').waitFor()
    assert.equal(await page.locator('.timeline li').count(), 5)
  })

  await check('playground renders unknown components as a fallback', async () => {
    await page.goto(`${BASE}#/playground`)
    await page.locator('.phone-body').getByText('Unknown component “Countdown”').waitFor()
  })

  await check(
    'AI panel: disabled without a key, pre-recorded example renders and saves drafts',
    async () => {
      await page.goto(`${BASE}?fresh#/ai`)
      assert.equal(await page.getByRole('button', { name: 'Generate drafts' }).isDisabled(), true)
      await page.getByRole('button', { name: 'Show an example' }).click()
      await page.locator('.phone-body').getByText('BREW-ANA5').waitFor()
      await page.getByRole('button', { name: 'Save as draft' }).click()
      await page.getByText('Saved as draft. Nothing is published yet.').waitFor()
      await page.goto(`${BASE}#/flows/onboarding`)
      await page.locator('.edge-table').getByText('Give a bag, get a bag').first().waitFor()
    },
  )

  await check('unknown paths fall back to the app via 404.html', async () => {
    const res = await page.goto(`${BASE}some/deep/path`)
    assert.equal(res.status(), 404)
    await page.getByText('Demo mode.').waitFor()
  })

  assert.deepEqual(errors, [], `page errors: ${errors.join('\n')}`)
  console.log(`\n${checks.length} checks passed`)
} finally {
  await browser.close()
  server.close()
}
