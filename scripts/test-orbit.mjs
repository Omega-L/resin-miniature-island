import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(9000)
await page.screenshot({ path: 'shots/orbit-before.png' })
// drag the canvas to orbit
await page.mouse.move(720, 520)
await page.mouse.down()
for (let i = 0; i <= 20; i++) {
  await page.mouse.move(720 + i * 11, 520 - i * 4)
  await page.waitForTimeout(25)
}
await page.mouse.up()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/orbit-after.png' })
console.log('orbit test done')
await browser.close()
