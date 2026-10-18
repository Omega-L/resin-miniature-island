import * as THREE from 'three'
import { clamp, fbm2, lerp, ridged2, smoothstep } from './noise'

/** Geometry lives in "block space": the resin block is 10×3×10 centred on the origin. */
export const BLOCK_SIZE = 10
export const BLOCK_HALF = 5
export const BLOCK_BOTTOM = -1.5
export const BLOCK_TOP = 1.5
export const BLOCK_RADIUS = 0.34
/** Water level = top of the resin pour. */
export const WATER_Y = 1.5
/** Sandy sea floor, a little above the bottom glass. */
export const SEABED_Y = -1.33
export const HEIGHT_MIN = -1.6
export const HEIGHT_MAX = 4.2

export const ISLAND_CENTER = { x: -2.05, z: -2.1 }

/** Soft pseudo-distance describing the island (with a carved bay). */
function islandField(x: number, z: number) {
  const dx = x - ISLAND_CENTER.x
  const dz = z - ISLAND_CENTER.z
  const warp = fbm2(x * 0.44 + 7.3, z * 0.44 - 1.9, 4, 2.05, 0.5, 3.1) * 0.88
  const warpFine = fbm2(x * 1.9 + 2.4, z * 1.9 - 7.2, 3, 2.1, 0.5, 17.9) * 0.3 + fbm2(x * 4.6 - 5.1, z * 4.6 + 3.3, 2, 2.0, 0.5, 23.4) * 0.1
  const r = Math.hypot(dx * 0.94, dz * 1.03) + warp + warpFine
  const land = 1 - smoothstep(3.1, 4.45, r)

  // A round bay bites into the seaward flank, producing a crescent beach.
  const bx = x - 0.6
  const bz = z - 0.6
  const bayWarp = fbm2(x * 0.8 - 2.2, z * 0.8 + 4.6, 2, 2.1, 0.5, 11.7) * 0.42
  const bayR = Math.hypot(bx * 0.92, bz * 1.0) + bayWarp
  const bay = 1 - smoothstep(1.55, 3.15, bayR)

  const carved = clamp(land * (1 - bay * 1.55), 0, 1)
  return { land: carved, bay, rawLand: land, bayR }
}


/** 0…1 mask and 0…1 progress for the sand tongue reaching into the lagoon. */
function sandSpit(x: number, z: number): { amount: number; t: number } {
  const ax = -0.15
  const az = 1.55
  const bx = 1.95
  const bz = 2.65
  const vx = bx - ax
  const vz = bz - az
  const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1)
  const px = ax + vx * t
  const pz = az + vz * t
  const d = Math.hypot(x - px, z - pz)
  const width = lerp(0.68, 0.34, t) + Math.sin(t * Math.PI) * 0.12
  const ridge = 1 - smoothstep(width * 0.45, width, d)
  const startFade = smoothstep(0.0, 0.14, t)
  return { amount: ridge * startFade, t }
}

/** Height of the sea bed / island at a block-space XZ position. */
export function terrainHeight(x: number, z: number): number {
  const bedNoise = fbm2(x * 0.5 + 3.4, z * 0.5 - 8.1, 3, 2.1, 0.52, 5.5) * 0.085
  const bedRipple =
    Math.sin(x * 1.9 + z * 0.65 + fbm2(x * 0.32, z * 0.32, 2, 2.0, 0.5, 9.1) * 3.2) * 0.014
  let bed = SEABED_Y + bedNoise + bedRipple
  const { land, bay, bayR } = islandField(x, z)

  // A shallow lagoon shelf rises towards the bay's beach.
  const shelf = smoothstep(1.05, 3.15, bayR) * bay
  bed += shelf * 2.0

  // Island mass: low ramp, steep cliff tier, then a plateau.
  const ramp = smoothstep(0.05, 0.34, land)
  const cliff = smoothstep(0.3, 0.68, land)
  const crown = smoothstep(0.63, 0.96, land)
  let elev = 3.9 * (0.2 * ramp + 0.5 * cliff + 0.3 * crown)

  // Rugged rock detail — strongest above the waterline.
  const rock = ridged2(x * 2.6 + 1.2, z * 2.6 - 4.6, 4, 2.1, 0.52, 6.7)
  const grain = fbm2(x * 4.4 - 3.0, z * 4.4 + 2.0, 3, 2.0, 0.5, 8.3)
  const above = smoothstep(0.02, 0.55, bed + elev - WATER_Y)
  elev += (rock - 0.45) * 1.15 * smoothstep(0.1, 0.45, land) * (0.3 + 0.7 * above)
  elev += grain * 0.16 * smoothstep(0.08, 0.5, land)

  // A few peaks break up the mesa silhouette.
  const peakMask = smoothstep(0.12, 0.5, land)
  const peak = (px: number, pz: number, radius: number, amount: number) =>
    amount * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (radius * radius))
  elev +=
    peakMask *
    (peak(-3.35, -3.4, 1.0, 0.55) +
      peak(-1.2, -3.45, 0.9, 0.35) +
      peak(-3.75, -1.2, 0.85, 0.42) +
      peak(-2.2, -2.1, 0.62, 0.25) +
      peak(-1.7, 0.9, 0.8, 0.5) +
      peak(0.55, -1.35, 0.75, 0.32))

  const baseRel = bed + elev - WATER_Y
  elev += Math.sin(elev * 8.0 + grain * 2.5) * 0.06 * smoothstep(0.2, 0.8, land) * smoothstep(0.0, 0.6, baseRel)

  let h = bed + elev

  // Beach shelf: flatten the shoreline inside the bay into a walkable sand crescent.
  // A wide dry sand shelf at the bay; shared mask with the colour pass.
  const flat = beachAmount(x, z, h)
  const beachY = WATER_Y + 0.28 + grain * 0.035
  h = lerp(h, beachY, flat * 0.97)

  // Sandy tongue that trails off the beach into the lagoon.
  const spit = sandSpit(x, z)
  if (spit.amount > 0.001) {
    const spitTop = WATER_Y - 0.18 + smoothstep(0.68, 1.0, spit.t) * 0.4
    h = Math.max(h, lerp(SEABED_Y + 0.35, spitTop, spit.amount))
  }

  // Gentle underwater dunes far from the island.
  h += (1 - smoothstep(0.0, 0.8, land)) * fbm2(x * 1.4 + 6, z * 1.4 + 6, 2, 2.0, 0.5, 15.3) * 0.035

  return h
}


