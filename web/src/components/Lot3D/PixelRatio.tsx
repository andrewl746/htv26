import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** Holds the canvas at most `max` pixels per CSS pixel; the Canvas's dpr prop only counts at mount. */
export function PixelRatio({ max }: { max: number }) {
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, max))
  }, [setDpr, max])
  return null
}
