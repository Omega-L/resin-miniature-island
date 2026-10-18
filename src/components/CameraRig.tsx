import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Long-lens product camera, reframed for portrait screens. */
export function CameraRig() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const size = useThree((state) => state.size)
  const framed = useRef(false)
  const lastPortrait = useRef<boolean | null>(null)

  useEffect(() => {
    if (size.width === 0) return
    const aspect = size.width / Math.max(size.height, 1)
    const portrait = aspect < 1
    // Initial framing, plus a reframe when crossing portrait/landscape.
    // Otherwise leave the user's orbit alone.
    if (framed.current && lastPortrait.current === portrait) return
    framed.current = true
    lastPortrait.current = portrait
    const fov = portrait ? 36 : 24
    const tan = Math.tan(THREE.MathUtils.degToRad(fov * 0.5))
    const distance = Math.max(
      (portrait ? 7.6 : 7.7) / tan,
      (portrait ? 8.3 : 8.3) / (tan * Math.max(aspect, 0.2)),
    )
    const direction = new THREE.Vector3(0.54, 0.71, 0.57).normalize()
    const target = new THREE.Vector3(0, 0.7, 0)

    camera.layers.enable(1)
    camera.fov = fov
    camera.near = 0.5
    camera.far = 400
    camera.position.copy(direction.multiplyScalar(distance)).add(target)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])

  return null
}

export function Exposure({ value }: { value: number }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}
