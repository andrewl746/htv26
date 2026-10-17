import { useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import type { Design, DesignHome, LocalPoint } from '@contracts/types'
import { fill, pending } from '../../copy'
import { toScene, type Vec3 } from './geometry'
import { planFloors, pointOn, type FloorPlan } from './floors'
import { ease, progress } from './timeline'
import { useSequenceFrame } from './useSequence'

// Step 6 (MASTERSPEC 6.3): a floating label per home, "Basement home · 2 bedrooms", from
// designs.json. Homes in the left half of the building label out to the left and the others to
// the right, so two homes on one floor never cover each other.
const LABEL_OUT_M = 0.4
const LABEL_RISE_PX = 8

interface Anchor {
  home: DesignHome
  position: Vec3
  side: 'left' | 'right'
}

function anchors(plan: FloorPlan, design: Design): Anchor[] {
  return design.homes.map((home) => {
    const levels = plan.levels.filter((l) => l.slabs.some((s) => s.home?.id === home.id))
    const lowest = levels[0] ?? plan.levels[0]
    const slab = lowest.slabs.find((s) => s.home?.id === home.id) ?? lowest.slabs[0]
    const side = lowest.slabs.length > 1 && slab.to <= 0.5 ? 'left' : 'right'
    const bottom = Math.max(0, Math.min(...levels.map((l) => l.bottom)))
    const top = Math.max(...levels.map((l) => l.bottom + l.height))
    const point: LocalPoint = pointOn(plan.frame, side === 'left' ? 0 : 1, lowest.stepback - LABEL_OUT_M)
    return { home, position: toScene(point, (bottom + top) / 2), side }
  })
}

function labelText(home: DesignHome): string {
  const bedrooms = fill(home.bedrooms === 1 ? pending.home_bedrooms_one : pending.home_bedrooms, {
    bedrooms: home.bedrooms,
  })
  return `${home.label} · ${bedrooms}`
}

export function HomeLabels({ placement, spec }: { placement: LocalPoint[]; spec: Design }) {
  const list = useMemo(() => anchors(planFloors(placement, spec), spec), [placement, spec])
  const labels = useRef<(HTMLDivElement | null)[]>([])

  useSequenceFrame((t, { timeline }) => {
    list.forEach((_, i) => {
      const el = labels.current[i]
      const span = timeline.labels[i]
      if (!el || !span) return
      const p = ease.outCubic(progress(t, span))
      el.style.opacity = String(p)
      el.style.translate = `0 ${(1 - p) * LABEL_RISE_PX}px`
    })
  })

  return (
    <group>
      {list.map((a, i) => (
        <Html key={a.home.id} position={a.position} zIndexRange={[20, 0]} pointerEvents="none">
          <div
            ref={(el) => {
              labels.current[i] = el
            }}
            className={`scene-label home-label home-label-${a.side}`}
            style={{ opacity: 0 }}
          >
            <span className="home-swatch" style={{ background: `var(--suplex-home-${a.home.id})` }} />
            {labelText(a.home)}
          </div>
        </Html>
      ))}
    </group>
  )
}
