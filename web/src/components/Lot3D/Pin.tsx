import { useRef } from 'react'
import type { Group } from 'three'
import { tokenHex } from '../../styles/tokens'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// Step 0 (MASTERSPEC 6.3): a map pin falls from 40 m onto the lot with a small bounce. It rests on
// top of the house that is there today and shrinks away when that house goes in step 4.
const DROP_M = 40
const BOUNCE_M = 1.2
/** Share of the step spent falling; the rest is the bounce. */
const FALL_SHARE = 0.7
const HEAD_RADIUS_M = 0.9
const TIP_HEIGHT_M = 2

export function Pin({ restHeight, leaves }: { restHeight: number; leaves: boolean }) {
  const group = useRef<Group>(null)
  useSequenceFrame((t, { timeline }) => {
    const g = group.current
    if (!g) return
    const p = progress(t, timeline.pin)
    const lift =
      p < FALL_SHARE
        ? DROP_M * (1 - (p / FALL_SHARE) ** 2)
        : BOUNCE_M * Math.sin((Math.PI * (p - FALL_SHARE)) / (1 - FALL_SHARE))
    g.position.y = restHeight + lift
    const gone = leaves ? ease.outCubic(progress(t, timeline.oldHouse)) : 0
    g.visible = t >= timeline.pin.start && gone < 1
    g.scale.setScalar(Math.max(1 - gone, 0.001))
  })
  const color = tokenHex('--suplex-accent')
  return (
    <group ref={group} visible={false}>
      {/* receiveShadow too, so the pin shares the shader the WarmUp compiled for everything else */}
      <mesh position={[0, TIP_HEIGHT_M + HEAD_RADIUS_M * 0.6, 0]} castShadow receiveShadow>
        <sphereGeometry args={[HEAD_RADIUS_M, 24, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, TIP_HEIGHT_M / 2, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[HEAD_RADIUS_M * 0.55, TIP_HEIGHT_M, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  )
}
