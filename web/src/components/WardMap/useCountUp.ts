import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** The headline counters count up over 1.5 s with an ease-out (MASTERSPEC 6.5). */
const COUNT_MS = 1500
const REDUCED_COUNT_MS = 100

export function useCountUp(target: number): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    const duration = reduced ? REDUCED_COUNT_MS : COUNT_MS
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])

  return value
}
