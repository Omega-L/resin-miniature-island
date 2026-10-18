import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { waterSimFragmentShader, waterSimVertexShader } from '../lib/shaders'

export interface WaterSimApi {
  /** Latest ping-pong state texture (R = height, G = previous height). */
  textureRef: MutableRefObject<THREE.Texture>
  /** Queue a disturbance at normalized (u, v) on the block top. */
  addRipple: (u: number, v: number, strength: number, velU?: number, velV?: number) => void
  resolution: number
}

interface SimRig {
  targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  material: THREE.ShaderMaterial
  index: number
  quad: THREE.Mesh
}

/**
 * GPU height-field simulation.
 *
 * A ping-pong RG16F pair stores (height, previous height); the classic
 * discrete wave equation is integrated at a fixed 60 Hz so the ripple speed
 * is frame-rate independent. Mouse input is injected as a gaussian dent.
 */
export function useWaterHeightField(resolution: number): WaterSimApi {
  const gl = useThree((state) => state.gl)

  const rig = useMemo<SimRig>(() => {
    const makeTarget = () =>
      new THREE.WebGLRenderTarget(resolution, resolution, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      })

    const targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] = [
      makeTarget(),
      makeTarget(),
    ]

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uTexel: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseVel: { value: new THREE.Vector2(0, 0) },
        uImpulse: { value: 0 },
        uPropagation: { value: 0.3 },
        uDamping: { value: 0.997 },
        uTime: { value: 0 },
      },
      vertexShader: waterSimVertexShader,
      fragmentShader: waterSimFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    scene.add(quad)

    return { targets, scene, camera, material, index: 0, quad }
  }, [resolution])

  const textureRef = useRef<THREE.Texture>(rig.targets[0].texture)
  const impulse = useRef({ u: 0.5, v: 0.5, strength: 0, velU: 0, velV: 0 })
  const accumulator = useRef(0)

  useEffect(() => {
    // start from a perfectly flat surface
    for (const target of rig.targets) {
      const previous = gl.getRenderTarget()
      gl.setRenderTarget(target)
      gl.clearColor()
      gl.clear()
      gl.setRenderTarget(previous)
    }
    return () => {
      rig.targets.forEach((target) => target.dispose())
      rig.material.dispose()
      rig.quad.geometry.dispose()
    }
  }, [gl, rig])

  const api = useMemo<WaterSimApi>(
    () => ({
      textureRef,
      resolution,
      addRipple: (u, v, strength, velU = 0, velV = 0) => {
        const imp = impulse.current
        imp.u = u
        imp.v = v
        imp.strength += strength
        imp.velU = velU
        imp.velV = velV
      },
    }),
    [resolution],
  )

  useFrame((state, delta) => {
    const uniforms = rig.material.uniforms
    uniforms.uTime.value = state.clock.elapsedTime

    const imp = impulse.current
    uniforms.uMouse.value.set(imp.u, imp.v)
    uniforms.uMouseVel.value.set(imp.velU, imp.velV)

    accumulator.current += Math.min(delta, 0.1)
    const step = 1 / 60
    let steps = 0
    while (accumulator.current >= step && steps < 2) {
      // consume the impulse once per simulation step
      uniforms.uImpulse.value = Math.min(imp.strength, 0.85)
      const source = rig.targets[rig.index]
      const destination = rig.targets[1 - rig.index]
      uniforms.uState.value = source.texture
      gl.setRenderTarget(destination)
      gl.render(rig.scene, rig.camera)
      gl.setRenderTarget(null)
      rig.index = 1 - rig.index
      accumulator.current -= step
      steps++
    }
    if (steps > 0) {
      textureRef.current = rig.targets[rig.index].texture
      imp.strength = 0
      imp.velU *= 0.6
      imp.velV *= 0.6
    }
  })

  return api
}