/** 0…1 mask for the above-water part of the sand spit. */
export function spitBeach(x: number, z: number, h: number): number {
  const spit = sandSpit(x, z)
  return spit.amount * smoothstep(WATER_Y - 0.04, WATER_Y + 0.08, h)
}

/** 0…1 mask for the dry sand shelf around the bay. */
export function beachAmount(x: number, z: number, h: number): number {
  const { bay, bayR } = islandField(x, z)
  const bayness = smoothstep(0.0, 0.3, bay)
  const shore = smoothstep(WATER_Y - 0.12, WATER_Y + 0.1, h)
  const lowerSlope = 1 - smoothstep(WATER_Y + 3.0, WATER_Y + 6.8, h)
  const shoreFlat = bayness * shore * lowerSlope
  const beachBand =
    smoothstep(1.0, 1.35, bayR) *
    (1 - smoothstep(3.0, 3.35, bayR)) *
    shore *
    lowerSlope
  return Math.max(shoreFlat, beachBand)
}

export interface TerrainSample {
  height: number
  gx: number
  gz: number
  ny: number
}

/** Height + gradient, using forward differences (shared by colouring & placement). */
export function sampleTerrain(x: number, z: number, eps = 0.06): TerrainSample {
  const height = terrainHeight(x, z)
  const gx = (terrainHeight(x + eps, z) - height) / eps
  const gz = (terrainHeight(x, z + eps) - height) / eps
  const ny = 1 / Math.sqrt(gx * gx + 1 + gz * gz)
  return { height, gx, gz, ny }
}

const SAND_DEEP = new THREE.Color('#c2ae8a')
const SAND_UNDER = new THREE.Color('#dcc9a2')
const SAND_DRY = new THREE.Color('#faf0da')
const SAND_WET = new THREE.Color('#e2cfae')
const ROCK_LIGHT = new THREE.Color('#a49c8e')
const ROCK_DARK = new THREE.Color('#5f5b52')
const GRASS_DARK = new THREE.Color('#2f4b27')
const GRASS_LIGHT = new THREE.Color('#5f7d3a')
const ALGAE = new THREE.Color('#4d6238')
const MOSS = new THREE.Color('#465d33')

const scratchGrass = new THREE.Color()
const scratchRock = new THREE.Color()

/**
 * Layered albedo: sand → wet sand → rock strata → vegetation, driven by
 * height above water, slope and a little fractal variation.
 */
