import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=default', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(10000)
// sweep across the water, then screenshot immediately
for (let i = 0; i <= 24; i++) {
  await page.mouse.move(700 + i * 12, 480 + Math.sin(i * 0.5) * 40)
  await page.waitForTimeout(30)
}
await page.waitForTimeout(150)
await page.screenshot({ path: 'shots/ripple.png' })
// jelly: park the mouse top-right and let it settle
await page.mouse.move(1150, 250)
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/jelly.png' })
await browser.close()
console.log('saved ripple + jelly')
