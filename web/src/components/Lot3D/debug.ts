import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { CheckResponse, ContextBuilding, LocalPoint } from '@contracts/types'

// Dev-only views for checking the drawn designs against the City's sheets and for measuring the
// frame rate. Never in a build.

const params = new URLSearchParams(window.location.search)

/** `?elevation`: the camera stands square to the design's front, as the A200 front elevation does. */
export const ELEVATION_VIEW = import.meta.env.DEV && params.has('elevation')

/** `?stress=400`: fill the street with that many synthetic houses (and 300 trees) for the frame-rate check (A15). */
export const STRESS_BUILDINGS = import.meta.env.DEV ? Number(params.get('stress') ?? 0) : 0

const GRID = { across: 9, along: 16, width: 6.5, depth: 11, keepClearM: 16, treeEvery: 12 }

/** The check with its context replaced by a dense grid of houses round the lot (the lot's own house kept). */
export function stressed(check: CheckResponse, buildings: number): CheckResponse {
  const radius = check.context.radius_m
  const cells: LocalPoint[] = []
  for (let x = -radius; x <= radius; x += GRID.across) {
    for (let y = -radius; y <= radius; y += GRID.along) {
      const d = Math.hypot(x, y)
      if (d < radius && d > GRID.keepClearM) cells.push([x, y])
    }
  }
  cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
  const fake: ContextBuilding[] = cells.slice(0, buildings).map(([x, y], i) => {
    const large = i % 11 === 0
    const [w, d] = large ? [GRID.width * 1.3, GRID.depth * 1.3] : [GRID.width, GRID.depth]
    return {
      building_id: 900000 + i,
      avg_height_m: large ? 17 : 7 + (i % 4) * 0.7,
      kind: large ? 'large' : 'house',
      on_lot: false,
      footprint_local: [
        [x - w / 2, y - d / 2],
        [x + w / 2, y - d / 2],
        [x + w / 2, y + d / 2],
        [x - w / 2, y + d / 2],
        [x - w / 2, y - d / 2],
      ],
    }
  })
  const trees: LocalPoint[] = []
  for (let x = -radius; x <= radius && trees.length < 300; x += GRID.treeEvery) {
    for (let y = -radius; y <= radius && trees.length < 300; y += GRID.treeEvery) {
      if (Math.hypot(x, y) < radius && Math.hypot(x, y) > GRID.keepClearM) trees.push([x + 4.5, y + 8])
    }
  }
  return {
    ...check,
    context: { ...check.context, buildings: [...check.context.buildings.filter((b) => b.on_lot), ...fake], trees },
  }
}

/** `?off=ao,contact,env`: switch parts of the drawn look off, to find what costs frame time. */
export const OFF = new Set(import.meta.env.DEV ? (params.get('off') ?? '').split(',') : [])

declare global {
  interface Window {
    /** Dev only: poke the 3D scene from the console or a test driver. */
    __suplex3d?: { stepDown: () => void; programs: () => number }
  }
}

/** Dev only: `window.__suplex3d` steps the quality down and counts compiled shader programs. */
export function DebugBridge({ stepDown }: { stepDown: () => void }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    window.__suplex3d = { stepDown, programs: () => gl.info.programs?.length ?? 0 }
    return () => {
      delete window.__suplex3d
    }
  }, [gl, stepDown])
  return null
}
