import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useWaterHeightField } from '../hooks/useWaterHeightField'
import { useJellyOffset } from '../state/JellyRig'
import type { SceneSettings } from '../lib/quality'
import {
  BLOCK_HALF,
  BLOCK_RADIUS,
  BLOCK_SIZE,
  HEIGHT_MAX,
  HEIGHT_MIN,
  WATER_Y,
} from '../lib/terrain'
import { waterFragmentShader, waterVertexShader } from '../lib/shaders'

interface WaterProps {
  settings: SceneSettings
  heightTexture: THREE.Texture
  simResolution: number
  segments: number
  sunDir: THREE.Vector3
  mobile: boolean
}

interface ReflectionRig {
  target: THREE.WebGLRenderTarget
  camera: THREE.PerspectiveCamera
}

export function WaterSurface({
  settings,
  heightTexture,
  simResolution,
  segments,
  sunDir,
  mobile,
}: WaterProps) {
  const jellyOffset = useJellyOffset()
  const sim = useWaterHeightField(simResolution)
  const gl = useThree((state) => state.gl)

  const reflection = useMemo<ReflectionRig | null>(() => {
    if (mobile) return null
    const target = new THREE.WebGLRenderTarget(512, 512, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    })
    target.texture.colorSpace = THREE.NoColorSpace
    const camera = new THREE.PerspectiveCamera()
    camera.layers.set(0)
    return { target, camera }
  }, [mobile])

  const fallback = useMemo(() => {
    const data = new Uint8Array([0, 0, 0, 255])
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    texture.needsUpdate = true
    return texture
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE, segments, segments)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [segments])

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uSim: { value: sim.textureRef.current },
        uTerrain: { value: heightTexture },
        uReflection: { value: reflection?.target.texture ?? fallback },
        uReflectMatrix: { value: new THREE.Matrix4() },
        uReflectionStrength: { value: reflection ? 0.62 : 0 },
        uSimTexel: { value: 1 / simResolution },
        uSimResolution: { value: simResolution },
        uTime: { value: 0 },
        uWaveHeight: { value: 0.55 },
        uRippleHeight: { value: 0.55 },
        uJelly: { value: new THREE.Vector2() },
        uJellyAmount: { value: 0.35 },
        uShallow: { value: new THREE.Color('#3ed8c4') },
        uDeep: { value: new THREE.Color('#07546d') },
        uFoam: { value: new THREE.Color('#f3fbf7') },
        uSunDir: { value: new THREE.Vector3(0.5, 0.65, 0.5) },
        uWaterY: { value: WATER_Y },
        uHeightMin: { value: HEIGHT_MIN },
        uHeightMax: { value: HEIGHT_MAX },
        uMaskHalf: { value: BLOCK_HALF - 0.18 },
        uMaskRadius: { value: BLOCK_RADIUS },
      },
    })
    mat.toneMapped = true
    return mat
  }, [fallback, heightTexture, reflection, sim.textureRef, simResolution])

  const mesh = useRef<THREE.Mesh>(null)
  const reflectionFrame = useRef(0)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const previous = useRef(new THREE.Vector2(0.5, 0.5))
  const reflectMatrix = useMemo(() => new THREE.Matrix4(), [])
  const scratchDir = useMemo(() => new THREE.Vector3(), [])
  const scratchUp = useMemo(() => new THREE.Vector3(), [])
  const scratchTarget = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    material.uniforms.uShallow.value.set(settings.shallowColor)
    material.uniforms.uDeep.value.set(settings.deepColor)
    material.uniforms.uFoam.value.set(settings.foamColor)
  }, [material, settings.shallowColor, settings.deepColor, settings.foamColor])

  useEffect(() => {
    material.uniforms.uJellyAmount.value = settings.jellyAmount * 0.35
  }, [material, settings.jellyAmount])

  useEffect(() => {
    material.uniforms.uWaveHeight.value = settings.waveHeight
    material.uniforms.uRippleHeight.value = settings.rippleHeight
  }, [material, settings.waveHeight, settings.rippleHeight])

  useEffect(() => {
    material.uniforms.uSunDir.value.copy(sunDir)
  }, [material, sunDir])

  const waterY = WATER_Y + settings.tide
  useEffect(() => {
    material.uniforms.uWaterY.value = waterY
    plane.constant = -waterY
    if (mesh.current) mesh.current.position.y = waterY
  }, [material, plane, waterY])

  useFrame((state) => {
    const uniforms = material.uniforms
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uSim.value = sim.textureRef.current
    uniforms.uSimTexel.value = 1 / sim.resolution
    uniforms.uWaterY.value = waterY
    uniforms.uJelly.value.copy(jellyOffset.current)

    // Project the pointer onto the (sheared) water surface and inject a ripple.
    plane.constant = -waterY
    raycaster.setFromCamera(state.pointer, state.camera)
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const localX = hit.x
      const localZ = hit.z
      const u = localX / BLOCK_SIZE + 0.5
      const v = localZ / BLOCK_SIZE + 0.5
      if (u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98) {
        const du = u - previous.current.x
        const dv = v - previous.current.y
        const speed = Math.hypot(du, dv)
        if (speed > 0.00035) {
          const strength = Math.min(speed * 9.0, 0.6) * settings.rippleStrength
          sim.addRipple(u, v, strength, du * 1.8, dv * 1.8)
        }
        previous.current.set(u, v)
      } else {
        previous.current.set(u, v)
      }
    }

    // Planar reflection of the island for the water surface.
    if (!reflection) return
    const camera = state.camera as THREE.PerspectiveCamera
    const virtual = reflection.camera
    virtual.projectionMatrix.copy(camera.projectionMatrix)
    virtual.projectionMatrixInverse.copy(camera.projectionMatrixInverse)
    virtual.near = camera.near
    virtual.far = camera.far
    virtual.position.set(camera.position.x, 2 * waterY - camera.position.y, camera.position.z)

    scratchDir.set(0, 0, -1).applyQuaternion(camera.quaternion)
    scratchDir.y *= -1
    scratchUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    scratchUp.y *= -1
    virtual.up.copy(scratchUp)
    scratchTarget.copy(virtual.position).add(scratchDir)
    virtual.lookAt(scratchTarget)
    virtual.updateMatrixWorld(true)
    virtual.matrixWorldInverse.copy(virtual.matrixWorld).invert()

    reflectMatrix.multiplyMatrices(virtual.projectionMatrix, virtual.matrixWorldInverse)
    uniforms.uReflectMatrix.value.copy(reflectMatrix)

    // A 512² mirror pass is the most expensive extra scene render; 30 Hz is
    // plenty for a slowly moving miniature and leaves headroom for 60 fps.
    if (reflectionFrame.current++ % 2 === 0) {
      const previousTarget = gl.getRenderTarget()
      const previousTone = gl.toneMapping
      gl.toneMapping = THREE.NoToneMapping
      gl.setRenderTarget(reflection.target)
      gl.clear()
      gl.render(state.scene, virtual)
      gl.setRenderTarget(previousTarget)
      gl.toneMapping = previousTone
    }
  })

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      reflection?.target.dispose()
      fallback.dispose()
    }
  }, [geometry, material, reflection, fallback])

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      position={[0, waterY, 0]}
      renderOrder={4}
      frustumCulled={false}
      onUpdate={(self) => self.layers.set(1)}
    />
  )
}
