import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * A pencil-crayon underline under each figure in the ward panel's statistics, a little askew, sketched
 * in once the counters have landed. Yuvi's WardPanel.tsx sets its numbers as plain text, so this finds
 * them in the text (never changing it), measures them, and draws the marks into an SVG laid over the
 * panel's content, which scrolls with it. Years ("since May 2023") are left alone. The crayon's colour
 * is in wardStage.css (.ward-marks).
 */

/** The sentences that carry the statistics: the headline, "Near your lot" and the unheaded section. */
const TARGETS = '.ward-headline p[aria-hidden="true"], .ward-near p, :scope > section:not([class]) p'
/** A figure: digits with their group and decimal marks (English or French), and a percent sign. */
const FIGURE = /\d(?:[\d.,  ]*\d)?(?:[  ]?%)?/g
const YEAR = /^(19|20)\d\d$/
/** Measured again this long after the panel's text last changed, so the counters have stopped (ms). */
const SETTLE_MS = 150
/** Each line runs this far past both ends of its figure (px), sits this far down the text's box, rises
 *  this much per px of its length, and is this share of the text's height wide (at least MIN_WIDTH). */
const OVERSHOOT = 3
const DROP = 0.9
const TILT = 0.05
const WIDTH = 0.11
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

/** The two passes under a figure whose box runs from `left` to `right`, `top` down `height`. */
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

/** Every figure in the panel's statistics, in the panel's content coordinates, and the box round them. */
function measure(panel: HTMLElement): { marks: Mark[]; region: Box | null } {
  const box = panel.getBoundingClientRect()
  const left = box.left + panel.clientLeft - panel.scrollLeft
  const top = box.top + panel.clientTop - panel.scrollTop
  const marks: Mark[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of Array.from(panel.querySelectorAll<HTMLElement>(TARGETS))) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? ''
      FIGURE.lastIndex = 0
      for (let m = FIGURE.exec(text); m; m = FIGURE.exec(text)) {
        if (YEAR.test(m[0])) continue
        const range = document.createRange()
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        for (const r of Array.from(range.getClientRects())) {
          marks.push(stroke(r.left - left, r.right - left, r.top - top, r.height))
          minX = Math.min(minX, r.left - left)
          minY = Math.min(minY, r.top - top)
          maxX = Math.max(maxX, r.right - left)
          maxY = Math.max(maxY, r.bottom - top)
        }
      }
    }
  }
  if (marks.length === 0) return { marks, region: null }
  const room = OVERSHOOT + ROOM
  return { marks, region: { x: minX - room, y: minY - room, width: maxX - minX + 2 * room, height: maxY - minY + 2 * room } }
}

/** The marks for the ward panel inside `mapRef`'s map; mounted with the panel. */
export function NumberMarks({ mapRef }: { mapRef: RefObject<HTMLDivElement | null> }) {
  const id = `ward-marks-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [drawn, setDrawn] = useState<{ marks: Mark[]; region: Box | null }>({ marks: [], region: null })

  useLayoutEffect(() => {
    setPanel(mapRef.current?.querySelector<HTMLElement>('.ward-panel') ?? null)
  }, [mapRef])

  useEffect(() => {
    if (!panel) return
    let live = true
    let timer = 0
    const settle = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => live && setDrawn(measure(panel)), SETTLE_MS)
    }
    // The counters, a language change or a reflow; the marks' own changes don't count.
    const text = new MutationObserver((records) => {
      if (records.some((r) => !svg.current?.contains(r.target))) settle()
    })
    text.observe(panel, { subtree: true, childList: true, characterData: true })
    const size = new ResizeObserver(settle)
    size.observe(panel)
    document.fonts.ready.then(settle)
    settle()
    return () => {
      live = false
      clearTimeout(timer)
      text.disconnect()
      size.disconnect()
    }
  }, [panel])

  if (!panel) return null
  const { marks, region } = drawn
  return createPortal(
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
    </svg>,
    panel,
  )
}
