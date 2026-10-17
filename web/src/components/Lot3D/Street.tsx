import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import type { ContextBuilding } from '@contracts/types'
import { applyGrowth, buildBuilding, disposeBuilt, mergeStreet, type BuiltBuilding } from './buildings'
import { LOOK } from './look'
import { growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { slotMaterial, useStreetMaterials, type StreetMaterials } from './useStreetMaterials'

/** MASTERSPEC 6.3 performance: at most 400 buildings, the nearest ones. */
const MAX_BUILDINGS = 400

/** One building growing in its slot of the ripple, later the further it is from the lot. */
export function GrowingBuilding({ building, materials }: { building: BuiltBuilding; materials: StreetMaterials }) {
  const group = useRef<Group>(null)
  useSequenceFrame((t, { timeline }) => {
    if (group.current) applyGrowth(group.current, progress(t, growSpan(timeline, building.distance)))
  })
  return (
    <group ref={group} position={[building.x, 0, building.z]} visible={false}>
      {building.parts.map((part) => (
        <mesh
          key={part.slot}
          geometry={part.geometry}
          material={slotMaterial(materials, part.slot, building.colorIndex)}
          castShadow
          receiveShadow
          dispose={null}
        />
      ))}
    </group>
  )
}

/**
 * The neighbouring buildings. They grow one by one in the ripple, then the street switches to one
 * merged mesh per colour so a full 150 m street costs a handful of draw calls (MASTERSPEC 6.3).
 */
export function Street({ buildings }: { buildings: ContextBuilding[] }) {
  const built = useMemo(
    () =>
      buildings
        .filter((b) => !b.on_lot)
        .map((b) => buildBuilding(b, LOOK))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_BUILDINGS),
    [buildings],
  )
  useEffect(() => () => disposeBuilt(built), [built])
  const materials = useStreetMaterials({ cutaway: true })

  const [merged, setMerged] = useState(false)
  const asked = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    if (!asked.current && t >= timeline.ripple.end) {
      asked.current = true
      setMerged(true)
    }
  })

  return merged ? (
    <MergedStreet built={built} materials={materials} />
  ) : (
    <group>
      {/* Keyed by position: one massing polygon can come back as several parts with the same id. */}
      {built.map((b, i) => (
        <GrowingBuilding key={i} building={b} materials={materials} />
      ))}
    </group>
  )
}

function MergedStreet({ built, materials }: { built: BuiltBuilding[]; materials: StreetMaterials }) {
  const merged = useMemo(() => mergeStreet(built), [built])
  useEffect(() => () => [...merged.walls, merged.roof, merged.flat].forEach((g) => g?.dispose()), [merged])
  return (
    <group>
      {merged.walls.map(
        (g, i) => g && <mesh key={i} geometry={g} material={materials.walls[i]} castShadow receiveShadow dispose={null} />,
      )}
      {merged.roof && <mesh geometry={merged.roof} material={materials.roof} castShadow receiveShadow dispose={null} />}
      {merged.flat && <mesh geometry={merged.flat} material={materials.flat} castShadow receiveShadow dispose={null} />}
    </group>
  )
}
