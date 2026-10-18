import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()) })
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(9000)
const sel = page.locator('select').first()
await sel.selectOption({ label: '极致画质' })
await page.waitForTimeout(6000)
await page.screenshot({ path: 'shots/quality-ultra.png' })
console.log('ultra screenshot saved')
await browser.close()
