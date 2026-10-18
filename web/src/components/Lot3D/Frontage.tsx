import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, MeshStandardMaterial, PlaneGeometry, type BufferGeometry, type Group } from 'three'
import type { ContextBuilding, LocalPoint } from '@contracts/types'
import { openRing } from './geometry'
import { asphaltTexture, sidewalkTexture } from './textures'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// A15: the street in front of the lot, along its frontage: sidewalk, grass boulevard, curb and road,
// and the same again on the far side. A typical Toronto local street; the lot line is where the
// sidewalk begins. It runs straight each way until its centreline would meet a building (where the
// real street ends or bends) or reaches MAX_REACH_M, and unrolls outward from the lot with the
// ripple. Flat layers sit between the ground (0) and the lot's own layers, under the contact shadows.
const MAX_REACH_M = 120
const MIN_REACH_M = 12
const REACH_STEP_M = 2
const STREET = {
  sidewalkM: 1.8,
  boulevardM: 1.6,
  curbM: 0.15,
  curbHeightM: 0.12,
  roadM: 8.5,
  /** The sidewalk starts just outside the lot line. */
  gapM: 0.3,
}
const Y = { road: 0.006, boulevard: 0.008, sidewalk: 0.012 }
const COLOUR = {
  asphalt: '#45484c',
  sidewalk: '#cdc9c1',
  joint: '#a9a49b',
  curb: '#d9d5cd',
  boulevard: '#8e9877',
}
const ASPHALT_TILE_M = 4
const SIDEWALK_SLAB_M = 1.5

type Layer = { from: number; width: number; kind: 'sidewalk' | 'boulevard' | 'road' | 'curb' }

/** Offsets outward from the lot line, near side then far side. */
function layers(): Layer[] {
  const out: Layer[] = []
  let at = STREET.gapM
  const push = (kind: Layer['kind'], width: number) => {
    out.push({ from: at, width, kind })
    at += width
  }
  push('sidewalk', STREET.sidewalkM)
  push('boulevard', STREET.boulevardM)
  push('curb', STREET.curbM)
  push('road', STREET.roadM)
  push('curb', STREET.curbM)
  push('boulevard', STREET.boulevardM)
  push('sidewalk', STREET.sidewalkM)
  return out
}

/** Ray-casting point-in-polygon test. */
function inside([x, y]: LocalPoint, ring: LocalPoint[]): boolean {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** How far the road's centreline runs from the frontage's middle in direction d before meeting a building. */
function reach(mid: LocalPoint, d: LocalPoint, n: LocalPoint, rings: LocalPoint[][]): number {
  const out = STREET.gapM + STREET.sidewalkM + STREET.boulevardM + STREET.curbM + STREET.roadM / 2
  const centre: LocalPoint = [mid[0] + n[0] * out, mid[1] + n[1] * out]
  for (let t = REACH_STEP_M; t <= MAX_REACH_M; t += REACH_STEP_M) {
    const point: LocalPoint = [centre[0] + d[0] * t, centre[1] + d[1] * t]
    if (rings.some((ring) => inside(point, ring))) return Math.max(MIN_REACH_M, t - REACH_STEP_M)
  }
  return MAX_REACH_M
}

/** A flat strip along x from x0 to x1, centred on z, with UVs in metres. */
function strip(x0: number, x1: number, width: number, z: number, y: number): BufferGeometry {
  const length = x1 - x0
  const g = new PlaneGeometry(length, width).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, z)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * length, uv.getY(i) * width)
  return g
}

export function Frontage({ edge, buildings }: { edge: [LocalPoint, LocalPoint]; buildings: ContextBuilding[] }) {
  // Along the frontage, turned so its right-hand normal points away from the lot: the group's +z.
  const frame = useMemo(() => {
    const [p, q] = edge
    const mid: LocalPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    let d: LocalPoint = [q[0] - p[0], q[1] - p[1]]
    const len = Math.hypot(...d) || 1
    d = [d[0] / len, d[1] / len]
    // The lot's centroid is the origin, so the outward normal points away from it.
    if (d[1] * mid[0] - d[0] * mid[1] < 0) d = [-d[0], -d[1]]
    const n: LocalPoint = [d[1], -d[0]]
    const rings = buildings.filter((b) => !b.on_lot).map((b) => openRing(b.footprint_local))
    const back: LocalPoint = [-d[0], -d[1]]
    return { mid, angle: Math.atan2(d[1], d[0]), x0: -reach(mid, back, n, rings), x1: reach(mid, d, n, rings) }
  }, [edge, buildings])

  const resources = useMemo(() => {
    const asphalt = asphaltTexture(COLOUR.asphalt, ASPHALT_TILE_M)
    const walk = sidewalkTexture(COLOUR.sidewalk, COLOUR.joint, SIDEWALK_SLAB_M)
    const materials = {
      road: new MeshStandardMaterial({ map: asphalt.map, bumpMap: asphalt.bump, bumpScale: 0.4, roughness: 0.95 }),
      sidewalk: new MeshStandardMaterial({ map: walk.map, bumpMap: walk.bump, bumpScale: 0.6, roughness: 0.9 }),
      boulevard: new MeshStandardMaterial({ color: COLOUR.boulevard, roughness: 1 }),
      curb: new MeshStandardMaterial({ color: COLOUR.curb, roughness: 0.85 }),
    }
    const geometries = layers().map((l) => {
      const z = l.from + l.width / 2
      const geometry =
        l.kind === 'curb'
          ? new BoxGeometry(frame.x1 - frame.x0, STREET.curbHeightM, l.width).translate(
              (frame.x0 + frame.x1) / 2,
              STREET.curbHeightM / 2,
              z,
            )
          : strip(frame.x0, frame.x1, l.width, z, Y[l.kind])
      return { kind: l.kind, geometry }
    })
    return { materials, geometries, textures: [asphalt.map, asphalt.bump, walk.map, walk.bump] }
  }, [frame])
  useEffect(
    () => () => {
      resources.geometries.forEach((g) => g.geometry.dispose())
      Object.values(resources.materials).forEach((m) => m.dispose())
      resources.textures.forEach((t) => t.dispose())
    },
    [resources],
  )

  const group = useRef<Group>(null)
  useSequenceFrame((t, { timeline }) => {
    const g = group.current
    if (!g) return
    const p = ease.outCubic(progress(t, timeline.ripple))
    g.visible = p > 0
    g.scale.x = Math.max(p, 0.001)
  })

  return (
    <group ref={group} position={[frame.mid[0], 0, -frame.mid[1]]} rotation={[0, frame.angle, 0]} visible={false}>
      {resources.geometries.map((g, i) => (
        <mesh key={i} geometry={g.geometry} material={resources.materials[g.kind]} receiveShadow castShadow={g.kind === 'curb'} dispose={null} />
      ))}
    </group>
  )
}
