import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { fbm2, mulberry32 } from '../lib/noise'
import { WATER_Y, beachAmount, sampleTerrain } from '../lib/terrain'

interface Bush {
  matrix: THREE.Matrix4
  color: THREE.Color
}

const DEEP_GREEN = new THREE.Color('#16301a')
const MID_GREEN = new THREE.Color('#2e4a24')
const LIGHT_GREEN = new THREE.Color('#4f6a31')

/**
 * Instanced shrub blobs: placed only on gentle, dry slopes, clumped with noise
 * so the vegetation reads as a canopy rather than random dots.
 */
export function Vegetation({ count }: { count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const bushes = useMemo<Bush[]>(() => {
    const rand = mulberry32(0x51a7)
    const dummy = new THREE.Object3D()
    const items: Bush[] = []
    let guard = 0
    const maxGuard = count * 80

    while (items.length < count && guard < maxGuard) {
      guard++
      const x = -5 + rand() * 10
      const z = -5 + rand() * 10
      const sample = sampleTerrain(x, z)
      const rel = sample.height - WATER_Y
      if (rel < 0.22 || rel > 3.2) continue

      const slope = 1 - sample.ny
      if (slope > 0.86) continue
      if (beachAmount(x, z, sample.height) > 0.22) continue

      const clump = fbm2(x * 2.4 + 3.1, z * 2.4 - 6.2, 3, 2.05, 0.5, 12.3)
      if (clump < -0.18 && rand() > 0.5) continue
      // keep the beach clear
      if (rel < 0.36 && rand() > 0.22) continue

      const scale = (0.04 + Math.pow(rand(), 1.6) * 0.13) * (0.9 + clump * 0.3)
      dummy.position.set(x, sample.height + scale * 0.55, z)
      dummy.rotation.set(0, rand() * Math.PI * 2, 0)
      dummy.scale.set(
        scale * (0.9 + rand() * 0.6),
        scale * (0.72 + rand() * 0.55),
        scale * (0.9 + rand() * 0.6),
      )
      dummy.updateMatrix()

      const t = Math.min(1, Math.max(0, rand() * 0.55 + clump * 0.35 + 0.35))
      const color = new THREE.Color()
      if (t < 0.55) {
        color.copy(DEEP_GREEN).lerp(MID_GREEN, t / 0.55)
      } else {
        color.copy(MID_GREEN).lerp(LIGHT_GREEN, (t - 0.55) / 0.45)
      }
      color.offsetHSL(0, 0, (rand() - 0.5) * 0.05)

      items.push({ matrix: dummy.matrix.clone(), color })
    }

    return items
  }, [count])

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.95,
        metalness: 0,
        envMapIntensity: 0.2,
      }),
    [],
  )

  useLayoutEffect(() => {
    const instanced = mesh.current
    if (!instanced) return
    bushes.forEach((bush, index) => {
      instanced.setMatrixAt(index, bush.matrix)
      instanced.setColorAt(index, bush.color)
    })
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [bushes])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, bushes.length]}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
