import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../lib/noise'
import { WATER_Y, sampleTerrain } from '../lib/terrain'

export interface MarineCounts {
  coral: number
  seaweed: number
  fish: number
  starfish: number
  shells: number
}

interface Spot {
  x: number
  y: number
  z: number
  scale: number
  rot: number
}

const CORAL_COLORS = ['#ff8a63', '#f25f7d', '#b06ee8', '#f3c35b', '#ff6f52']
const FISH_COLORS = ['#cfe8f0', '#86bdd2', '#f4c95d', '#e8e3d2']
const STAR_COLORS = ['#e8623c', '#d84a38', '#ef8a4a']

function scatter(count: number, minDepth: number, maxDepth: number, seed: number): Spot[] {
  const rand = mulberry32(seed)
  const spots: Spot[] = []
  let guard = 0
  while (spots.length < count && guard < count * 160) {
    guard++
    const x = -4.5 + rand() * 9
    const z = -4.5 + rand() * 9
    const s = sampleTerrain(x, z)
    const depth = WATER_Y - s.height
    if (depth < minDepth || depth > maxDepth) continue
    spots.push({ x, y: s.height, z, scale: 0.7 + rand() * 0.75, rot: rand() * Math.PI * 2 })
  }
  return spots
}

function scatterBeach(count: number, seed: number): Spot[] {
  const rand = mulberry32(seed)
  const spots: Spot[] = []
  let guard = 0
  while (spots.length < count && guard < count * 200) {
    guard++
    const x = -4.5 + rand() * 9
    const z = -4.5 + rand() * 9
    const s = sampleTerrain(x, z)
    const rel = s.height - WATER_Y
    if (rel < -0.12 || rel > 0.3) continue
    spots.push({ x, y: s.height, z, scale: 0.7 + rand() * 0.8, rot: rand() * Math.PI * 2 })
  }
  return spots
}

