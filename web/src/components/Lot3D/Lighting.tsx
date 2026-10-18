import { Color } from 'three'
import { tokenHex } from '../../styles/tokens'
import { sunPosition } from './sun'

// Golden-hour light (MASTERSPEC 6.3), the classic look: a low warm-white sun from the south-west
// with soft shadows, and a hemisphere light with the sky token above and the ground token below.
const SHADOW_HALF_EXTENT_M = 70
/** The sun token at full strength tints every surface orange; half of it reads as warm white. */
const SUN_WHITE_MIX = 0.5

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
        shadow-camera-far={Math.hypot(...sunPosition()) * 2}
      />
    </>
  )
}
