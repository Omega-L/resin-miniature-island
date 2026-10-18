import { chromium } from 'playwright-core'

const width = Number(process.argv[2] || 1440)
const height = Number(process.argv[3] || 900)
const out = process.argv[4] || 'shots/desktop.png'
const mobile = width < 800

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
})
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 }).catch((e) => console.log('goto:', e.message))
await page.waitForTimeout(12000)
await page.mouse.move(width * 0.62, height * 0.4)
await page.waitForTimeout(1200)
await page.screenshot({ path: out })
console.log('saved', out)
await browser.close()
