import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp, lerp } from '../lib/noise'

const JellyContext = createContext<MutableRefObject<THREE.Vector2> | null>(null)

/** Spring offset of the water surface, shared with the water shader. */
export function useJellyOffset(): MutableRefObject<THREE.Vector2> {
  const context = useContext(JellyContext)
  if (!context) throw new Error('useJellyOffset must be used inside <JellyRig>')
  return context
}

interface JellyRigProps {
  softness: number
  amount: number
  children: ReactNode
}

/**
 * Pointer-driven under-damped spring. Only the water surface consumes the
 * offset — the island, rocks and resin shell stay perfectly still.
 */
export function JellyRig({ softness, amount, children }: JellyRigProps) {
  const offset = useRef(new THREE.Vector2())
  const velocity = useRef(new THREE.Vector2())
  const target = useRef(new THREE.Vector2())
  const gl = useThree((state) => state.gl)

  const config = useRef({ softness, amount })
  config.current.softness = softness
  config.current.amount = amount

  useEffect(() => {
    const canvas = gl.domElement
    const relax = () => target.current.set(0, 0)
    canvas.addEventListener('pointerleave', relax)
    return () => canvas.removeEventListener('pointerleave', relax)
  }, [gl])

  useFrame((state, delta) => {
    const cfg = config.current
    const time = state.clock.elapsedTime

    target.current.set(
      (state.pointer.x * 0.55 + Math.sin(time * 0.61) * 0.02) * cfg.amount,
      (-state.pointer.y * 0.42 + Math.cos(time * 0.47) * 0.018) * cfg.amount,
    )

    // stiffness: softness 0 = firm, 1 = wobbly
    const stiffness = lerp(190, 24, clamp(cfg.softness, 0, 1))
    const damping = 2 * Math.sqrt(stiffness) * 0.17

    const dt = Math.min(delta, 1 / 25)
    const steps = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 240))))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const ax = (target.current.x - offset.current.x) * stiffness - velocity.current.x * damping
      const az = (target.current.y - offset.current.y) * stiffness - velocity.current.y * damping
      velocity.current.x += ax * h
      velocity.current.y += az * h
      offset.current.x += velocity.current.x * h
      offset.current.y += velocity.current.y * h
    }

    const limit = 0.75
    offset.current.x = clamp(offset.current.x, -limit, limit)
    offset.current.y = clamp(offset.current.y, -limit, limit)

  })

  const value = useMemo(() => offset, [])

  return (
    <JellyContext.Provider value={value}>{children}</JellyContext.Provider>
  )
}
