import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox, MeshTransmissionMaterial } from '@react-three/drei'
import { BLOCK_RADIUS, BLOCK_SIZE } from '../lib/terrain'

interface ResinBlockProps {
  samples: number
  resolution: number
  cheap: boolean
}

/**
 * The block itself is the seawater pour: a rounded, bevelled glass prism with
 * a teal volume attenuation. Its top cap is removed so the animated water is
 * the actual top surface — no glass slab between the camera and the seabed.
 */
export function ResinBlock({ samples, resolution, cheap }: ResinBlockProps) {
  const mesh = useRef<THREE.Mesh>(null)

  useLayoutEffect(() => {
    const meshRef = mesh.current
    if (!meshRef) return
    const source = meshRef.geometry
    const flat = source.index ? source.toNonIndexed() : source
    const position = flat.getAttribute('position') as THREE.BufferAttribute
    const kept: number[] = []

    for (let i = 0; i < position.count; i += 3) {
      const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3
      if (y > 1.49) continue
      for (let k = 0; k < 3; k++) {
        kept.push(position.getX(i + k), position.getY(i + k), position.getZ(i + k))
      }
    }

    const open = new THREE.BufferGeometry()
    open.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
    open.computeVertexNormals()
    open.computeBoundingSphere()
    meshRef.geometry = open

    return () => {
      open.dispose()
      if (flat !== source) flat.dispose()
      source.dispose()
    }
  }, [])

  return (
    <RoundedBox
      ref={mesh}
      args={[BLOCK_SIZE, 3, BLOCK_SIZE]}
      radius={BLOCK_RADIUS}
      smoothness={6}
      bevelSegments={5}
      creaseAngle={0.5}
      renderOrder={2}
      onUpdate={(self) => self.layers.set(1)}
    >
      {cheap ? (
        <meshPhysicalMaterial
          color="#8fe4d6"
          transparent
          opacity={0.1}
          roughness={0.07}
          metalness={0}
          ior={1.4}
          clearcoat={0.5}
          clearcoatRoughness={0.12}
          emissive="#0b6f66"
          emissiveIntensity={0.1}
          envMapIntensity={0.9}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      ) : (
      <MeshTransmissionMaterial
        samples={samples}
        resolution={resolution}
        transmission={1}
        thickness={2.2}
        ior={1.38}
        chromaticAberration={0.012}
        anisotropicBlur={0.12}
        roughness={0.05}
        distortion={0.015}
        distortionScale={0.35}
        temporalDistortion={0}
        attenuationDistance={6.0}
        attenuationColor="#7fe4de"
        color="#e3f8f3"
        emissive="#128f86"
        emissiveIntensity={0.2}
        envMapIntensity={0.7}
        backside={false}
        transparent
        depthWrite={false}
      />
      )}
    </RoundedBox>
  )
}