export function MarineLife({ counts }: { counts: MarineCounts }) {
  const coralSpots = useMemo(() => scatter(counts.coral, 0.15, 0.9, 0x51a1), [counts.coral])
  const weedSpots = useMemo(() => scatter(counts.seaweed, 0.22, 1.15, 0x7e2c), [counts.seaweed])
  const starSpots = useMemo(() => scatterBeach(counts.starfish, 0x3d19), [counts.starfish])
  const shellSpots = useMemo(() => scatterBeach(counts.shells, 0x91b7), [counts.shells])

  const coral = useRef<THREE.InstancedMesh>(null)
  const weed = useRef<THREE.InstancedMesh>(null)
  const stars = useRef<THREE.InstancedMesh>(null)
  const shells = useRef<THREE.InstancedMesh>(null)
  const fish = useRef<THREE.InstancedMesh>(null)

  const coralGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const trunk = new THREE.CylinderGeometry(0.035, 0.075, 0.24, 5)
    trunk.translate(0, 0.12, 0)
    parts.push(trunk)
    for (let i = 0; i < 4; i++) {
      const b = new THREE.CylinderGeometry(0.02, 0.04, 0.2, 4)
      b.translate(0, 0.1, 0)
      b.rotateZ((i % 2 ? 1 : -1) * (0.55 + i * 0.1))
      b.rotateY(i * 1.9)
      b.translate(0, 0.15, 0)
      parts.push(b)
    }
    return mergeGeometries(parts)!
  }, [])

  const weedGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.09, 0.58, 1, 4)
    g.translate(0, 0.29, 0)
    return g
  }, [])

  const starGeo = useMemo(() => {
    const shape = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 0.21 : 0.085
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r
      if (i === 0) shape.moveTo(px, py)
      else shape.lineTo(px, py)
    }
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const shellGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.07, 6, 4)
    g.scale(1, 0.45, 0.7)
    return g
  }, [])

  const fishGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.07, 0.26, 5)
    g.rotateX(Math.PI / 2)
    return g
  }, [])

  const coralMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, color: '#ffffff' }),
    [],
  )
  const starMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, color: '#ffffff' }),
    [],
  )
  const shellMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05, color: '#ffffff' }),
    [],
  )
  const fishMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15, color: '#ffffff' }),
    [],
  )
  const weedMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float phase = instanceMatrix[3].x * 2.1 + instanceMatrix[3].z * 1.7;
            float sway = sin(uTime * 1.5 + phase) * 0.13 + sin(uTime * 2.2 + phase * 1.7) * 0.045;
            p.x += sway * uv.y;
            p.z += sway * 0.35 * uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vec3 base = mix(vec3(0.08, 0.16, 0.07), vec3(0.24, 0.36, 0.12), vUv.y);
            gl_FragColor = vec4(base, 1.0);
          }
        `,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      center: new THREE.Vector3(1.05, 1.16, 1.55),
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }),
    [],
  )

  useLayoutEffect(() => {
    const { dummy } = scratch
    const color = new THREE.Color()
    if (coral.current) {
      coralSpots.forEach((s, i) => {
        dummy.position.set(s.x, s.y - 0.02, s.z)
        dummy.rotation.set(0, s.rot, 0)
        dummy.scale.setScalar(s.scale * 1.15)
        dummy.updateMatrix()
        coral.current!.setMatrixAt(i, dummy.matrix)
        color.set(CORAL_COLORS[i % CORAL_COLORS.length])
        coral.current!.setColorAt(i, color)
      })
      coral.current.instanceMatrix.needsUpdate = true
      if (coral.current.instanceColor) coral.current.instanceColor.needsUpdate = true
    }
    if (weed.current) {
      weedSpots.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z)
        dummy.rotation.set(0, s.rot, 0)
        dummy.scale.setScalar(s.scale * 1.4)
        dummy.updateMatrix()
        weed.current!.setMatrixAt(i, dummy.matrix)
      })
      weed.current.instanceMatrix.needsUpdate = true
    }
    if (stars.current) {
      starSpots.forEach((s, i) => {
        dummy.position.set(s.x, s.y + 0.015, s.z)
        dummy.rotation.set(0, s.rot, 0)
        dummy.scale.setScalar(s.scale * 0.95)
        dummy.updateMatrix()
        stars.current!.setMatrixAt(i, dummy.matrix)
        color.set(STAR_COLORS[i % STAR_COLORS.length])
        stars.current!.setColorAt(i, color)
      })
      stars.current.instanceMatrix.needsUpdate = true
      if (stars.current.instanceColor) stars.current.instanceColor.needsUpdate = true
    }
    if (shells.current) {
      shellSpots.forEach((s, i) => {
        dummy.position.set(s.x, s.y + 0.02, s.z)
        dummy.rotation.set(0, s.rot, 0)
        dummy.scale.setScalar(s.scale * 0.95)
        dummy.updateMatrix()
        shells.current!.setMatrixAt(i, dummy.matrix)
        color.set(i % 3 === 0 ? '#f1d9b5' : i % 3 === 1 ? '#f7e8d2' : '#dfcbb4')
        shells.current!.setColorAt(i, color)
      })
      shells.current.instanceMatrix.needsUpdate = true
      if (shells.current.instanceColor) shells.current.instanceColor.needsUpdate = true
    }
    if (fish.current) {
      fish.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      for (let i = 0; i < counts.fish; i++) {
        color.set(FISH_COLORS[i % FISH_COLORS.length])
        fish.current.setColorAt(i, color)
      }
      if (fish.current.instanceColor) fish.current.instanceColor.needsUpdate = true
    }
  }, [coralSpots, weedSpots, starSpots, shellSpots, counts.fish, scratch])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    weedMat.uniforms.uTime.value = t
    const fishMesh = fish.current
    if (!fishMesh) return
    const { dummy, center, pos, target } = scratch
    const count = counts.fish
    for (let i = 0; i < count; i++) {
      const a = t * 0.33 + (i / count) * Math.PI * 2
      const r = 0.75 + (i % 3) * 0.12
      const wobble = Math.sin(t * 1.7 + i * 2.1) * 0.06
      pos.set(
        center.x + Math.cos(a) * r,
        center.y + Math.sin(t * 0.8 + i) * 0.035 + wobble,
        center.z + Math.sin(a) * r * 0.8,
      )
      target.set(-Math.sin(a), 0, Math.cos(a) * 0.8).normalize().add(pos)
      dummy.position.copy(pos)
      dummy.lookAt(target)
      dummy.scale.setScalar(1.0 + (i % 3) * 0.18)
      dummy.updateMatrix()
      fishMesh.setMatrixAt(i, dummy.matrix)
    }
    fishMesh.instanceMatrix.needsUpdate = true
  })

  useEffect(() => {
    return () => {
      coralGeo.dispose()
      weedGeo.dispose()
      starGeo.dispose()
      shellGeo.dispose()
      fishGeo.dispose()
      coralMat.dispose()
      starMat.dispose()
      shellMat.dispose()
      fishMat.dispose()
      weedMat.dispose()
    }
  }, [coralGeo, weedGeo, starGeo, shellGeo, fishGeo, coralMat, starMat, shellMat, fishMat, weedMat])

  return (
    <group>
      {counts.coral > 0 && (
        <instancedMesh ref={coral} args={[coralGeo, coralMat, coralSpots.length]} frustumCulled={false} />
      )}
      {counts.seaweed > 0 && (
        <instancedMesh ref={weed} args={[weedGeo, weedMat, weedSpots.length]} frustumCulled={false} />
      )}
      {counts.starfish > 0 && (
        <instancedMesh ref={stars} args={[starGeo, starMat, starSpots.length]} frustumCulled={false} />
      )}
      {counts.shells > 0 && (
        <instancedMesh ref={shells} args={[shellGeo, shellMat, shellSpots.length]} frustumCulled={false} />
      )}
      {counts.fish > 0 && (
        <instancedMesh ref={fish} args={[fishGeo, fishMat, counts.fish]} frustumCulled={false} />
      )}
    </group>
  )
}
