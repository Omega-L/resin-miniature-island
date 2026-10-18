/**
 * Tiny deterministic noise utilities shared by the CPU terrain generator.
 * (The GPU side has its own GLSL noise in the shaders.)
 */

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export const smootherstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const fract = (x: number) => x - Math.floor(x)

/** Stable 2D hash in [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123
  return fract(s)
}

/** Bilinear value noise in [-1, 1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi

  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)

  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)

  const ab = a + (b - a) * u
  const cd = c + (d - c) * u
  return (ab + (cd - ab) * v) * 2 - 1
}

/** Fractal brownian motion built from rotated value noise octaves. */
export function fbm2(
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.03,
  gain = 0.5,
  seed = 0,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  // rotate each octave a little to hide the value-noise grid
  const ca = Math.cos(0.6)
  const sa = Math.sin(0.6)

  for (let i = 0; i < octaves; i++) {
    const nx = x * ca - y * sa
    const ny = x * sa + y * ca
    sum += noise2(nx * freq, ny * freq, seed + i * 17.13) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** Ridged multifractal, useful for rocky cliff strata. */
export function ridged2(
  x: number,
  y: number,
  octaves = 3,
  lacunarity = 2.1,
  gain = 0.5,
  seed = 0,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(x * freq, y * freq, seed + i * 31.7))
    sum += n * n * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** Small seeded PRNG (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
