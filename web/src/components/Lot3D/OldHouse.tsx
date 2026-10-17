import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { ContextBuilding } from '@contracts/types'
import { applyGrowth, buildBuilding, disposeBuilt } from './buildings'
import { ease, growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { useStreetMaterials } from './useStreetMaterials'

/** How much wider the old house spreads as it squashes flat. */
const SQUASH_WIDEN = 0.15

/**
 * Step 4 (MASTERSPEC 6.3): the building on the lot grows in with its neighbours, then squashes to
 * the ground (its label is in labels.ts). Without a design to place, as on a lot that is not
 * checked, the house simply stays.
 */
export function OldHouse({ buildings, squash }: { buildings: ContextBuilding[]; squash: boolean }) {
  const built = useMemo(() => buildings.filter((b) => b.on_lot).map(buildBuilding), [buildings])
  useEffect(() => () => disposeBuilt(built), [built])
  const materials = useStreetMaterials({ cutaway: false })
  const groups = useRef<(Group | null)[]>([])

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
  })

  return (
    <group>
      {built.map((b, i) => (
        <group
          key={i}
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
    </group>
  )
}
