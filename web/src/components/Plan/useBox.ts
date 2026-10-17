import { useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { ViewBox } from './geometry'

const ZOOM_MS = 450

/** The rendered size of an element, in CSS pixels. */
export function useSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

const same = (a: ViewBox, b: ViewBox) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/**
 * Eases the view to `target`: the centre moves in a straight line and the width and height change
 * geometrically, so a 30 m view and a 1 km view feel like equal steps. With reduced motion it jumps.
 */
export function useTweenedBox(target: ViewBox): ViewBox {
  const reduced = useReducedMotion()
  const [box, setBox] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    if (same(from, target)) return
    if (reduced) {
      current.current = target
      return
    }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS)
      const e = 1 - (1 - t) ** 3
      const w = from.w * (target.w / from.w) ** e
      const h = from.h * (target.h / from.h) ** e
      const cx = from.x + from.w / 2 + (target.x + target.w / 2 - from.x - from.w / 2) * e
      const cy = from.y + from.h / 2 + (target.y + target.h / 2 - from.y - from.h / 2) * e
      const next = { x: cx - w / 2, y: cy - h / 2, w, h }
      current.current = next
      setBox(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])

  return reduced ? target : box
}
