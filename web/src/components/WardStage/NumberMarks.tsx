import { useEffect, useId, useRef, useState } from 'react'

/**
 * A pencil-crayon underline under each headline number in the ward panel (WardBrief.tsx, every
 * `.ward-figure`), a little askew, sketched in once the counters have landed. It measures the numbers
 * where they are set and draws the marks into an SVG laid over the panel's scrolling content, so they
 * scroll with it. Mount it inside that content; the crayon's colour is in wardStage.css (.ward-marks).
 */

/** Measured again this long after the panel's text last changed, so the counters have stopped (ms). */
const SETTLE_MS = 150
/** Each line runs this far past both ends of its number (px), sits this far down the number's box,
 *  rises this much per px of its length, and is this share of the box's height wide (at least MIN_WIDTH). */
const OVERSHOOT = 3
const DROP = 0.9
const TILT = 0.05
const WIDTH = 0.08
const MIN_WIDTH = 2
/** The crayon goes over each line twice: the second pass starts this far in and runs this far below. */
const PASS_INSET = 4
const PASS_DROP = 1.2
/** Each line starts drawing this long after the one before it, and its second pass this long after it (ms). */
const STAGGER_MS = 90
const PASS_DELAY_MS = 160
/** The crayon's tooth: a slow bend of up to WOBBLE px, then a fine grain that rubs specks away
 *  (alpha = GAIN × noise − CUT), softer than the landing's chalk. */
const BEND = 0.04
const WOBBLE = 1.5
const GRAIN = 0.9
const GAIN = 2.4
const CUT = 0.5
/** Room round the marks for the filter, so the wobble and the line caps are not cut off (px). */
const ROOM = 8

type Mark = { first: string; second: string; width: number }
type Box = { x: number; y: number; width: number; height: number }

const r1 = (n: number) => Math.round(n * 10) / 10

/** The two passes under a number whose box runs from `left` to `right`, `top` down `height`. */
function stroke(left: number, right: number, top: number, height: number): Mark {
  const x0 = left - OVERSHOOT
  const x1 = right + OVERSHOOT
  const y = top + height * DROP
  const rise = (x1 - x0) * TILT
  const mid = (x0 + x1) / 2
  // Rising to the right, with a hand's slight sag in the middle.
  const line = (a: number, b: number, dy: number) =>
    `M${r1(a)} ${r1(y + rise / 2 + dy)}Q${r1(mid)} ${r1(y + dy + 1)} ${r1(b)} ${r1(y - rise / 2 + dy)}`
  return {
    first: line(x0, x1, 0),
    second: line(x0 + PASS_INSET, x1 - PASS_INSET / 2, PASS_DROP),
    width: Math.max(MIN_WIDTH, r1(height * WIDTH)),
  }
}

/** Every number in `content`, in its scrolled coordinates, and the box round them. */
function measure(content: HTMLElement): { marks: Mark[]; region: Box | null } {
  const box = content.getBoundingClientRect()
  const left = box.left + content.clientLeft - content.scrollLeft
  const top = box.top + content.clientTop - content.scrollTop
  const marks: Mark[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const figure of Array.from(content.querySelectorAll<HTMLElement>('.ward-figure'))) {
    for (const r of Array.from(figure.getClientRects())) {
      marks.push(stroke(r.left - left, r.right - left, r.top - top, r.height))
      minX = Math.min(minX, r.left - left)
      minY = Math.min(minY, r.top - top)
      maxX = Math.max(maxX, r.right - left)
      maxY = Math.max(maxY, r.bottom - top)
    }
  }
  if (marks.length === 0) return { marks, region: null }
  const room = OVERSHOOT + ROOM
  return { marks, region: { x: minX - room, y: minY - room, width: maxX - minX + 2 * room, height: maxY - minY + 2 * room } }
}

export function NumberMarks() {
  const id = `ward-marks-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const [drawn, setDrawn] = useState<{ marks: Mark[]; region: Box | null }>({ marks: [], region: null })

  useEffect(() => {
    const content = svg.current?.parentElement
    if (!content) return
    let live = true
    let timer = 0
    const settle = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => live && setDrawn(measure(content)), SETTLE_MS)
    }
    // The counters, a section opening or a reflow; the marks' own changes don't count.
    const text = new MutationObserver((records) => {
      if (records.some((r) => !svg.current?.contains(r.target))) settle()
    })
    text.observe(content, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['open'] })
    const size = new ResizeObserver(settle)
    size.observe(content)
    document.fonts.ready.then(settle)
    settle()
    return () => {
      live = false
      clearTimeout(timer)
      text.disconnect()
      size.disconnect()
    }
  }, [])

  const { marks, region } = drawn
  return (
    <svg ref={svg} className="ward-marks" aria-hidden="true">
      {region && (
        <>
          <defs>
            <filter id={id} filterUnits="userSpaceOnUse" {...region}>
              <feTurbulence type="fractalNoise" baseFrequency={BEND} numOctaves={2} seed={4} result="bend" />
              <feDisplacementMap in="SourceGraphic" in2="bend" scale={WOBBLE} xChannelSelector="R" yChannelSelector="G" result="line" />
              <feTurbulence type="fractalNoise" baseFrequency={GRAIN} numOctaves={2} seed={9} result="grain" />
              <feColorMatrix in="grain" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${GAIN} 0 0 0 ${-CUT}`} result="tooth" />
              <feComposite in="line" in2="tooth" operator="in" />
            </filter>
          </defs>
          <g filter={`url(#${id})`}>
            {marks.map((m, i) => (
              <g key={i} strokeWidth={m.width}>
                <path d={m.first} pathLength={1} style={{ animationDelay: `${i * STAGGER_MS}ms` }} />
                <path d={m.second} pathLength={1} style={{ animationDelay: `${i * STAGGER_MS + PASS_DELAY_MS}ms` }} />
              </g>
            ))}
          </g>
        </>
      )}
    </svg>
  )
}
