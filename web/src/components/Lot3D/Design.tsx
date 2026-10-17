import { useEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, MeshStandardMaterial, type Group } from 'three'
import type { Design as DesignSpec, LocalPoint } from '@contracts/types'
import { tokenHex } from '../../styles/tokens'
import { shapeFrom } from './geometry'
import { planFloors } from './floors'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// Step 5 (MASTERSPEC 6.3): the basement rises out of the ground, then each floor drops from 6 m
// above its resting height and lands with a squash and stretch. Each home has its own warm colour.
const DROP_M = 6
/** Of a floor's 0.45 s, the last 120 ms is the landing. */
const FALL_SHARE = 0.33 / 0.45
const SQUASH = { y: 0.15, xz: 0.08 }

const homeToken = (id: number) => `--suplex-home-${id}`

export function Design({ placement, spec }: { placement: LocalPoint[]; spec: DesignSpec }) {
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
      const p = progress(t, span)
      if (level.level.level < 0) {
        g.position.y = level.bottom - level.level.height_m * (1 - ease.outCubic(p))
        return
      }
      if (p < FALL_SHARE) {
        g.position.y = level.bottom + DROP_M * (1 - ease.inQuad(p / FALL_SHARE))
        g.scale.set(1, 1, 1)
        return
      }
      const bump = Math.sin((Math.PI * (p - FALL_SHARE)) / (1 - FALL_SHARE))
      g.position.y = level.bottom
      g.scale.set(1 + SQUASH.xz * bump, 1 - SQUASH.y * bump, 1 + SQUASH.xz * bump)
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
