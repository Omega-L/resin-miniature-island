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
const selects = page.locator('select')
console.log('select count', await selects.count())
for (let i = 0; i < (await selects.count()); i++) {
  console.log(i, await selects.nth(i).evaluate((el) => el.outerHTML.slice(0, 200)))
}
const q = selects.first()
if (await q.count()) {
  await q.selectOption({ label: '完整玻璃 30 帧' })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'shots/quality-full.png' })
  console.log('full screenshot saved')
}
await browser.close()
