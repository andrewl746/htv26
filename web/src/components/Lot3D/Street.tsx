import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BufferGeometry, Group, Material } from 'three'
import type { ContextBuilding } from '@contracts/types'
import { applyGrowth, buildBuilding, disposeBuilt, mergeStreet, setSlot, streetGrid, type BuiltBuilding, type PartSlot } from './buildings'
import { cutawayDepthMaterial } from './cutaway'
import { LOOK } from './look'
import { setOccluders, slotOf, SLOTS } from './occlusion'
import type { StreetFrame } from './streetFrame'
import { growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { slotMaterial, useStreetMaterials, type StreetMaterials } from './useStreetMaterials'

/** Windows, trim and doors sit on the walls: their shadows don't show, but each would be another shadow-map draw. */
const NO_SHADOW: ReadonlySet<PartSlot> = new Set<PartSlot>(['glass', 'trim', 'door'])

/** A neighbour's mesh: it sinks with its slot, and so does its shadow. */
function StreetMesh({ geometry, material, slot }: { geometry: BufferGeometry; material: Material; slot: PartSlot }) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      customDepthMaterial={cutawayDepthMaterial}
      castShadow={!NO_SHADOW.has(slot)}
      receiveShadow
      dispose={null}
    />
  )
}

/** One building growing in its slot of the ripple, later the further it is from the lot. */
export function GrowingBuilding({ building, materials }: { building: BuiltBuilding; materials: StreetMaterials }) {
  const group = useRef<Group>(null)
  useSequenceFrame((t, { timeline }) => {
    if (group.current) applyGrowth(group.current, progress(t, growSpan(timeline, building.distance)))
  })
  return (
    <group ref={group} position={[building.x, 0, building.z]} visible={false}>
      {building.parts.map((part) => (
        <StreetMesh key={part.slot} geometry={part.geometry} material={slotMaterial(materials, part.slot, building.colorIndex)} slot={part.slot} />
      ))}
    </group>
  )
}

/**
 * The neighbouring buildings. They grow one by one in the ripple, then the street switches to one
 * merged mesh per colour so a full 150 m street costs a handful of draw calls (MASTERSPEC 6.3).
 */
export function Street({ buildings, street }: { buildings: ContextBuilding[]; street: StreetFrame | null }) {
  // MASTERSPEC 6.3 performance: at most 400 buildings, the nearest ones.
  const built = useMemo(() => {
    const grid = streetGrid(buildings)
    const nearest = buildings
      .filter((b) => !b.on_lot)
      .map((b) => buildBuilding(b, grid, LOOK, street))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SLOTS.buildings)
    nearest.forEach((b, i) => setSlot(b, slotOf('buildings', i)))
    return nearest
  }, [buildings, street])
  useEffect(() => () => disposeBuilt(built), [built])
  useLayoutEffect(() => {
    setOccluders('buildings', built.map((b) => b.box))
    return () => setOccluders('buildings', [])
  }, [built])
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
  useEffect(() => () => [...merged.walls, ...merged.shared.map((p) => p.geometry)].forEach((g) => g?.dispose()), [merged])
  return (
    <group>
      {merged.walls.map((g, i) => g && <StreetMesh key={i} geometry={g} material={materials.walls[i]} slot="wall" />)}
      {merged.shared.map((p) => (
        <StreetMesh key={p.slot} geometry={p.geometry} material={slotMaterial(materials, p.slot, 0)} slot={p.slot} />
      ))}
    </group>
  )
}
