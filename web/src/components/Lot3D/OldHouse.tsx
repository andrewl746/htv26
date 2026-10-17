import { useEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { disclaimers } from '../../copy'
import { applyGrowth, buildBuilding, disposeBuilt } from './buildings'
import { midpoint, toScene } from './geometry'
import { ease, growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { useStreetMaterials } from './useStreetMaterials'

/** How much wider the old house spreads as it squashes flat. */
const SQUASH_WIDEN = 0.15
const LABEL_Y = 0.4

/**
 * Step 4 (MASTERSPEC 6.3): the building on the lot grows in with its neighbours, then squashes to
 * the ground under an "illustrative new-build scenario" label. A vacant lot says so instead.
 * Without a design to place (a lot that is not checked) the house simply stays.
 */
export function OldHouse({
  buildings,
  vacant,
  frontage,
  squash,
}: {
  buildings: ContextBuilding[]
  vacant: boolean
  frontage: [LocalPoint, LocalPoint] | null
  squash: boolean
}) {
  const built = useMemo(() => buildings.filter((b) => b.on_lot).map(buildBuilding), [buildings])
  useEffect(() => () => disposeBuilt(built), [built])
  const materials = useStreetMaterials()
  const groups = useRef<(Group | null)[]>([])
  const label = useRef<HTMLDivElement>(null)

  const text = built.length ? (squash ? disclaimers.illustrative : null) : vacant ? disclaimers.no_building : null
  const labelAt = toScene(frontage ? midpoint(...frontage) : [0, 0], LABEL_Y)

  useSequenceFrame((t, { timeline }) => {
    built.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      if (!squash || t < timeline.oldHouse.start) {
        applyGrowth(g, progress(t, growSpan(timeline, b.distance)))
        return
      }
      const p = ease.inQuad(progress(t, timeline.oldHouse))
      g.visible = p < 1
      g.scale.set(1 + SQUASH_WIDEN * p, Math.max(1 - p, 0.001), 1 + SQUASH_WIDEN * p)
    })
    if (label.current) label.current.style.opacity = String(progress(t, timeline.oldHouse))
  })

  return (
    <group>
      {built.map((b, i) => (
        <group
          key={b.id}
          ref={(el) => {
            groups.current[i] = el
          }}
          position={[b.x, 0, b.z]}
          visible={false}
        >
          <mesh geometry={b.body} material={materials.walls[b.colorIndex]} castShadow receiveShadow dispose={null} />
          {b.roof && <mesh geometry={b.roof} material={materials.roof} castShadow receiveShadow dispose={null} />}
        </group>
      ))}
      {text && (
        <Html position={labelAt} center zIndexRange={[20, 0]} pointerEvents="none">
          <div ref={label} className="scene-label scene-label-muted" style={{ opacity: 0 }}>
            {text}
          </div>
        </Html>
      )}
    </group>
  )
}
