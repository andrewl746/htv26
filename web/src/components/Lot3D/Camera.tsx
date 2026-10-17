import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { Vec3 } from './geometry'

// The resting view after the swoop (MASTERSPEC 6.3 step 1): a 35° tilt on the street side of the
// lot. The spec's 45 m cuts off the front of a 40 m deep lot, so it sits a little further out.
// The swoop itself arrives with the timeline in J3.
const DISTANCE_M = 60
const TILT_DEG = 35
const TARGET: Vec3 = [0, 2, 0]

/** A lot with no measurable frontage has no bearing; look from the south. */
const DEFAULT_BEARING_DEG = 180

function streetSide(bearingDeg: number): Vec3 {
  const bearing = (bearingDeg * Math.PI) / 180
  const tilt = (TILT_DEG * Math.PI) / 180
  const flat = DISTANCE_M * Math.cos(tilt)
  return [flat * Math.sin(bearing), DISTANCE_M * Math.sin(tilt), -flat * Math.cos(bearing)]
}

export function Camera({ frontBearingDeg }: { frontBearingDeg: number | null }) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={40}
        near={1}
        far={1000}
        position={streetSide(frontBearingDeg ?? DEFAULT_BEARING_DEG)}
      />
      <OrbitControls
        makeDefault
        target={TARGET}
        enableDamping
        enablePan={false}
        minDistance={15}
        maxDistance={110}
        maxPolarAngle={1.35}
      />
    </>
  )
}
