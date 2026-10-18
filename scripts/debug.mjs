import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 4000)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message, e.stack?.slice(0, 2000)))
page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText))
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(9000)
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  return {
    canvas: canvas ? { w: canvas.width, h: canvas.height, rect: canvas.getBoundingClientRect().toJSON() } : null,
    bg: getComputedStyle(document.body).backgroundColor,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
