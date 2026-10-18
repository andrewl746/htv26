import { useEffect, useId, useRef, useState } from 'react'
import { drawSkyline } from './skyline'

/**
 * The landing card's backdrop: a drafting sheet in teal lines on the card's translucent beige, after
 * the cutting mat on jaydenchen.dev's Skills page. A quarter-unit grid, a double-ruled frame with ticks
 * on every edge and numerals along the top and bottom, registration marks at the corners, and, faint
 * behind the text, a chalk sketch of downtown Toronto standing on the bottom rule (skyline.ts).
 * Drawn once to the card's measured size; nothing moves, so the map flight behind the card costs
 * nothing extra. Colours come from app.css (`.blueprint-*`).
 */

/** The outer rule's inset from the card's edge (px). */
const OUTER = 8
/** The ruled area's inset; the band between the two rules carries the ticks and numerals. */
const INNER = 28
/** The outer rule's corner radius: the card's 12 px corner, less the inset. */
const OUTER_RX = 4
/** One grid square (px); the fine grid splits it in quarters, like graph paper. */
const UNIT = 32
const MINOR = UNIT / 4
/** Tick lengths into the band: every quarter, and every whole unit. */
const TICK = 3
const TICK_MAJOR = 7
/** The corner registration marks: the circle's radius and the cross's half-length. */
const MARK_R = 5
const MARK_ARM = 10
/** The skyline's chalk: one width for every line, drawn in two passes that a slow noise bends by up
 *  to CHALK_WOBBLE px each, like a hand going over the line twice; then a fine grain rubs specks of
 *  it away (alpha = GAIN × noise − CUT). */
const CHALK_WIDTH = 1.6
const CHALK_BEND = 0.035
const CHALK_WOBBLE = 4
const CHALK_GRAIN = 1.1
const CHALK_GAIN = 3
const CHALK_CUT = 1

const r2 = (n: number) => Math.round(n * 100) / 100

function BlueprintDrawing({ w, h }: { w: number; h: number }) {
  const id = `blueprint-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const x0 = INNER
  const y0 = INNER
  const x1 = w - INNER
  const y1 = h - INNER
  if (x1 - x0 < UNIT || y1 - y0 < UNIT) return null

  // Like a real sheet, everything counts from the ruled area's bottom-left corner.
  const tickLen = (i: number) => (i % 4 === 0 ? TICK_MAJOR : TICK)
  let ticks = ''
  for (let i = 0; x0 + i * MINOR <= x1 + 0.01; i++) {
    const x = r2(x0 + i * MINOR) + 0.5
    ticks += `M${x} ${y0}v${-tickLen(i)}M${x} ${y1}v${tickLen(i)}`
  }
  for (let i = 0; y1 - i * MINOR >= y0 - 0.01; i++) {
    const y = r2(y1 - i * MINOR) + 0.5
    ticks += `M${x0} ${y}h${-tickLen(i)}M${x1} ${y}h${tickLen(i)}`
  }

  let minor = ''
  for (let i = 1; i < 4; i++) minor += `M${i * MINOR + 0.5} 0V${UNIT}M0 ${i * MINOR + 0.5}H${UNIT}`

  // On the inner rule's corners, which sit half a pixel in.
  const corners = [x0 + 0.5, x1 - 0.5].flatMap((x) => [y0 + 0.5, y1 - 0.5].map((y) => [x, y]))
  const marks = corners.map(([x, y]) => `M${x - MARK_ARM} ${y}h${2 * MARK_ARM}M${x} ${y - MARK_ARM}v${2 * MARK_ARM}`).join('')

  // The skyline stands on the bottom rule's line, half a pixel in.
  const skyline = drawSkyline(x0, x1, y1 - 0.5)
  const ruled = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }

  const cols = Math.floor((x1 - x0) / UNIT + 0.01)
  const topRow = (OUTER + y0 - TICK_MAJOR) / 2
  const bottomRow = (y1 + TICK_MAJOR + h - OUTER) / 2

  return (
    <svg width={w} height={h}>
      <defs>
        <pattern id={`${id}-grid`} patternUnits="userSpaceOnUse" x={x0} y={y1} width={UNIT} height={UNIT}>
          <path className="blueprint-minor" d={minor} />
          <path className="blueprint-major" d={`M0.5 0V${UNIT}M0 0.5H${UNIT}`} />
        </pattern>
        {/* Every skyline line in white, in drawing order: each building's black fill hides the lines
            behind it, and nothing else, so the grid still shows through. */}
        <mask id={`${id}-sky`} maskUnits="userSpaceOnUse" {...ruled}>
          <g stroke="white" strokeWidth={CHALK_WIDTH} strokeLinecap="round" strokeLinejoin="round">
            {skyline.parts.map((part, i) => (
              <g key={i}>
                <path d={part.outline} fill="black" />
                {part.detail && <path d={part.detail} fill="none" />}
              </g>
            ))}
            <path d={skyline.dimension} fill="none" />
          </g>
        </mask>
        <filter id={`${id}-chalk`} filterUnits="userSpaceOnUse" {...ruled}>
          {/* Two hand passes over the same lines, each bent its own way. */}
          <feTurbulence type="fractalNoise" baseFrequency={CHALK_BEND} numOctaves={2} seed={3} result="bendA" />
          <feDisplacementMap in="SourceGraphic" in2="bendA" scale={CHALK_WOBBLE} xChannelSelector="R" yChannelSelector="G" result="passA" />
          <feTurbulence type="fractalNoise" baseFrequency={CHALK_BEND} numOctaves={2} seed={11} result="bendB" />
          <feDisplacementMap in="SourceGraphic" in2="bendB" scale={CHALK_WOBBLE} xChannelSelector="R" yChannelSelector="G" result="passB" />
          <feMerge result="sketch">
            <feMergeNode in="passA" />
            <feMergeNode in="passB" />
          </feMerge>
          {/* The grain of chalk on paper. */}
          <feTurbulence type="fractalNoise" baseFrequency={CHALK_GRAIN} numOctaves={2} seed={7} result="grain" />
          <feColorMatrix in="grain" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${CHALK_GAIN} 0 0 0 ${-CHALK_CUT}`} result="dust" />
          <feComposite in="sketch" in2="dust" operator="in" />
        </filter>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#${id}-grid)`} />
      <g className="blueprint-rule" fill="none">
        <rect x={OUTER + 0.5} y={OUTER + 0.5} width={w - 2 * OUTER - 1} height={h - 2 * OUTER - 1} rx={OUTER_RX} />
        <rect x={x0 + 0.5} y={y0 + 0.5} width={x1 - x0 - 1} height={y1 - y0 - 1} />
        <path d={ticks} />
      </g>
      <g filter={`url(#${id}-chalk)`}>
        <rect className="blueprint-chalk" {...ruled} mask={`url(#${id}-sky)`} />
      </g>
      <g className="blueprint-mark" fill="none">
        <path d={marks} />
        {corners.map(([x, y]) => (
          <circle key={`${x} ${y}`} cx={x} cy={y} r={MARK_R} />
        ))}
      </g>
      <g className="blueprint-numeral" textAnchor="middle" dominantBaseline="central">
        {Array.from({ length: cols + 1 }, (_, k) => (
          <g key={k}>
            <text x={x0 + k * UNIT} y={topRow}>
              {k}
            </text>
            <text x={x0 + k * UNIT} y={bottomRow}>
              {k}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}

/** The sheet, filling the card it sits in and redrawn whenever the card changes size. */
export function Blueprint() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="blueprint" aria-hidden="true">
      {size && <BlueprintDrawing w={size.w} h={size.h} />}
    </div>
  )
}
