import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { SequenceContext, type SequenceState } from './useSequence'
import type { Timeline } from './timeline'

type Restart = 'start' | 'replay'

/**
 * Owns the sequence clock. A new lot plays the whole sequence; a new design on the same lot jumps
 * back to step 4 so the street stays built and steps 4 to 7 replay (MASTERSPEC 6.3).
 *
 * The restart is applied on the next frame drawn, before any other frame callback, because the
 * canvas does not draw while hidden and its clock jumps forward when it starts again.
 */
export function Sequence({
  lotKey,
  designKey,
  timeline,
  reduced,
  children,
}: {
  lotKey: string
  designKey: string
  timeline: Timeline
  reduced: boolean
  children: ReactNode
}) {
  const state = useRef<SequenceState>({ t0: 0, timeline, reduced })
  const last = useRef<{ lotKey: string; designKey: string } | null>(null)
  const restart = useRef<Restart | null>(null)

  useLayoutEffect(() => {
    const s = state.current
    s.timeline = timeline
    s.reduced = reduced
    const previous = last.current
    if (!previous || previous.lotKey !== lotKey) restart.current = 'start'
    else if (previous.designKey !== designKey) restart.current = 'replay'
    last.current = { lotKey, designKey }
  }, [lotKey, designKey, timeline, reduced])

  // Negative priority: before the camera controls (-1) and every component (0).
  useFrame(({ clock }) => {
    const r = restart.current
    if (!r) return
    const s = state.current
    s.t0 = clock.elapsedTime - (r === 'replay' ? s.timeline.oldHouse.start : 0)
    restart.current = null
  }, -2)

  return <SequenceContext.Provider value={state}>{children}</SequenceContext.Provider>
}
