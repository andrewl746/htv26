import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { Design as DesignSpec, LocalPoint } from '@contracts/types'
import { placementFrame } from './floors'
import { poseLevel } from './levelDrop'
import { buildFacade } from './models/build'
import { facadeMaterial } from './models/materials'
import type { FacadeModel } from './models/types'
import { progress } from './timeline'
import { useSequenceFrame } from './useSequence'

/**
 * A16: the selected design as the City drew it (models/*.ts), standing on its placement. Each level
 * of designs.json drops in on its own with the classic motion (levelDrop.ts); the homes keep their
 * colours in the glow of their windows, matching their labels.
 */
export function DrawnDesign({ placement, spec, model }: { placement: LocalPoint[]; spec: DesignSpec; model: FacadeModel }) {
  const facade = useMemo(() => buildFacade(model, spec), [model, spec])
  useEffect(() => () => facade.levels.forEach((l) => l.parts.forEach((p) => p.geometry.dispose())), [facade])

  // The model's frame (u across from the left wall, v back from the front) onto the placement:
  // its centre on the placement's centre, its u axis along the front wall.
  const frame = useMemo(() => placementFrame(placement), [placement])
  const [ax, ay] = [frame.across[0] / frame.width, frame.across[1] / frame.width]
  const [cx, cy] = frame.centre
  const scale: [number, number, number] = [frame.width / model.width, 1, frame.length / model.length]

  const groups = useRef<(Group | null)[]>([])
  useSequenceFrame((t, { timeline }) => {
    facade.levels.forEach((level, i) => {
      const g = groups.current[i]
      const span = timeline.floors[i]
      if (!g || !span) return
      g.visible = t >= span.start
      const rest = level.base - facade.grade
      poseLevel(g, progress(t, span), rest, level.level.level < 0 ? level.height : null)
    })
  })

  return (
    <group position={[cx, 0, -cy]} rotation={[0, Math.atan2(ay, ax), 0]} scale={scale}>
      {facade.levels.map((level, i) => (
        <group
          key={level.level.level}
          ref={(el) => {
            groups.current[i] = el
          }}
          position={[0, level.base - facade.grade, 0]}
          visible={false}
        >
          {level.parts.map((part) => (
            <mesh
              key={part.key}
              geometry={part.geometry}
              material={facadeMaterial(part.key)}
              renderOrder={part.order}
              castShadow={part.shadows}
              receiveShadow={part.shadows}
              dispose={null}
            />
          ))}
        </group>
      ))}
    </group>
  )
}
