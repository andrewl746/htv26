// The one timeline every step of the 3D sequence reads (MASTERSPEC 6.3), in seconds from the moment
// the scene starts fading in over the map. The swoop (step 1) is the map's flight, so t = 0 is the
// camera already at rest; the pin and the ripple start at once, so the map's buildings hand straight
// over to the 3D street growing in their place. The spec's other durations are kept.

export interface Span {
  start: number
  end: number
}

export interface Timeline {
  pin: Span
  ripple: Span
  outline: Span
  setbacks: Span
  buildable: Span
  oldHouse: Span
  /** One per level of the design, basement first. */
  floors: Span[]
  /** One per home of the design. */
  labels: Span[]
  orbitStart: number
  /** Ripple: how long each building takes to grow, and how much later it starts per metre from the lot. */
  growS: number
  delayPerM: number
}

const DURATION = {
  pin: 0.4,
  ripple: 1.5,
  outline: 0.8,
  setbacks: 0.5,
  buildable: 0.4,
  oldHouse: 0.6,
  floor: 0.45,
  label: 0.3,
  grow: 0.45,
}
const STAGGER = { floor: 0.15, label: 0.1 }
const RIPPLE_DELAY_PER_M = 0.008
/** How far a step starts before the previous one ends. */
const OVERLAP = { outline: 0.5 }
/** prefers-reduced-motion: every step lasts 0.1 s, one after another, and nothing orbits (MASTERSPEC 6.7). */
const REDUCED_S = 0.1

export function buildTimeline(levels: number, homes: number, reduced: boolean): Timeline {
  const d = (s: number) => (reduced ? REDUCED_S : s)
  const lap = (s: number) => (reduced ? 0 : s)
  const span = (start: number, duration: number): Span => ({ start, end: start + duration })

  const pin = span(0, d(DURATION.pin))
  const ripple = span(reduced ? pin.end : 0, d(DURATION.ripple))
  const outline = span(ripple.end - lap(OVERLAP.outline), d(DURATION.outline))
  const setbacks = span(outline.end, d(DURATION.setbacks))
  const buildable = span(setbacks.end, d(DURATION.buildable))
  const oldHouse = span(buildable.end, d(DURATION.oldHouse))
  const floors = Array.from({ length: levels }, (_, i) => span(oldHouse.end + lap(STAGGER.floor) * i, d(DURATION.floor)))
  const floorsEnd = floors.at(-1)?.end ?? oldHouse.end
  const labels = Array.from({ length: homes }, (_, i) => span(floorsEnd + lap(STAGGER.label) * i, d(DURATION.label)))

  return {
    pin,
    ripple,
    outline,
    setbacks,
    buildable,
    oldHouse,
    floors,
    labels,
    orbitStart: labels.at(-1)?.end ?? floorsEnd,
    growS: d(DURATION.grow),
    delayPerM: reduced ? 0 : RIPPLE_DELAY_PER_M,
  }
}

/** 0 before the span, 1 after it, linear in between. */
export function progress(t: number, span: Span): number {
  if (span.end <= span.start) return t >= span.start ? 1 : 0
  return Math.min(1, Math.max(0, (t - span.start) / (span.end - span.start)))
}

/** When a building at this distance from the lot starts and stops growing in the ripple. */
export function growSpan(tl: Timeline, distanceM: number): Span {
  const delay = Math.min(distanceM * tl.delayPerM, tl.ripple.end - tl.ripple.start - tl.growS)
  const start = tl.ripple.start + Math.max(0, delay)
  return { start, end: start + tl.growS }
}

export const ease = {
  outCubic: (p: number) => 1 - (1 - p) ** 3,
  inQuad: (p: number) => p * p,
  /** Ends a little past 1 and settles back: the "slight overshoot" of the ripple. */
  outBack: (p: number, overshoot = 1.2) => 1 + (overshoot + 1) * (p - 1) ** 3 + overshoot * (p - 1) ** 2,
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p
}
