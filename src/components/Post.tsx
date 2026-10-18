import {
  Bloom,
  EffectComposer,
  FXAA,
  DepthOfField,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { QualityTier, SceneSettings } from '../lib/quality'

interface PostProps {
  settings: SceneSettings
  quality: QualityTier
}

export function Post({ settings, quality }: PostProps) {
  return (
    <EffectComposer
      multisampling={0}
      enableNormalPass={false}
      frameBufferType={
        quality.low || quality.mobile ? THREE.UnsignedByteType : THREE.HalfFloatType
      }
    >
      {quality.depthOfField ? (
        <DepthOfField
          worldFocusDistance={settings.dofFocus}
          worldFocusRange={settings.dofRange}
          bokehScale={settings.dofBlur * 2.5}
          resolutionScale={0.5}
        />
      ) : (
        <></>
      )}
      {quality.bloom && (
      <Bloom
        intensity={settings.bloom * 0.7}
        luminanceThreshold={0.95}
        luminanceSmoothing={0.25}
        mipmapBlur
        radius={0.65}
      />
      )}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.36} darkness={0.28} eskil={false} />
      {quality.grain && <Noise opacity={0.022} />}
      <FXAA />
    </EffectComposer>
  )
}
