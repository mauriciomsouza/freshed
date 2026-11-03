// Captures Studio screenshots for docs/design/screens with Playwright.
// Usage: pnpm --filter @freshed-cms/studio build:pages && node scripts/screenshots.mjs
// Serves apps/studio/dist-pages under /freshed/ exactly like GitHub Pages.
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'apps/studio/dist-pages')
const out = join(root, 'docs/design/screens')
const BASE = '/freshed/'
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

export function serve(port = 4180) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404).end('Not under /freshed/')
      return
    }
    let rel = normalize(url.pathname.slice(BASE.length)).replace(/^(\.\.[/\\])+/, '')
    if (!rel || rel.endsWith('/')) rel += 'index.html'
    try {
      const body = await readFile(join(dist, rel))
      res
        .writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' })
        .end(body)
    } catch {
      // GitHub Pages serves 404.html for unknown paths; we ship a copy of index.html there.
      const body = await readFile(join(dist, '404.html')).catch(() => null)
      res.writeHead(404, { 'content-type': 'text/html' }).end(body ?? 'Not found')
    }
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}

async function main() {
  await mkdir(out, { recursive: true })
  const server = await serve()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  })
  const shots = [
    { name: 'screens-editor', hash: '#/screens/welcome', theme: 'light' },
    { name: 'screens-editor-dark', hash: '#/screens/welcome', theme: 'dark' },
    {
      name: 'flow-graph',
      hash: '#/flows/onboarding',
      theme: 'light',
      clicks: ['Get started', 'Bright & fruity'],
    },
    {
      name: 'device-preview',
      hash: '#/screens/taste',
      theme: 'light',
      device: 'android-compact',
      safeArea: true,
    },
    {
      name: 'device-preview-dark',
      hash: '#/screens/taste',
      theme: 'dark',
      device: 'android-compact',
      safeArea: true,
    },
    { name: 'playground', hash: '#/playground', theme: 'light' },
    { name: 'version-history', hash: '#/publish', theme: 'light', edit: true },
    { name: 'components', hash: '#/components/Card', theme: 'light' },
    { name: 'ai-panel', hash: '#/ai', theme: 'light', ai: true },
    { name: 'ai-panel-dark', hash: '#/ai', theme: 'dark', ai: true },
  ]
  const only = process.argv[2]
  for (const shot of shots.filter((s) => !only || s.name === only)) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: shot.theme,
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => console.error(`[${shot.name}]`, e.message))
    await page.goto(`http://localhost:4180${BASE}?fresh${shot.hash}`)
    await page.waitForSelector('.shell')
    await page.evaluate(() => document.fonts.ready)
    if (shot.edit) {
      await page.goto(`http://localhost:4180${BASE}?fresh#/screens/welcome`)
      await page.getByRole('treeitem').filter({ hasText: 'Fresh beans' }).click()
      await page.getByLabel('title', { exact: false }).first().waitFor()
      const input = page.locator('.inspector input.input').nth(1)
      await input.fill('Fresh beans, every other week')
      await page.waitForTimeout(600)
      await page.goto(`http://localhost:4180${BASE}?fresh${shot.hash}`)
      await page.waitForSelector('.timeline')
    }
    if (shot.device) {
      await page.getByLabel('Device', { exact: true }).selectOption(shot.device)
    }
    if (shot.safeArea) await page.getByRole('button', { name: 'Safe area' }).click()
    for (const label of shot.clicks ?? []) {
      await page.locator('.phone-body').getByText(label, { exact: true }).click()
      await page.waitForTimeout(150)
    }
    if (shot.ai) {
      await page.getByRole('button', { name: 'Show an example' }).click()
      await page.waitForSelector('.ai-summary', { timeout: 10000 })
    }
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(out, `${shot.name}.png`) })
    console.log(`saved docs/design/screens/${shot.name}.png`)
    await context.close()
  }
  await browser.close()
  server.close()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
