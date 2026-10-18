import { useRef, useState } from 'react'
import { PerformanceMonitor } from '@react-three/drei'
import { useSequenceFrame } from './useSequence'

/**
 * A15: watches the frame rate once the street has grown (not during the map's flight, when the
 * map draws too) and calls onDecline when it stays under minFps, so the drawn look can drop its
 * ambient occlusion and shadows. drei samples 10 windows of 250 ms; three in four must be slow.
 */
export function QualityMonitor({ minFps, onDecline }: { minFps: number; onDecline: () => void }) {
  const [armed, setArmed] = useState(false)
  const asked = useRef(false)
  useSequenceFrame((t, { timeline }) => {
    if (!asked.current && t >= timeline.ripple.end) {
      asked.current = true
      setArmed(true)
    }
  })
  return armed ? <PerformanceMonitor bounds={() => [minFps, Infinity]} onDecline={onDecline} /> : null
}
