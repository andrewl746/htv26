import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import type { BufferGeometry, Group, Material, Mesh, Object3D } from 'three'
import type { ContextBuilding } from '@contracts/types'
import {
  applyGrowth,
  buildBuilding,
  disposeBuilt,
  disposeMerged,
  mergeStreet,
  setSlot,
  streetGrid,
  type BuiltBuilding,
  type MergedStreet,
} from './buildings'
import { cutawayDepthMaterial } from './cutaway'
import { LOOK } from './look'
import { setOccluders, slotOf, SLOTS } from './occlusion'
import type { StreetFrame } from './streetFrame'
import { growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'
import { slotMaterial, useStreetMaterials, type StreetMaterials } from './useStreetMaterials'

/**
 * The street merges in tasks of at most this long, one after another, so frames (the map's flight
 * or the ripple) still draw in between. Idle callbacks would wait: the scene leaves little idle time.
 */
const MERGE_SLICE_MS = 3
/**
 * From this long before the ripple ends, the merged meshes go up to the GPU one a frame, drawing
 * nothing yet; at the ripple's end the street only switches which meshes it draws.
 */
const UPLOAD_LEAD_S = 0.6

/** A neighbour's mesh: it sinks with its slot, and so does its shadow. */
function StreetMesh({ geometry, material, ref }: { geometry: BufferGeometry; material: Material; ref?: Ref<Mesh> }) {
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      customDepthMaterial={cutawayDepthMaterial}
      castShadow
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
        <StreetMesh key={part.slot} geometry={part.geometry} material={slotMaterial(materials, part.slot, building.colorIndex)} />
      ))}
    </group>
  )
}

/** Counts the streets built, so a street built again merges and switches afresh. */
let streetsBuilt = 0

/**
 * The neighbouring buildings. They grow one by one in the ripple, then the street switches to one
 * merged mesh per colour so a full 150 m street costs a handful of draw calls (MASTERSPEC 6.3).
 */
export function Street({ buildings, street }: { buildings: ContextBuilding[]; street: StreetFrame | null }) {
  // MASTERSPEC 6.3 performance: at most 400 buildings, the nearest ones.
  const [built, key] = useMemo(() => {
    const grid = streetGrid(buildings)
    const nearest = buildings
      .filter((b) => !b.on_lot)
      .map((b) => buildBuilding(b, grid, LOOK, street))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SLOTS.buildings)
    nearest.forEach((b, i) => setSlot(b, slotOf('buildings', i)))
    return [nearest, ++streetsBuilt] as const
  }, [buildings, street])
  useEffect(() => () => disposeBuilt(built), [built])
  useLayoutEffect(() => {
    setOccluders('buildings', built.map((b) => b.box))
    return () => setOccluders('buildings', [])
  }, [built])
  const materials = useStreetMaterials({ cutaway: true })
  return <StreetParts key={key} built={built} materials={materials} />
}

function StreetParts({ built, materials }: { built: BuiltBuilding[]; materials: StreetMaterials }) {
  const merged = useSlicedMerge(built)
  const growing = useRef<Group>(null)
  const [switched, setSwitched] = useState(false)
  const onSwitch = useCallback(() => {
    // In the frame the merged street first draws in full, so no building is drawn twice or missing.
    hide(growing.current)
    setSwitched(true)
  }, [])
  // The same elements every render, so the merge finishing does not render 400 buildings again.
  const growingBuildings = useMemo(
    // Keyed by position: one massing polygon can come back as several parts with the same id.
    () => built.map((b, i) => <GrowingBuilding key={i} building={b} materials={materials} />),
    [built, materials],
  )
  return (
    <>
      {merged && <MergedStreet merged={merged} materials={materials} onSwitch={onSwitch} />}
      {!switched && <group ref={growing}>{growingBuildings}</group>}
    </>
  )
}

/** The street merged a slice at a time, starting once it is built; null until then, or for good if it cannot be. */
function useSlicedMerge(built: BuiltBuilding[]): MergedStreet | null {
  const [merged, setMerged] = useState<MergedStreet | null>(null)
  useEffect(() => {
    const steps = mergeStreet(built)
    let handle = 0
    const slice = () => {
      const until = performance.now() + MERGE_SLICE_MS
      do {
        const step = steps.next()
        if (step.done) {
          setMerged(step.value)
          return
        }
      } while (performance.now() < until)
      handle = window.setTimeout(slice, 0)
    }
    handle = window.setTimeout(slice, 0)
    return () => window.clearTimeout(handle)
  }, [built])
  useEffect(
    () => () => {
      if (merged) disposeMerged(merged)
    },
    [merged],
  )
  return merged
}

function hide(object: Object3D | null) {
  if (object) object.visible = false
}

/** The merged meshes drawn in full, and culled as usual again. */
function drawInFull(meshes: Mesh[]) {
  for (const mesh of meshes) {
    mesh.visible = true
    mesh.geometry.setDrawRange(0, Infinity)
    mesh.frustumCulled = true
  }
}

/**
 * The merged street, mounted as soon as it is merged but hidden. Near the ripple's end its meshes
 * become visible one a frame with nothing to draw, which sends their buffers to the GPU spread out;
 * at the end they draw in full and the growing buildings hide (onSwitch), in the same frame.
 */
function MergedStreet({
  merged,
  materials,
  onSwitch,
}: {
  merged: MergedStreet
  materials: StreetMaterials
  onSwitch: () => void
}) {
  const parts = useMemo(
    () => [
      ...merged.walls.flatMap((geometry, i) => (geometry ? [{ key: `wall-${i}`, geometry, material: materials.walls[i] }] : [])),
      ...merged.shared.map((p) => ({ key: p.slot, geometry: p.geometry, material: slotMaterial(materials, p.slot, 0) })),
    ],
    [merged, materials],
  )
  const meshes = useRef<Mesh[]>([])
  // Once, as each mesh is first attached: hidden, with nothing to draw, and sent up to the GPU
  // wherever the camera looks once it is shown.
  const attach = useCallback((mesh: Mesh | null) => {
    if (!mesh || meshes.current.includes(mesh)) return
    meshes.current.push(mesh)
    mesh.visible = false
    mesh.frustumCulled = false
    mesh.geometry.setDrawRange(0, 0)
  }, [])

  const sent = useRef(0)
  const done = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    const list = meshes.current
    if (done.current || list.length < parts.length || t < timeline.ripple.end - UPLOAD_LEAD_S) return
    if (sent.current < list.length) {
      list[sent.current++].visible = true
      return
    }
    if (t < timeline.ripple.end) return
    drawInFull(list)
    done.current = true
    onSwitch()
  })

  return (
    <group>
      {parts.map((p) => (
        <StreetMesh key={p.key} ref={attach} geometry={p.geometry} material={p.material} />
      ))}
    </group>
  )
}
