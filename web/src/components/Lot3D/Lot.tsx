import { useMemo, useRef, type ComponentRef } from 'react'
import { Line } from '@react-three/drei'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { DesignResult, LocalPoint } from '@contracts/types'
import { token, tokenHex } from '../../styles/tokens'
import { FLAT, perimeter, ringAt, shapeFrom } from './geometry'
import { LOOK } from './look'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// Step 3 (MASTERSPEC 6.3): the lot outline traces itself, the setback strips fade in, then the
// buildable area paints onto the ground. Small lifts keep the flat layers from z-fighting, and the
// render order keeps each layer on top of the one before.
const LOT_Y = 0.02
const SETBACK_Y = 0.04
const BUILDABLE_Y = 0.05
const OUTLINE_Y = 0.07
/** The drawn look shows the lot as a light wash over the lawn, not an opaque pad. */
const DRAWN_LOT_OPACITY = 0.35

type FadeStep = 'outline' | 'setbacks' | 'buildable'

function GroundPatch({
  points,
  y,
  colorToken,
  step,
  order,
  opacityScale = 1,
}: {
  points: LocalPoint[]
  y: number
  colorToken: string
  step: FadeStep
  order: number
  opacityScale?: number
}) {
  const shape = useMemo(() => shapeFrom(points), [points])
  const { color } = token(colorToken)
  const opacity = token(colorToken).opacity * opacityScale
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshStandardMaterial>(null)
  useSequenceFrame((t, { timeline }) => {
    const p = progress(t, timeline[step])
    if (mesh.current) mesh.current.visible = p > 0
    if (material.current) material.current.opacity = opacity * p
  })
  return (
    <mesh ref={mesh} rotation={FLAT} position={[0, y, 0]} renderOrder={order} receiveShadow visible={false}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial ref={material} color={color} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Outline({ polygon }: { polygon: LocalPoint[] }) {
  const points = useMemo(() => ringAt(polygon, OUTLINE_Y), [polygon])
  const length = useMemo(() => perimeter(polygon), [polygon])
  const group = useRef<Group>(null)
  const line = useRef<ComponentRef<typeof Line>>(null)
  useSequenceFrame((t, { timeline }) => {
    const p = ease.outCubic(progress(t, timeline.outline))
    if (group.current) group.current.visible = p > 0
    // One dash as long as the whole ring, slid into view: the outline draws itself.
    if (line.current) line.current.material.dashOffset = length * (1 - p)
  })
  return (
    <group ref={group} visible={false}>
      <Line
        ref={line}
        points={points}
        color={tokenHex('--suplex-accent')}
        lineWidth={2.5}
        dashed
        dashSize={length * 1.001}
        gapSize={length}
        dashOffset={length}
      />
    </group>
  )
}

/** The lot on the ground: its fill and outline, and the selected design's setbacks and buildable area. */
export function Lot({ polygon, design }: { polygon: LocalPoint[]; design: DesignResult | null }) {
  const setbacks = design?.setbacks_local
  return (
    <group>
      <GroundPatch
        points={polygon}
        y={LOT_Y}
        colorToken="--suplex-lot"
        step="outline"
        order={1}
        opacityScale={LOOK === 'drawn' ? DRAWN_LOT_OPACITY : 1}
      />
      {design && setbacks && (
        <group key={`setbacks-${design.design_id}`}>
          {[setbacks.front, setbacks.rear, setbacks.left, setbacks.right].map((strip, i) => (
            <GroundPatch key={i} points={strip} y={SETBACK_Y} colorToken="--suplex-setback" step="setbacks" order={2} />
          ))}
        </group>
      )}
      {design?.buildable_local && (
        <GroundPatch
          key={`buildable-${design.design_id}`}
          points={design.buildable_local}
          y={BUILDABLE_Y}
          colorToken="--suplex-buildable"
          step="buildable"
          order={3}
        />
      )}
      <Outline polygon={polygon} />
    </group>
  )
}
