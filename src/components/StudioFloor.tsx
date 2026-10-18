import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Warm seamless studio floor plus a hand-painted radial contact shadow.
 * (A single gradient card is cheaper and more predictable than a live
 * contact-shadow pass, and the specimen's base never moves.)
 */
export function StudioFloor() {
  const shadow = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return null
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.04,
      size / 2,
      size / 2,
      size * 0.5,
    )
    gradient.addColorStop(0, 'rgba(62, 48, 33, 0.78)')
    gradient.addColorStop(0.42, 'rgba(62, 48, 33, 0.46)')
    gradient.addColorStop(0.72, 'rgba(62, 48, 33, 0.11)')
    gradient.addColorStop(1, 'rgba(62, 48, 33, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])

  useEffect(() => {
    return () => {
      shadow?.dispose()
    }
  }, [shadow])

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -1.565, 0]}
        renderOrder={-1}
        onUpdate={(self) => self.layers.set(1)}
      >
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#e9dcc6" roughness={0.97} metalness={0} />
      </mesh>
      {shadow ? (
        <mesh
          rotation-x={-Math.PI / 2}
          position={[0, -1.553, 0]}
          renderOrder={1}
          onUpdate={(self) => self.layers.set(1)}
        >
          <planeGeometry args={[14.6, 14.6]} />
          <meshBasicMaterial
            map={shadow}
            transparent
            opacity={0.95}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </>
  )
}
