import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { fbm2 } from '../lib/noise'
import { sampleTerrain } from '../lib/terrain'

interface RockSpec {
  x: number
  z: number
  scale: number
  lift: number
  rotation: number
  variant: number
}

const ROCK_SPECS: RockSpec[] = [
  { x: 0.55, z: 1.5, scale: 0.42, lift: 0.12, rotation: 0.7, variant: 0 },
  { x: 1.28, z: 1.92, scale: 0.28, lift: 0.02, rotation: 2.1, variant: 1 },
  { x: -0.25, z: 1.32, scale: 0.2, lift: 0.0, rotation: 1.3, variant: 2 },
  { x: -1.7, z: 0.55, scale: 0.36, lift: 0.16, rotation: 0.2, variant: 0 },
  { x: 1.55, z: 0.15, scale: 0.24, lift: 0.0, rotation: 2.6, variant: 2 },
  { x: -3.95, z: -0.75, scale: 0.5, lift: 0.0, rotation: 1.1, variant: 1 },
  { x: -0.9, z: 2.35, scale: 0.3, lift: 0.05, rotation: 0.5, variant: 1 },
]

function makeRockGeometry(seed: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 2)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    const n1 = fbm2(vertex.x * 1.7 + seed, vertex.z * 1.7 - seed, 3, 2.1, 0.5, seed)
    const n2 = fbm2(vertex.y * 2.4 + seed * 2.0, vertex.x * 2.4, 2, 2.0, 0.5, seed + 4)
    const radius = 1 + n1 * 0.26 + n2 * 0.1
    vertex.multiplyScalar(radius)
    vertex.y *= 1.1
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * A handful of noise-carved boulders. Some sit in the shallows, a few break
 * the surface, echoing the reference photograph.
 */
export function Rocks() {
  const geometries = useMemo(
    () => [makeRockGeometry(1.7), makeRockGeometry(4.2), makeRockGeometry(9.8)],
    [],
  )

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#8a8274',
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.35,
    })
  }, [])

  const placements = useMemo(() => {
    return ROCK_SPECS.map((spec) => {
      const terrain = sampleTerrain(spec.x, spec.z)
      const y = terrain.height + spec.scale * 0.62 + spec.lift
      return { ...spec, y }
    })
  }, [])

  useEffect(() => {
    return () => {
      geometries.forEach((geometry) => geometry.dispose())
      material.dispose()
    }
  }, [geometries, material])

  return (
    <group>
      {placements.map((rock, index) => (
        <mesh
          key={index}
          geometry={geometries[rock.variant]}
          material={material}
          position={[rock.x, rock.y, rock.z]}
          rotation={[0, rock.rotation, 0]}
          scale={[rock.scale * 1.18, rock.scale * 0.9, rock.scale]}
        />
      ))}
    </group>
  )
}
