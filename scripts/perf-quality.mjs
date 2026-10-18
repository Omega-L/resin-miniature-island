import { chromium } from 'playwright-core'

const width = 2117, height = 1271
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(9000)
const sel = page.locator('select').first()
await sel.selectOption({ label: '完整玻璃 30 帧' })
await page.waitForTimeout(5000)
const result = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas')
  let frames = 0
  const start = performance.now()
  await new Promise((resolve) => {
    const tick = () => {
      frames++
      if (performance.now() - start < 3000) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  return { fps: (frames / (performance.now() - start)) * 1000, frames, canvas: { w: canvas.width, h: canvas.height } }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
