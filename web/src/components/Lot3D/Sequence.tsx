import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { SequenceContext, type SequenceState } from './useSequence'
import type { Timeline } from './timeline'

/**
 * Owns the sequence clock. A new lot plays the whole sequence; a new design on the same lot jumps
 * back to step 4 so the street stays built and steps 4 to 7 replay (MASTERSPEC 6.3).
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
  const clock = useThree((s) => s.clock)
  const state = useRef<SequenceState>({ t0: 0, timeline, reduced })
  const last = useRef<{ lotKey: string; designKey: string } | null>(null)

  useLayoutEffect(() => {
    const s = state.current
    s.timeline = timeline
    s.reduced = reduced
    const previous = last.current
    if (!previous || previous.lotKey !== lotKey) s.t0 = clock.elapsedTime
    else if (previous.designKey !== designKey) s.t0 = clock.elapsedTime - timeline.oldHouse.start
    last.current = { lotKey, designKey }
  }, [lotKey, designKey, timeline, reduced, clock])

  return <SequenceContext.Provider value={state}>{children}</SequenceContext.Provider>
}
