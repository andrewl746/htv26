import { createContext, useContext, type RefObject } from 'react'
import { useFrame, type RootState } from '@react-three/fiber'
import type { Timeline } from './timeline'

export interface SequenceState {
  /** Clock time at which the timeline's t = 0 falls. */
  t0: number
  timeline: Timeline
  reduced: boolean
}

export const SequenceContext = createContext<RefObject<SequenceState> | null>(null)

export function useSequence(): RefObject<SequenceState> {
  const sequence = useContext(SequenceContext)
  if (!sequence) throw new Error('3D components must sit inside <Sequence>')
  return sequence
}

/**
 * Runs every frame with the time on the sequence's timeline. Updates go straight to three.js
 * objects. A negative priority runs earlier in the frame (never positive: that takes over rendering).
 */
export function useSequenceFrame(
  callback: (t: number, sequence: SequenceState, frame: RootState, delta: number) => void,
  priority = 0,
): void {
  const sequence = useSequence()
  useFrame((frame, delta) => {
    const s = sequence.current
    callback(frame.clock.elapsedTime - s.t0, s, frame, delta)
  }, priority)
}
