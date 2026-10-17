import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useSequenceFrame } from './useSequence'

/** How long after the last label the street counts as still: the floors' last bounce is over. */
const SETTLE_AFTER_S = 0.5

/**
 * Reports whether the sequence has come to rest (only the camera and the tree crowns move then),
 * and again when a new design replays it. The drawn look uses it to stop redrawing what no longer
 * changes: the contact shadows and the sun's shadow map.
 */
export function SettleWatch({ onChange }: { onChange: (settled: boolean) => void }) {
  const last = useRef<boolean | null>(null)
  useSequenceFrame((t, { timeline }) => {
    const settled = t >= timeline.orbitStart + SETTLE_AFTER_S
    if (settled !== last.current) {
      last.current = settled
      onChange(settled)
    }
  })
  return null
}

/** While frozen the sun's shadow map is drawn once and kept: the light and the street hold still. */
export function ShadowFreeze({ frozen }: { frozen: boolean }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { shadowMap } = get().gl
    shadowMap.autoUpdate = !frozen
    shadowMap.needsUpdate = true
  }, [get, frozen])
  return null
}
