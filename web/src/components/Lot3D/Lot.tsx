import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import type { DesignResult, LocalPoint } from '@contracts/types'
import { token, tokenHex } from '../../styles/tokens'
import { FLAT, ringAt, shapeFrom } from './geometry'

// Small lifts above the ground so the flat layers never z-fight.
const LOT_Y = 0.02
const SETBACK_Y = 0.04
const BUILDABLE_Y = 0.05
const OUTLINE_Y = 0.07

function GroundPatch({ points, y, colorToken }: { points: LocalPoint[]; y: number; colorToken: string }) {
  const shape = useMemo(() => shapeFrom(points), [points])
  const { color, opacity } = token(colorToken)
  return (
    <mesh rotation={FLAT} position={[0, y, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  )
}

/** The lot on the ground: its fill and outline, and the selected design's setbacks and buildable area. */
export function Lot({ polygon, design }: { polygon: LocalPoint[]; design: DesignResult }) {
  const outline = useMemo(() => ringAt(polygon, OUTLINE_Y), [polygon])
  const setbacks = design.setbacks_local
  return (
    <group>
      <GroundPatch points={polygon} y={LOT_Y} colorToken="--suplex-paper" />
      {setbacks &&
        [setbacks.front, setbacks.rear, setbacks.left, setbacks.right].map((strip, i) => (
          <GroundPatch key={i} points={strip} y={SETBACK_Y} colorToken="--suplex-setback" />
        ))}
      {design.buildable_local && (
        <GroundPatch points={design.buildable_local} y={BUILDABLE_Y} colorToken="--suplex-buildable" />
      )}
      <Line points={outline} color={tokenHex('--suplex-accent')} lineWidth={2.5} />
    </group>
  )
}
