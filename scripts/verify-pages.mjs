// Verifies the GitHub Pages build of the Studio, served under /freshed/ like Pages does.
// Usage: pnpm --filter @freshed-cms/studio build:pages && node scripts/verify-pages.mjs
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

  await check('layers: drag and drop reorders and nests, Alt+arrows change the level', async () => {
    await page.goto(`${BASE}?fresh#/screens/welcome`)
    const row = (text) => page.getByRole('treeitem').filter({ hasText: text })
    const levels = () =>
      page
        .getByRole('treeitem')
        .evaluateAll((els) =>
          els.map(
            (e) => `${e.getAttribute('aria-level')}:${e.querySelector('.tree-type').textContent}`,
          ),
        )
    await row('I already have').dragTo(row('Fresh beans'), { targetPosition: { x: 40, y: 3 } })
    assert.deepEqual((await levels()).slice(1, 3), ['2:Button', '2:Hero'])
    await page
      .locator('.palette .chip')
      .filter({ hasText: 'Card' })
      .dragTo(page.locator('.tree-end'))
    assert.equal((await levels()).at(-1), '2:Card')
    const card = page.getByRole('treeitem').last()
    const box = await card.boundingBox()
    await row('3 items').dragTo(card, { targetPosition: { x: 40, y: box.height / 2 } })
    assert.equal((await levels()).at(-1), '3:List')
    await page.getByText('Level 2 · in Card').waitFor()
    await row('3 items').focus()
    await page.keyboard.press('Alt+ArrowLeft')
    assert.equal((await levels()).at(-1), '2:List')
    await page.keyboard.press('Alt+ArrowUp')
    await page.keyboard.press('Alt+ArrowDown')
    await page.keyboard.press('Alt+ArrowRight')
    assert.equal((await levels()).at(-1), '3:List')
    await page.locator('.phone-body').getByText('I already have an account').waitFor()
  })

  await check(
    'layers keyboard: one tab stop, arrows focus, Enter selects, Alt+arrows move',
    async () => {
      await page.goto(`${BASE}?fresh#/screens/welcome`)
      const rows = page.getByRole('treeitem')
      const tabStops = () =>
        rows.evaluateAll((els) =>
          els.filter((e) => e.tabIndex === 0).map((e) => e.querySelector('.tree-type').textContent),
        )
      const focused = () =>
        page.evaluate(() => document.activeElement?.querySelector('.tree-type')?.textContent)
      const selected = () =>
        page.locator('[role="treeitem"][aria-selected="true"] .tree-type').textContent()
      assert.deepEqual(await tabStops(), ['Hero'])
      await rows.filter({ hasText: 'Fresh beans' }).focus()
      await page.keyboard.press('ArrowDown')
      assert.equal(await focused(), 'List')
      assert.equal(await selected(), 'Hero')
      await page.keyboard.press('Enter')
      assert.equal(await selected(), 'List')
      assert.deepEqual(await tabStops(), ['List'])
      // Alt+arrows on a row that is not selected select it, then move it.
      await page.keyboard.press('ArrowUp')
      const url = page.url()
      await page.keyboard.press('Alt+ArrowDown')
      assert.equal(await selected(), 'Hero')
      assert.equal(await focused(), 'Hero')
      assert.equal(await rows.nth(2).locator('.tree-type').textContent(), 'Hero')
      // A top-level layer cannot move out; Alt+Left must not reach the browser either.
      await page.keyboard.press('Alt+ArrowLeft')
      assert.equal(page.url(), url)
      await page.getByText('Level 1 · in Stack').waitFor()
    },
  )

  await check('palette: adding every component keeps the preview rendered', async () => {
    await page.goto(`${BASE}?fresh#/screens/welcome`)
    const chips = page.locator('.palette .chip')
    const rows = page.getByRole('treeitem')
    const count = await chips.count()
    assert.ok(count >= 8, `expected the Brew components in the palette, got ${count}`)
    for (let i = 0; i < count; i++) {
      const name = await chips.nth(i).evaluate((e) => e.lastChild.textContent)
      const before = await rows.count()
      await chips.nth(i).click()
      assert.equal(await rows.count(), before + 1, `${name} was not added`)
      await page.waitForTimeout(100)
      assert.deepEqual(errors, [], `page errors after adding ${name}`)
      assert.equal(await page.locator('.phone-error').count(), 0, `${name} broke the preview`)
      await page.locator('.phone-body').getByText('Fresh beans').waitFor()
    }
  })

  await check('device bar sets resolution, aspect ratio, orientation and safe area', async () => {
    await page.goto(`${BASE}?fresh#/screens/welcome`)
    const frame = page.getByRole('region', { name: 'Preview of Welcome' })
    const size = () => frame.evaluate((e) => [e.offsetWidth, e.offsetHeight])
    assert.deepEqual(await size(), [393 + 24, 852 + 24])
    await page.getByLabel('Device', { exact: true }).selectOption('android-compact')
    assert.deepEqual(await size(), [360 + 24, 800 + 24])
    await page.getByRole('button', { name: 'Landscape' }).click()
    assert.deepEqual(await size(), [800 + 24, 360 + 24])
    await page.getByRole('button', { name: 'Landscape' }).click()
    await page.getByLabel('Aspect ratio').selectOption('16:9')
    assert.equal(await page.getByLabel('Height in points').inputValue(), '640')
    await page.getByRole('button', { name: 'Safe area' }).click()
    await frame.locator('.safe-band').first().waitFor()
    await page.getByLabel('Device', { exact: true }).selectOption('ios-standard')
    await page.getByRole('button', { name: 'Safe area' }).click()
    assert.equal(await frame.locator('.safe-band').count(), 0)
  })

  await check('playground layers edit the JSON', async () => {
    await page.goto(`${BASE}#/playground`)
    const row = (text) => page.getByRole('treeitem').filter({ hasText: text })
    await row('Send an action').dragTo(row('Edit this JSON'), { targetPosition: { x: 40, y: 3 } })
    const json = JSON.parse(await page.getByLabel('Screen JSON').inputValue())
    assert.equal(json.root.children[0].type, 'Button')
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
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
