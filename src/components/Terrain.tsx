import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainFragmentShader, terrainVertexShader } from '../lib/shaders'
import {
  BLOCK_HALF,
  BLOCK_RADIUS,
  HEIGHT_MAX,
  HEIGHT_MIN,
  WATER_Y,
  type TerrainData,
} from '../lib/terrain'

interface TerrainProps {
  data: TerrainData
  sunDir: THREE.Vector3
  tide: number
  deepColor: string
}

export function Terrain({ data, sunDir, tide, deepColor }: TerrainProps) {
  const { geometry } = data

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.65, 0.5) },
        uSunColor: { value: new THREE.Color('#fff2dd') },
        uSkyColor: { value: new THREE.Color('#bcd9e8') },
        uDeepColor: { value: new THREE.Color(deepColor) },
        uWaterY: { value: WATER_Y },
        uMaskHalf: { value: BLOCK_HALF - 0.04 },
        uMaskRadius: { value: BLOCK_RADIUS + 0.02 },
        uHeightMin: { value: HEIGHT_MIN },
        uHeightMax: { value: HEIGHT_MAX },
      },
    })
    mat.toneMapped = true
    return mat
  }, [])

  useEffect(() => {
    material.uniforms.uSunDir.value.copy(sunDir)
  }, [material, sunDir])

  useEffect(() => {
    material.uniforms.uWaterY.value = WATER_Y + tide
  }, [material, tide])

  useEffect(() => {
    material.uniforms.uDeepColor.value.set(deepColor)
  }, [material, deepColor])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  return <mesh geometry={geometry} material={material} renderOrder={0} />
}
