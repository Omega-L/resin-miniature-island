import { terrainHeight, WATER_Y } from '../src/lib/terrain'
let max = -99, maxAt = { x: 0, z: 0 }, min = 99
for (let z = -5; z <= 5; z += 0.05) {
  for (let x = -5; x <= 5; x += 0.05) {
    const h = terrainHeight(x, z)
    if (h > max) { max = h; maxAt = { x, z } }
    if (h < min) min = h
  }
}
console.log({ max, maxAt, min, water: WATER_Y })
for (const p of [[-2.5,-2.5,0],[0,0,0],[2.5,2.5,0],[-1,1,0],[1.5,1.5,0],[0.5,0.8,0]]) {
  console.log(p, terrainHeight(p[0], p[1]))
}
