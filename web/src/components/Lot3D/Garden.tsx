import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ContextBuilding, DesignResult, LocalPoint } from '@contracts/types'
import { openRing, seededRandom, vertexMean } from './geometry'
import { fromFrame, inFrame, ROAD_CENTRE_M, type StreetFrame } from './streetFrame'
import { ease, growSpan, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// The drawn look's gardens, so the street looks lived in. Behind the new building: wooden fences
// down the sides and across the back, a shed, a patio with a table, chairs and an umbrella, a
// flower bed, a raised vegetable bed and a row of shrubs; they appear once the floors have landed,
// and only behind a design that fits: a lived-in yard behind one that doesn't (or is too close to
// call) would read as built, and on a width or depth failure the fences would cross the building.
// Behind the neighbouring houses: shrubs and the odd shed, growing in with the ripple. Decoration
// only: nothing here is read from data, and none of it hides the design.

const FENCE = { height: 1.8, panel: 0.05, post: 0.1, postEvery: 2.4, colour: '#8c6f52' }
const SHED = { w: 2.4, d: 1.8, h: 2.1, roof: 0.9, colours: ['#7d9a8a', '#a65d4b', '#c9b38a'] }
const PATIO = { w: 3.0, d: 2.6, stone: '#c8c2b5', furniture: '#f3f1ea', umbrella: ['#2e7d7a', '#c0533e', '#d9a93b'] }
const BED = { w: 0.7, soil: '#5a4334', flowers: ['#d94a5a', '#f2c94c', '#8e5cc2', '#f5f0e6', '#e8833a'] }
const SHRUB = { colours: ['#4f7a3a', '#5d8a43', '#466e35', '#6b9a4c'], radius: [0.45, 0.8] }
const NEIGHBOUR = { withinM: 75, behindM: [1.5, 3.5], shedShare: 0.3 }
/** How far in from the lot lines the garden keeps. */
const MARGIN_M = 0.7
const BAND_M = 4.5
const POP_S = 0.5

interface Shrub {
  position: Vector3
  scale: number
  colour: Color
  distance: number
}

interface Plan {
  /** Merged geometry per material for the new building's garden. */
  pieces: { colour: string; geometry: BufferGeometry }[]
  shrubs: Shrub[]
  flowers: Shrub[]
  /** Sheds behind neighbours, each growing on its own distance during the ripple. */
  neighbourSheds: { pieces: { colour: string; geometry: BufferGeometry }[]; distance: number; x: number; z: number }[]
  /** The same sheds merged per material in place, shown once the ripple is over. */
  shedsMerged: { colour: string; geometry: BufferGeometry }[]
}

/** One geometry per colour from a list of pieces (the inputs are disposed). */
function mergeByColour(byColour: Map<string, BufferGeometry[]>): { colour: string; geometry: BufferGeometry }[] {
  return [...byColour].flatMap(([colour, list]) => {
    const geometry = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)))
    list.forEach((g) => g.dispose())
    return geometry ? [{ colour, geometry }] : []
  })
}

const toScene = ([x, y]: LocalPoint, up: number) => new Vector3(x, up, -y)

/** A box standing on the ground at a local point, turned to the street. */
function box(at: LocalPoint, bottom: number, w: number, h: number, d: number, angle: number): BufferGeometry {
  return new BoxGeometry(w, h, d).toNonIndexed().rotateY(angle).translate(at[0], bottom + h / 2, -at[1])
}

function shed(at: LocalPoint, angle: number, colourIndex: number, push: (colour: string, g: BufferGeometry) => void) {
  push(SHED.colours[colourIndex % SHED.colours.length], box(at, 0, SHED.w, SHED.h, SHED.d, angle))
  const roof = new ConeGeometry(Math.hypot(SHED.w, SHED.d) / 2 + 0.2, SHED.roof, 4)
    .toNonIndexed()
    .rotateY(Math.PI / 4 + angle)
    .translate(at[0], SHED.h + SHED.roof / 2, -at[1])
  push('#4b4d52', roof)
  push('#3a2f28', box(at, 0, 0.8, 1.8, SHED.d + 0.04, angle))
}

