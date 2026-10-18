import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 2117, height: 1271 }, deviceScaleFactor: 1.5 })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()) })
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(10000)
let dark = 0
for (let i = 0; i < 24; i++) {
  const buf = await page.screenshot()
  const png = PNG.sync.read(buf)
  // canvas is the big right-hand region; sample its center-right
  let sum = 0
  let n = 0
  for (let y = 100; y < png.height - 100; y += 40) {
    for (let x = Math.floor(png.width * 0.35); x < png.width - 350; x += 40) {
      const idx = (y * png.width + x) * 4
      sum += (png.data[idx] + png.data[idx + 1] + png.data[idx + 2]) / 3
      n++
    }
  }
  const mean = sum / n
  if (mean < 40) { dark++; console.log('DARK frame', i, mean.toFixed(1)) }
  else if (i % 6 === 0) console.log('frame', i, mean.toFixed(1))
  await page.waitForTimeout(180)
}
console.log('dark frames:', dark)
await browser.close()
