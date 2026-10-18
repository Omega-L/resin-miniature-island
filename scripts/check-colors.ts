import * as THREE from 'three'
import { terrainColor, terrainHeight, sampleTerrain } from '../src/lib/terrain'
const c = new THREE.Color()
for (const [x, z] of [[0,0],[2,2],[-1,1],[-4,2],[0,-2],[3,-3]]) {
  const s = sampleTerrain(x, z)
  terrainColor(x, z, s.height, s.ny, c)
  console.log(x, z, 'h', s.height.toFixed(2), 'ny', s.ny.toFixed(2), 'color', c.getHexString(), c.toArray().map(v=>v.toFixed(2)))
}
