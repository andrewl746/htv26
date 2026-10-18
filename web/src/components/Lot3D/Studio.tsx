import { Environment, Lightformer } from '@react-three/drei'
import { Color } from 'three'
import { tokenHex } from '../../styles/tokens'
import { OFF } from './debug'
import { sunPosition } from './sun'

// A15: the drawn look's light. The image-based light comes from an environment built in the scene
// from drei Lightformers, rendered once into a cube map: no HDR file is downloaded, so the demo
// runs with the Wi-Fi off. A low warm sun from the south-west (the same direction as the shadow
// light), a soft sky above, a warm bounce from the ground and two cool fills that give the glass
// something to reflect.
const ENV_RESOLUTION = 256
const ENV_INTENSITY = 0.6
/** The sun carries the shadows; the environment fills them without washing them out. */
const SUN_INTENSITY = OFF.has('warm') ? 3.4 : 3.8
/**
 * Shadows: crisp, as on a sunny afternoon (the filter radius is in texels), over a box wide enough
 * to reach down the street the drawn look continues past the data (streetExtension.ts) with finer
 * texels than before: ±100 m over 3072 is 6.5 cm a texel, against ±70 m over 2048 (6.8 cm). The
 * light stands far back along the sun's direction, so the box's depth holds every caster in it;
 * the bias is in that depth's units, so it shrinks as the depth grows (the same 10 cm). Dev
 * ?off=shadowbox brings back the old box for comparison.
 */
const SHADOW = OFF.has('shadowbox')
  ? { mapSize: 2048, radius: 5, halfExtentM: 70, lightDistanceM: 120, bias: -0.0004, normalBias: 0.04 }
  : { mapSize: 3072, radius: 3, halfExtentM: 100, lightDistanceM: 400, bias: -0.00012, normalBias: 0.04 }
const HEMI_INTENSITY = 0.25
/** Late afternoon: the sun token's warmth mostly kept (the classic look mixes half of it away). */
const SUN_WHITE_MIX = OFF.has('warm') ? 0.45 : 0.25

export function Studio({ shadows }: { shadows: boolean }) {
  const sun = new Color(tokenHex('--suplex-sun')).lerp(new Color('white'), SUN_WHITE_MIX)
  const [x, y, z] = sunPosition()
  const back = SHADOW.lightDistanceM / Math.hypot(x, y, z)
  return (
    <>
      {!OFF.has('env') && <Environment frames={1} resolution={ENV_RESOLUTION} environmentIntensity={ENV_INTENSITY}>
        {/* The sun disc, low in the south-west. */}
        <Lightformer form="circle" intensity={6} color="#ffd29a" position={[x / 4, y / 4, z / 4]} scale={14} target={[0, 0, 0]} />
        {/* The sky: a wide soft panel overhead and a pale ring round the horizon. */}
        <Lightformer form="rect" intensity={1.4} color="#eef3ff" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#fff4e2" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={60} />
        {/* Warm bounce from the street. */}
        <Lightformer form="rect" intensity={0.5} color="#e9dcc4" position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[80, 80, 1]} />
        {/* Cool fills to the north and east, for reflections in the windows. */}
        <Lightformer form="rect" intensity={0.9} color="#cfe0ff" position={[0, 10, -40]} scale={[50, 14, 1]} target={[0, 4, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#dfe9ff" position={[40, 8, 0]} scale={[40, 12, 1]} target={[0, 4, 0]} />
      </Environment>}
      <hemisphereLight args={[tokenHex('--suplex-sky-bottom'), tokenHex('--suplex-ground'), HEMI_INTENSITY]} />
      <directionalLight
        position={[x * back, y * back, z * back]}
        color={sun}
        intensity={SUN_INTENSITY}
        // The light always casts, so turning shadows off never changes (and recompiles) a shader.
        castShadow
        shadow-intensity={shadows ? 1 : 0}
        shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
        shadow-radius={SHADOW.radius}
        shadow-bias={SHADOW.bias}
        shadow-normalBias={SHADOW.normalBias}
        shadow-camera-left={-SHADOW.halfExtentM}
        shadow-camera-right={SHADOW.halfExtentM}
        shadow-camera-top={SHADOW.halfExtentM}
        shadow-camera-bottom={-SHADOW.halfExtentM}
        shadow-camera-near={1}
        shadow-camera-far={SHADOW.lightDistanceM * 2}
      />
    </>
  )
}
