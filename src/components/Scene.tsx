import { Suspense, useEffect, useMemo } from 'react'
import { Environment, OrbitControls } from '@react-three/drei'
import { buildTerrain } from '../lib/terrain'
import { sunDirection } from '../lib/sun'
import type { QualityTier, SceneSettings } from '../lib/quality'
import { CameraRig, Exposure } from './CameraRig'
import { Lighting } from './Lighting'
import { Terrain } from './Terrain'
import { WaterSurface } from './WaterSurface'
import { ResinBlock } from './ResinBlock'
import { Rocks } from './Rocks'
import { Vegetation } from './Vegetation'
import { MarineLife } from './MarineLife'
import { JellyRig } from '../state/JellyRig'
import { StudioFloor } from './StudioFloor'
import { Post } from './Post'
import { SilentBoundary } from './SilentBoundary'

interface SceneProps {
  settings: SceneSettings
  quality: QualityTier
}

export function Scene({ settings, quality }: SceneProps) {
  const sunDir = useMemo(
    () => sunDirection(settings.sunAngle, settings.sunElevation),
    [settings.sunAngle, settings.sunElevation],
  )

  const terrainData = useMemo(
    () => buildTerrain(quality.terrainSegments, quality.heightMapSize),
    [quality.terrainSegments, quality.heightMapSize],
  )

  useEffect(() => {
    return () => {
      terrainData.geometry.dispose()
      terrainData.heightTexture.dispose()
    }
  }, [terrainData])

  return (
    <>
      <color attach="background" args={['#f0e9df']} />
      <CameraRig />
      <OrbitControls
        makeDefault
        target={[0, 0.7, 0]}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={14}
        maxDistance={58}
        minPolarAngle={0.35}
        maxPolarAngle={0.95}
        rotateSpeed={0.7}
        zoomSpeed={0.7}
      />
      <Exposure value={settings.exposure} />
      <Lighting sunDir={sunDir} />

      <SilentBoundary>
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={0.45} />
        </Suspense>
      </SilentBoundary>

      {/* Water mounts before the shell so its simulation is a frame ahead of
          the transmission material's internal scene render. */}
      <JellyRig softness={settings.jellySoftness} amount={settings.jellyAmount}>
        <Terrain data={terrainData} sunDir={sunDir} tide={settings.tide} deepColor={settings.deepColor} />
        <WaterSurface
          settings={settings}
          heightTexture={terrainData.heightTexture}
          simResolution={quality.simResolution}
          segments={quality.waterSegments}
          sunDir={sunDir}
          mobile={!quality.reflection}
        />
        <ResinBlock
          samples={quality.shellSamples}
          resolution={quality.shellResolution}
          cheap={quality.low}
        />
        <Rocks />
        <Vegetation count={quality.vegetation} />
        <MarineLife counts={quality.marine} />
      </JellyRig>

      <StudioFloor />
      <Post settings={settings} quality={quality} />
    </>
  )
}
