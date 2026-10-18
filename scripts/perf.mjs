import { chromium } from 'playwright-core'

const width = Number(process.argv[2] || 1440)
const height = Number(process.argv[3] || 900)
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=default', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(10000)
const result = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'
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
  const elapsed = performance.now() - start
  return { renderer, fps: (frames / elapsed) * 1000, frames, elapsed, canvas: { w: canvas.width, h: canvas.height }, dpr: window.devicePixelRatio }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
