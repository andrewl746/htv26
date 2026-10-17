import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
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
 * The visible part of the plan. It eases to `target` whenever that changes: the centre moves in a
 * straight line and the width and height change geometrically, so a 30 m view and a 1 km view feel
 * like equal steps. With reduced motion it jumps. `set` moves it directly (wheel, drag, buttons)
 * and stops any ease in progress.
 */
export function useViewBox(target: ViewBox): [ViewBox, (box: ViewBox) => void] {
  const reduced = useReducedMotion()
  const [box, setBox] = useState(target)
  const [seen, setSeen] = useState(target)
  const latest = useRef(target)
  const frame = useRef(0)

  useEffect(() => {
    latest.current = box
  }, [box])

  // Reduced motion: take the new target during the render that sees it, with no ease.
  if (seen !== target) {
    setSeen(target)
    if (reduced) setBox(target)
  }

  useEffect(() => {
    if (reduced) return
    const from = latest.current
    if (same(from, target)) return
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS)
      const e = 1 - (1 - t) ** 3
      const w = from.w * (target.w / from.w) ** e
      const h = from.h * (target.h / from.h) ** e
      const cx = from.x + from.w / 2 + (target.x + target.w / 2 - from.x - from.w / 2) * e
      const cy = from.y + from.h / 2 + (target.y + target.h / 2 - from.y - from.h / 2) * e
      const next = { x: cx - w / 2, y: cy - h / 2, w, h }
      latest.current = next
      setBox(next)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, reduced])

  const set = useCallback((next: ViewBox) => {
    cancelAnimationFrame(frame.current)
    latest.current = next
    setBox(next)
  }, [])

  return [box, set]
}