export function terrainColor(
  x: number,
  z: number,
  height: number,
  ny: number,
  out: THREE.Color,
  beach = 0,
): void {
  const rel = height - WATER_Y
  const slope = 1 - ny
  const n1 = fbm2(x * 1.4 + 5.2, z * 1.4 - 2.4, 3, 2.1, 0.5, 21.1)
  const n2 = fbm2(x * 3.9 - 1.1, z * 3.9 + 6.8, 2, 2.0, 0.5, 31.7)

  if (rel < 0) {
    out.copy(SAND_UNDER).lerp(SAND_DEEP, smoothstep(0, 1.9, -rel))
    // algae / rubble patches in the shallows
    const algae = smoothstep(0.28, 0.62, n1) * smoothstep(0.05, 0.5, -rel)
    out.lerp(ALGAE, algae * 0.5)
    // submerged rock
    const rocky = smoothstep(0.34, 0.66, slope + n2 * 0.14)
    scratchRock.copy(ROCK_LIGHT).lerp(ROCK_DARK, n2 * 0.5 + 0.5)
    out.lerp(scratchRock, rocky * 0.7)
    // darker right at the waterline (wet)
    out.multiplyScalar(lerp(0.82, 1, smoothstep(0.5, 0.0, -rel)))
    return
  }

  // The beach shelf is sand all the way back to the grass.
  if (beach > 0.32 || spitBeach(x, z, height) > 0.32) {
    out.copy(SAND_DRY)
    out.lerp(SAND_WET, smoothstep(0.24, 0.0, rel) * 0.65)
    out.multiplyScalar(0.95 + n2 * 0.07)
    return
  }

  out.copy(SAND_DRY)
  // damp sand:
  out.lerp(SAND_WET, smoothstep(0.18, 0.0, rel) * 0.85)

  const strata = 0.5 + 0.5 * Math.sin(height * 11.0 + n1 * 2.0)
  scratchRock.copy(ROCK_LIGHT).lerp(ROCK_DARK, strata * 0.55 + n2 * 0.2)
  const rockMix = smoothstep(0.2, 0.48, slope + n2 * 0.08)
  out.lerp(scratchRock, rockMix)

  const moss = smoothstep(0.22, 0.62, n1) * smoothstep(0.08, 0.5, slope) * smoothstep(0.1, 0.85, rel)
  out.lerp(MOSS, moss * 0.7)

  scratchGrass.copy(GRASS_DARK).lerp(GRASS_LIGHT, n2 * 0.5 + 0.5)
  const veg =
    smoothstep(0.26, 0.68, rel + n1 * 0.34) * (1 - smoothstep(0.34, 0.58, slope)) * 0.95
  out.lerp(scratchGrass, veg)
}

export interface TerrainData {
  geometry: THREE.BufferGeometry
  heightTexture: THREE.DataTexture
}

/**
 * Builds the displaced, vertex-coloured terrain mesh plus a small height map
 * that the water shader uses for depth tinting and shoreline foam.
 */
export function buildTerrain(segments: number, heightMapSize: number): TerrainData {
  const geometry = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const count = pos.count
  const colors = new Float32Array(count * 3)
  const scratch = new THREE.Color()

  // Heights first (we need neighbours for ambient occlusion).
  const heights = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    heights[i] = terrainHeight(pos.getX(i), pos.getZ(i))
  }

  const aoAt = (x: number, z: number) => {
    const a = terrainHeight(x + 0.42, z)
    const b = terrainHeight(x - 0.42, z)
    const c = terrainHeight(x, z + 0.42)
    const d = terrainHeight(x, z - 0.42)
    return (a + b + c + d) * 0.25
  }

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = heights[i]
    pos.setY(i, h)

    const eps = 0.06
    const gx = (terrainHeight(x + eps, z) - h) / eps
    const gz = (terrainHeight(x, z + eps) - h) / eps
    const ny = 1 / Math.sqrt(gx * gx + 1 + gz * gz)

    terrainColor(x, z, h, ny, scratch, beachAmount(x, z, h))
    // cheap concavity AO
    const avg = aoAt(x, z)
    const ao = clamp(1 - (avg - h) * 0.85, 0.58, 1.08)
    scratch.multiplyScalar(ao)
    colors[i * 3] = scratch.r
    colors[i * 3 + 1] = scratch.g
    colors[i * 3 + 2] = scratch.b
  }

  geometry.setAttribute('position', pos)
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  // Height map: 8-bit height packed over HEIGHT_MIN..HEIGHT_MAX.
  const data = new Uint8Array(heightMapSize * heightMapSize * 4)
  const inv = heightMapSize - 1
  for (let j = 0; j < heightMapSize; j++) {
    const z = (j / inv - 0.5) * BLOCK_SIZE
    for (let i = 0; i < heightMapSize; i++) {
      const x = (i / inv - 0.5) * BLOCK_SIZE
      const h = terrainHeight(x, z)
      const n = clamp((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN), 0, 1)
      const idx = (j * heightMapSize + i) * 4
      data[idx] = Math.round(n * 255)
      data[idx + 1] = 0
      data[idx + 2] = 0
      data[idx + 3] = 255
    }
  }

  const heightTexture = new THREE.DataTexture(
    data,
    heightMapSize,
    heightMapSize,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  heightTexture.minFilter = THREE.LinearFilter
  heightTexture.magFilter = THREE.LinearFilter
  heightTexture.wrapS = THREE.ClampToEdgeWrapping
  heightTexture.wrapT = THREE.ClampToEdgeWrapping
  heightTexture.needsUpdate = true

  return { geometry, heightTexture }
}
