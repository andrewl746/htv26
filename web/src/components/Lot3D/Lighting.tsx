import { Color } from 'three'
import { tokenHex } from '../../styles/tokens'
import type { Vec3 } from './geometry'

// Golden-hour light (MASTERSPEC 6.3): a low warm-white sun from the south-west with soft shadows,
// and a hemisphere light with the sky token above and the ground token below.
const SUN_BEARING_DEG = 225
const SUN_ELEVATION_DEG = 25
const SUN_DISTANCE_M = 120
const SHADOW_HALF_EXTENT_M = 70
/** The sun token at full strength tints every surface orange; half of it reads as warm white. */
const SUN_WHITE_MIX = 0.5

function sunPosition(): Vec3 {
  const bearing = (SUN_BEARING_DEG * Math.PI) / 180
  const elevation = (SUN_ELEVATION_DEG * Math.PI) / 180
  const flat = SUN_DISTANCE_M * Math.cos(elevation)
  return [flat * Math.sin(bearing), SUN_DISTANCE_M * Math.sin(elevation), -flat * Math.cos(bearing)]
}

export function Lighting() {
  const sun = new Color(tokenHex('--suplex-sun')).lerp(new Color('white'), SUN_WHITE_MIX)
  return (
    <>
      <hemisphereLight args={[tokenHex('--suplex-sky-bottom'), tokenHex('--suplex-ground'), 1.6]} />
      <directionalLight
        position={sunPosition()}
        color={sun}
        intensity={3.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_HALF_EXTENT_M}
        shadow-camera-right={SHADOW_HALF_EXTENT_M}
        shadow-camera-top={SHADOW_HALF_EXTENT_M}
        shadow-camera-bottom={-SHADOW_HALF_EXTENT_M}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE_M * 2}
      />
    </>
  )
}
