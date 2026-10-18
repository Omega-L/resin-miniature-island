import * as THREE from 'three'
import { sunDirection } from '../lib/sun'

export { sunDirection }

export function Lighting({ sunDir }: { sunDir: THREE.Vector3 }) {
  const position = sunDir.clone().multiplyScalar(26).add(new THREE.Vector3(0, 2, 0))

  return (
    <>
      <ambientLight intensity={0.18} color="#f7f0e4" />
      <hemisphereLight args={['#dcebf3', '#bcae94', 0.26]} />
      <directionalLight position={position} intensity={1.1} color="#fff2dc" />
      <directionalLight position={[-12, 8, -8]} intensity={0.22} color="#cfe6f4" />
    </>
  )
}
