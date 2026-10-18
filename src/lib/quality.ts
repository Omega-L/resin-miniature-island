export interface SceneSettings {
  shallowColor: string
  deepColor: string
  foamColor: string
  waveHeight: number
  rippleStrength: number
  rippleHeight: number
  sunAngle: number
  sunElevation: number
  tide: number
  jellySoftness: number
  jellyAmount: number
  dofFocus: number
  dofRange: number
  dofBlur: number
  bloom: number
  exposure: number
}

export interface QualityTier {
  mobile: boolean
  low: boolean
  dpr: number
  terrainSegments: number
  heightMapSize: number
  waterSegments: number
  simResolution: number
  shellSamples: number
  shellResolution: number
  vegetation: number
  marine: { coral: number; seaweed: number; fish: number; starfish: number; shells: number }
  reflection: boolean
  reflectionResolution: number
  bloom: boolean
  grain: boolean
  depthOfField: boolean
}

/** Detects integrated / software GPUs that cannot carry the full 4K effect stack. */
function isLowPowerGPU(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGL2RenderingContext
      | WebGLRenderingContext
      | null
    if (!gl) return true
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    const info = renderer.toLowerCase()
    return /intel.*(hd|uhd|iris)|radeon graphics|adreno|mali|swiftshader|llvmpipe|software/.test(info)
  } catch {
    return false
  }
}

export type QualityMode = 'lite' | 'full' | 'ultra'

/** Runtime override: lite = 60fps, full = full glass, ultra = everything at max. */
export function resolveQuality(base: QualityTier, mode: QualityMode): QualityTier {
  if (base.mobile) return base
  if (mode === 'lite') {
    return {
      ...base,
      low: true,
      dpr: 0.75,
      terrainSegments: 128,
      heightMapSize: 256,
      waterSegments: 96,
      simResolution: 128,
      shellSamples: 2,
      shellResolution: 192,
      vegetation: 700,
      marine: { coral: 22, seaweed: 50, fish: 10, starfish: 8, shells: 12 },
      reflection: false,
      reflectionResolution: 0,
      bloom: false,
      grain: false,
      depthOfField: false,
    }
  }
  if (mode === 'ultra') {
    return {
      ...base,
      low: false,
      dpr: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5),
      terrainSegments: 256,
      heightMapSize: 512,
      waterSegments: 224,
      simResolution: 256,
      shellSamples: 6,
      shellResolution: 512,
      vegetation: 2200,
      marine: { coral: 80, seaweed: 180, fish: 28, starfish: 24, shells: 40 },
      reflection: true,
      reflectionResolution: 768,
      bloom: true,
      grain: true,
      depthOfField: true,
    }
  }
  if (base.low) {
    return {
      ...base,
      low: false,
      dpr: 0.85,
      terrainSegments: 160,
      heightMapSize: 256,
      waterSegments: 128,
      simResolution: 160,
      shellSamples: 2,
      shellResolution: 192,
      vegetation: 1000,
      marine: { coral: 24, seaweed: 50, fish: 10, starfish: 8, shells: 12 },
      reflection: false,
      reflectionResolution: 0,
      bloom: false,
      grain: false,
      depthOfField: false,
    }
  }
  return {
    ...base,
    reflection: true,
    reflectionResolution: 512,
    bloom: true,
    grain: false,
    depthOfField: true,
  }
}

export function detectQuality(): QualityTier {
  const hasWindow = typeof window !== 'undefined'
  const coarse = hasWindow && window.matchMedia('(pointer: coarse)').matches
  const narrow = hasWindow && window.innerWidth < 860
  const mobile = coarse || narrow

  if (mobile) {
    return {
      mobile: true,
      low: false,
      dpr: 1.5,
      terrainSegments: 128,
      heightMapSize: 256,
      waterSegments: 96,
      simResolution: 128,
      shellSamples: 2,
      shellResolution: 192,
      vegetation: 180,
      marine: { coral: 14, seaweed: 32, fish: 8, starfish: 6, shells: 10 },
      reflection: false,
      reflectionResolution: 0,
      bloom: false,
      grain: false,
      depthOfField: false,
    }
  }

  const low = isLowPowerGPU()

  return {
    mobile: false,
    low,
    dpr: low ? 0.75 : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5),
    terrainSegments: low ? 128 : 192,
    heightMapSize: low ? 256 : 512,
    waterSegments: low ? 96 : 160,
    simResolution: low ? 128 : 192,
    shellSamples: low ? 2 : 3,
    shellResolution: low ? 256 : 384,
    vegetation: low ? 700 : 1700,
    marine: low
      ? { coral: 22, seaweed: 50, fish: 10, starfish: 8, shells: 12 }
      : { coral: 62, seaweed: 145, fish: 22, starfish: 18, shells: 32 },
    reflection: !low,
    reflectionResolution: low ? 0 : 512,
    bloom: !low,
    grain: false,
    depthOfField: !low,
  }
}
