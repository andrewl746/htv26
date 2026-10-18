import { useEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, MeshStandardMaterial, type Group } from 'three'
import type { Design as DesignSpec, LocalPoint } from '@contracts/types'
import { tokenHex } from '../../styles/tokens'
import { shapeFrom } from './geometry'
import { planFloors } from './floors'
import { poseLevel } from './levelDrop'
import { progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// The classic look (?look=classic): each level is a plain slab per home, in that home's warm colour.
// Step 5's motion (the basement rising, the floors dropping in) is levelDrop.ts.

const homeToken = (id: number) => `--suplex-home-${id}`

export function ClassicDesign({ placement, spec }: { placement: LocalPoint[]; spec: DesignSpec }) {
  const plan = useMemo(() => planFloors(placement, spec), [placement, spec])
  const [cx, cy] = plan.frame.centre

  const materials = useMemo(
    () =>
      new Map(
        spec.homes.map((h) => [h.id, new MeshStandardMaterial({ color: tokenHex(homeToken(h.id)), roughness: 0.65 })]),
      ),
    [spec],
  )
  const fallback = materials.get(spec.homes[0]?.id)
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])

  // Each slab is built around the footprint centre so its floor can squash about its own base.
  const geometries = useMemo(
    () =>
      plan.levels.map((level) =>
        level.slabs.map((slab) =>
          new ExtrudeGeometry(shapeFrom(slab.corners), { depth: level.height, bevelEnabled: false })
            .rotateX(-Math.PI / 2)
            .translate(-cx, 0, cy),
        ),
      ),
    [plan, cx, cy],
  )
  useEffect(() => () => geometries.flat().forEach((g) => g.dispose()), [geometries])

  const groups = useRef<(Group | null)[]>([])
  useSequenceFrame((t, { timeline }) => {
    plan.levels.forEach((level, i) => {
      const g = groups.current[i]
      const span = timeline.floors[i]
      if (!g || !span) return
      g.visible = t >= span.start
      poseLevel(g, progress(t, span), level.bottom, level.level.level < 0 ? level.level.height_m : null)
    })
  })

  return (
    <group>
      {plan.levels.map((level, i) => (
        <group
          key={level.level.level}
          ref={(el) => {
            groups.current[i] = el
          }}
          position={[cx, level.bottom, -cy]}
          visible={false}
        >
          {level.slabs.map((slab, j) => (
            <mesh
              key={j}
              geometry={geometries[i][j]}
              material={(slab.home && materials.get(slab.home.id)) || fallback}
              castShadow
              receiveShadow
              dispose={null}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
