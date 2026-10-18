import * as THREE from 'three'
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import {
  WATER_Y,
  terrainColor,
  terrainHeight,
  beachAmount,
  sampleTerrain,
} from '../src/lib/terrain'

const N = 700
const png = new PNG({ width: N, height: N })
const c = new THREE.Color()

for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1) - 0.5) * 10
    const z = (j / (N - 1) - 0.5) * 10
    const s = sampleTerrain(x, z)
    terrainColor(x, z, s.height, s.ny, c, beachAmount(x, z, s.height))
    let r = c.r ** (1 / 2.2)
    let g = c.g ** (1 / 2.2)
    let b = c.b ** (1 / 2.2)
    const depth = WATER_Y - s.height
    if (depth > 0) {
      const t = Math.min(1, depth / 2.6)
      // fake water colour
      const wr = 0.27, wg = 0.86, wb = 0.78
      const dr = 0.04, dg = 0.35, db = 0.44
      const wc = [
        wr + (dr - wr) * t,
        wg + (dg - wg) * t,
        wb + (db - wb) * t,
      ]
      const alpha = 0.42 + 0.5 * Math.min(1, depth / 1.7)
      r = wc[0] * alpha + r * (1 - alpha)
      g = wc[1] * alpha + g * (1 - alpha)
      b = wc[2] * alpha + b * (1 - alpha)
    }
    // contour lines every 0.25m, waterline in white
    const contour = Math.abs((s.height * 4) % 1) < 0.04
    if (contour) {
      r *= 0.8; g *= 0.8; b *= 0.8
    }
    const idx = (j * N + i) * 4
    png.data[idx] = Math.max(0, Math.min(255, Math.round(r * 255)))
    png.data[idx + 1] = Math.max(0, Math.min(255, Math.round(g * 255)))
    png.data[idx + 2] = Math.max(0, Math.min(255, Math.round(b * 255)))
    png.data[idx + 3] = 255
  }
}

writeFileSync('shots/terrain-map.png', PNG.sync.write(png))
console.log('wrote shots/terrain-map.png')