function plan(lot: LocalPoint[], design: DesignResult | null, buildings: ContextBuilding[], street: StreetFrame): Plan {
  const byColour = new Map<string, BufferGeometry[]>()
  const push = (colour: string, g: BufferGeometry) => byColour.set(colour, [...(byColour.get(colour) ?? []), g])
  const shrubs: Shrub[] = []
  const flowers: Shrub[] = []
  const angle = Math.atan2(street.along[1], street.along[0])
  const random = seededRandom(street.mid)

  const placement = design?.result === 'fits' ? design.placement_local : null
  if (placement) {
    const ring = openRing(lot).map((p) => inFrame(street, p))
    const house = openRing(placement).map((p) => inFrame(street, p))
    const [sMin, sMax] = [Math.min(...ring.map((p) => p.s)), Math.max(...ring.map((p) => p.s))]
    const oRear = Math.min(...ring.map((p) => p.o))
    const oFront = Math.max(...house.map((p) => p.o))
    const oBack = Math.min(...house.map((p) => p.o))
    // The back of the rear yard, clear of the building's stairs and walkout.
    const band = { from: oRear + MARGIN_M, to: Math.min(oRear + BAND_M, oBack - 3.6) }
    const at = (s: number, o: number) => fromFrame(street, s, o)

    // Fences: down both sides from the building's front wall back, and across the rear.
    const fence = (s0: number, o0: number, s1: number, o1: number) => {
      const len = Math.hypot(s1 - s0, o1 - o0)
      const mid = at((s0 + s1) / 2, (o0 + o1) / 2)
      const turn = angle + Math.atan2(o1 - o0, s1 - s0)
      push(FENCE.colour, box(mid, 0, len, FENCE.height, FENCE.panel, turn))
      for (let t = 0; t <= len; t += FENCE.postEvery) {
        const k = t / len
        push(FENCE.colour, box(at(s0 + (s1 - s0) * k, o0 + (o1 - o0) * k), 0, FENCE.post, FENCE.height + 0.1, FENCE.post, turn))
      }
    }
    fence(sMin + 0.05, oFront, sMin + 0.05, oRear + 0.05)
    fence(sMax - 0.05, oFront, sMax - 0.05, oRear + 0.05)
    fence(sMin + 0.05, oRear + 0.05, sMax - 0.05, oRear + 0.05)

    if (band.to - band.from > 1.6 && sMax - sMin > 5) {
      const mid = (band.from + band.to) / 2
      // Shed in the back left corner, the raised bed in the back right.
      shed(at(sMin + MARGIN_M + SHED.w / 2, band.from + SHED.d / 2), angle, Math.floor(random() * 3), push)
      push('#7a5a3e', box(at(sMax - MARGIN_M - 1.0, band.from + 0.5), 0, 2.0, 0.35, 1.0, angle))
      push(BED.soil, box(at(sMax - MARGIN_M - 1.0, band.from + 0.5), 0.3, 1.9, 0.06, 0.9, angle))
      for (let i = 0; i < 6; i++) {
        flowers.push({ position: toScene(at(sMax - MARGIN_M - 1.7 + i * 0.28, band.from + 0.5), 0.45), scale: 0.18, colour: new Color('#5e9a3e'), distance: 0 })
      }
      // Patio in the middle of the band: stone, a round table, four chairs and an umbrella.
      const sPatio = (sMin + sMax) / 2 + 0.6
      const patio = at(sPatio, mid)
      push(PATIO.stone, box(patio, 0, PATIO.w, 0.06, PATIO.d, angle))
      push(PATIO.furniture, new CylinderGeometry(0.45, 0.45, 0.05, 16).toNonIndexed().translate(patio[0], 0.75, -patio[1]))
      push(PATIO.furniture, new CylinderGeometry(0.05, 0.05, 0.72, 6).toNonIndexed().translate(patio[0], 0.39, -patio[1]))
      for (const [ds, dO] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) {
        const c = at(sPatio + ds, mid + dO)
        push(PATIO.furniture, box(c, 0, 0.45, 0.45, 0.45, angle))
        push(PATIO.furniture, box(at(sPatio + ds * 1.25, mid + dO * 1.25), 0.45, 0.45 * (ds ? 0.12 : 1), 0.5, 0.45 * (dO ? 0.12 : 1), angle))
      }
      push('#6b6b6b', new CylinderGeometry(0.025, 0.025, 2.2, 6).toNonIndexed().translate(patio[0], 1.1, -patio[1]))
      const umbrella = PATIO.umbrella[Math.floor(random() * PATIO.umbrella.length)]
      push(umbrella, new ConeGeometry(1.25, 0.5, 8).toNonIndexed().translate(patio[0], 2.15, -patio[1]))
      // Flower bed along the right fence, from the band toward the house.
      const bedFrom = band.from + 1.4
      const bedTo = Math.min(bedFrom + 6, Math.max(bedFrom + 1, oBack - 3.8))
      const bedMid = at(sMax - 0.1 - BED.w / 2, (bedFrom + bedTo) / 2)
      // Narrow across the street's direction, long toward the house: the box's depth runs that way.
      push(BED.soil, box(bedMid, 0, BED.w, 0.12, bedTo - bedFrom, angle))
      for (let o = bedFrom + 0.2; o < bedTo; o += 0.32) {
        for (const ds of [0.18, 0.45]) {
          const colour = new Color(BED.flowers[Math.floor(random() * BED.flowers.length)])
          flowers.push({ position: toScene(at(sMax - 0.1 - ds, o + random() * 0.1), 0.22), scale: 0.13 + random() * 0.05, colour, distance: 0 })
        }
      }
      // Shrubs along the back fence, between the shed and the raised bed.
      for (let s = sMin + MARGIN_M + SHED.w + 0.9; s < sMax - MARGIN_M - 2.2; s += 1.5) {
        const r = SHRUB.radius[0] + random() * (SHRUB.radius[1] - SHRUB.radius[0])
        shrubs.push({ position: toScene(at(s, oRear + 0.5 + r * 0.6), r * 0.8), scale: r, colour: new Color(SHRUB.colours[Math.floor(random() * 4)]), distance: 0 })
      }
    }
  }

  // Neighbours' back gardens: shrubs behind each nearby house, and the odd shed.
  const neighbourSheds: Plan['neighbourSheds'] = []
  const shedsByColour = new Map<string, BufferGeometry[]>()
  for (const b of buildings) {
    if (b.on_lot || b.kind !== 'house') continue
    const ring = openRing(b.footprint_local)
    const centre = vertexMean(ring)
    const distance = Math.hypot(...centre)
    if (distance > NEIGHBOUR.withinM) continue
    const local = ring.map((p) => inFrame(street, p))
    const c = inFrame(street, centre)
    // Behind the house is away from the road's centreline.
    const behind = c.o < ROAD_CENTRE_M ? -1 : 1
    const backFace = behind < 0 ? Math.min(...local.map((p) => p.o)) : Math.max(...local.map((p) => p.o))
    const r = seededRandom(centre)
    const half = (Math.max(...local.map((p) => p.s)) - Math.min(...local.map((p) => p.s))) / 2
    for (const k of [-0.5, 0.45]) {
      const radius = SHRUB.radius[0] + r() * (SHRUB.radius[1] - SHRUB.radius[0])
      const o = backFace + behind * (NEIGHBOUR.behindM[0] + r() * (NEIGHBOUR.behindM[1] - NEIGHBOUR.behindM[0]))
      shrubs.push({ position: toScene(fromFrame(street, c.s + k * half, o), radius * 0.8), scale: radius, colour: new Color(SHRUB.colours[Math.floor(r() * 4)]), distance })
    }
    if (r() < NEIGHBOUR.shedShare) {
      const spot = fromFrame(street, c.s + (r() - 0.5) * half, backFace + behind * (5 + r() * 3))
      const pieces: { colour: string; geometry: BufferGeometry }[] = []
      shed([0, 0], angle, Math.floor(r() * 3), (colour, geometry) => {
        pieces.push({ colour, geometry })
        const placed = geometry.clone().translate(spot[0], 0, -spot[1])
        shedsByColour.set(colour, [...(shedsByColour.get(colour) ?? []), placed])
      })
      neighbourSheds.push({ pieces, distance, x: spot[0], z: -spot[1] })
    }
  }

  return { pieces: mergeByColour(byColour), shrubs, flowers, neighbourSheds, shedsMerged: mergeByColour(shedsByColour) }
}

