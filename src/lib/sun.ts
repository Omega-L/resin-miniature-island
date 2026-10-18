import * as THREE from 'three'

/** World-space direction pointing towards the sun. */
export function sunDirection(angleDeg: number, elevationDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(angleDeg)
  const el = THREE.MathUtils.degToRad(elevationDeg)
  return new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
  )
}