const scratch = { matrix: new Matrix4(), scale: new Vector3(), still: new Quaternion() }

export function Garden({
  lot,
  design,
  buildings,
  street,
}: {
  lot: LocalPoint[]
  design: DesignResult | null
  buildings: ContextBuilding[]
  street: StreetFrame
}) {
  const garden = useMemo(() => plan(lot, design, buildings, street), [lot, design, buildings, street])
  const resources = useMemo(() => {
    const materials = new Map<string, MeshStandardMaterial>()
    const material = (colour: string) => {
      const hit = materials.get(colour)
      if (hit) return hit
      const made = new MeshStandardMaterial({ color: colour, roughness: 0.85 })
      materials.set(colour, made)
      return made
    }
    return {
      material,
      materials,
      puff: new IcosahedronGeometry(1, 1),
      leaves: new MeshStandardMaterial({ color: 'white', roughness: 0.9, flatShading: true }),
    }
  }, [])
  useEffect(
    () => () => {
      resources.materials.forEach((m) => m.dispose())
      resources.puff.dispose()
      resources.leaves.dispose()
    },
    [resources],
  )
  useEffect(
    () => () => {
      garden.pieces.forEach((p) => p.geometry.dispose())
      garden.neighbourSheds.forEach((s) => s.pieces.forEach((p) => p.geometry.dispose()))
      garden.shedsMerged.forEach((p) => p.geometry.dispose())
    },
    [garden],
  )

  const all = useMemo(() => [...garden.shrubs, ...garden.flowers], [garden])
  const instances = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = instances.current
    if (!mesh) return
    all.forEach((p, i) => mesh.setColorAt(i, p.colour))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [all])

  const ownGarden = useRef<Group>(null)
  const sheds = useRef<(Group | null)[]>([])
  const done = useRef(false)
  // Like Street: once the ripple is over, the sheds switch to one merged mesh per colour.
  const [shedsSettled, setShedsSettled] = useState(false)
  const askedSettle = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    // The new building's garden pops in as the floors land; the neighbours' grows with the ripple.
    const own = ease.outBack(progress(t, { start: timeline.fail.start, end: timeline.fail.start + POP_S }))
    if (ownGarden.current) {
      ownGarden.current.visible = own > 0
      // Grows up out of the ground, each piece where it stands.
      ownGarden.current.scale.set(1, Math.max(own, 0.001), 1)
    }
    if (!askedSettle.current) {
      garden.neighbourSheds.forEach((s, i) => {
        const g = sheds.current[i]
        if (!g) return
        const p = ease.outBack(progress(t, growSpan(timeline, s.distance)))
        g.visible = p > 0
        g.scale.setScalar(Math.max(p, 0.001))
      })
      if (t >= timeline.ripple.end) {
        askedSettle.current = true
        setShedsSettled(true)
      }
    }
    const mesh = instances.current
    const settled = t > timeline.fail.start + POP_S && t > timeline.ripple.end
    if (!mesh || (settled && done.current)) return
    done.current = settled
    all.forEach((p, i) => {
      const grow = p.distance > 0 ? progress(t, growSpan(timeline, p.distance)) : own
      scratch.scale.setScalar(Math.max(p.scale * ease.outBack(grow), 0.0001))
      mesh.setMatrixAt(i, scratch.matrix.compose(p.position, scratch.still, scratch.scale))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <group ref={ownGarden} visible={false}>
        {garden.pieces.map((p) => (
          <mesh key={p.colour} geometry={p.geometry} material={resources.material(p.colour)} castShadow receiveShadow dispose={null} />
        ))}
      </group>
      {shedsSettled
        ? garden.shedsMerged.map((p) => (
            <mesh key={p.colour} geometry={p.geometry} material={resources.material(p.colour)} castShadow receiveShadow dispose={null} />
          ))
        : garden.neighbourSheds.map((s, i) => (
            <group
              key={i}
              ref={(el) => {
                sheds.current[i] = el
              }}
              position={[s.x, 0, s.z]}
              visible={false}
            >
              {s.pieces.map((p, j) => (
                <mesh key={j} geometry={p.geometry} material={resources.material(p.colour)} castShadow receiveShadow dispose={null} />
              ))}
            </group>
          ))}
      {all.length > 0 && (
        <instancedMesh
          ref={instances}
          args={[resources.puff, resources.leaves, all.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      )}
    </group>
  )
}
