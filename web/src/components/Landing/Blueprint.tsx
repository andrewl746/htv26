import { useEffect, useId, useRef, useState } from 'react'
import { drawFourplex } from './fourplexSketch'
import { LOGO_MARK } from './logoMark'
import { drawSkyline } from './skyline'

/**
 * The landing card's backdrop, and the result panel's: a drafting sheet in teal lines on beige, after
 * the cutting mat on jaydenchen.dev's Skills page. A quarter-unit grid, a double-ruled frame with ticks
 * on every edge and numerals along the top and bottom, registration marks at the corners, the Suplex
 * mark and a Fourplex Wide (fourplexSketch.ts) chalked askew into the bottom-left and bottom-right
 * corners (off for now, see SHOW_CORNERS), and, faint behind the text, a chalk sketch of downtown
 * Toronto standing on the bottom rule (skyline.ts; off for now, see SHOW_SKYLINE).
 * Drawn once to the card's measured size; nothing moves, so the map flight behind the card costs
 * nothing extra. Colours come from app.css (`.blueprint-*`).
 */

/** The outer rule's inset from the card's edge (px). */
const OUTER = 8
/** The ruled area's inset; the band between the two rules carries the ticks and numerals. */
const INNER = 28
/** The outer rule's corner radius: the card's 12 px corner, less the inset. */
const OUTER_RX = 4
/** The card's own corner radius, for a sheet whose outer rule is the card's edge. */
const CARD_RX = OUTER_RX + OUTER
/** One grid square (px); the fine grid splits it in quarters, like graph paper. */
const UNIT = 32
const MINOR = UNIT / 4
/** Tick lengths into the band: every quarter, and every whole unit. */
const TICK = 3
const TICK_MAJOR = 7
/** The corner registration marks: the circle's radius and the cross's half-length. */
const MARK_R = 5
const MARK_ARM = 10
/** The chalk: one width for every line, drawn in two passes that a slow noise bends (by up to
 *  CHALK_WOBBLE px each on the skyline), like a hand going over the line twice; then a fine grain
 *  rubs specks of it away (alpha = GAIN × noise − CUT). */
const CHALK_WIDTH = 1.6
const CHALK_BEND = 0.035
const CHALK_WOBBLE = 4
const CHALK_GRAIN = 1.1
const CHALK_GAIN = 3
const CHALK_CUT = 1
/** The chalk sketch of downtown Toronto, set aside for now: true puts it back. */
const SHOW_SKYLINE = false
/** The chalked mark and fourplex in the bottom corners, set aside for now: true puts them back. */
const SHOW_CORNERS = false
/** The chalked Suplex mark in the bottom-left corner: its height and its offset right and up from
 *  the ruled area's corner (px), its tilt (degrees; negative turns it counterclockwise), the room
 *  left round it for the tilt and the wobble, and a gentler wobble than the skyline's, since its
 *  lines run only a few px apart. Low enough to clear the search box. */
const LOGO_HEIGHT = 84
const LOGO_LEFT = 26
const LOGO_BOTTOM = 22
const LOGO_TILT = -8
const LOGO_ROOM = 10
const LOGO_WOBBLE = 1.2
/** The chalked Fourplex Wide in the bottom-right corner, matching the mark opposite: its height, its
 *  offset left and up from the ruled area's corner (px), and its tilt, the other way from the mark's;
 *  the room and the wobble are the mark's. */
const FOURPLEX_HEIGHT = 84
const FOURPLEX_RIGHT = 26
const FOURPLEX_BOTTOM = 22
const FOURPLEX_TILT = 5
/** Both corner drawings are left out on a sheet narrower than this (px), where the centred examples
 *  and disclaimer reach the corners. */
const CORNER_MIN_SHEET = 620
/** A filter with no region of its own reaches this far round the element it filters, for the wobble. */
const AROUND = { x: '-5%', y: '-15%', width: '110%', height: '130%' }

type Box = { x: number; y: number; width: number; height: number }

const r2 = (n: number) => Math.round(n * 100) / 100

/** The chalk skyline over the ruled area: every line goes into a mask in drawing order, so each
 *  building hides the lines behind it and nothing else; the mask cuts the chalk colour, and the
 *  filter roughens it. */
function ChalkSkyline({ id, x0, y0, x1, y1 }: { id: string; x0: number; y0: number; x1: number; y1: number }) {
  // The skyline stands on the bottom rule's line, half a pixel in.
  const skyline = drawSkyline(x0, x1, y1 - 0.5)
  const ruled = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  return (
    <>
      <defs>
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
        <ChalkFilter id={`${id}-chalk`} region={ruled} wobble={CHALK_WOBBLE} />
      </defs>
      <g filter={`url(#${id}-chalk)`}>
        <rect className="blueprint-chalk" {...ruled} mask={`url(#${id}-sky)`} />
      </g>
    </>
  )
}

/** Open strokes chalked within `region`: they go into a mask, placed by `transform` with the line
 *  width kept at the chalk's, and the mask cuts the chalk colour the way the skyline's does. */
function ChalkLines({ id, region, transform, paths, wobble }: { id: string; region: Box; transform: string; paths: string[]; wobble: number }) {
  return (
    <>
      <defs>
        <mask id={`${id}-lines`} maskUnits="userSpaceOnUse" {...region}>
          <g transform={transform} fill="none" stroke="white" strokeWidth={CHALK_WIDTH} strokeLinecap="round" strokeLinejoin="round">
            {paths.map((d) => (
              <path key={d} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </mask>
        <ChalkFilter id={`${id}-chalk`} region={region} wobble={wobble} />
      </defs>
      <g filter={`url(#${id}-chalk)`}>
        <rect className="blueprint-chalk" {...region} mask={`url(#${id}-lines)`} />
      </g>
    </>
  )
}

/** The Suplex mark chalked into the sheet's bottom-left corner, a little askew, tilted and scaled to size. */
function ChalkLogo({ id, x0, y1 }: { id: string; x0: number; y1: number }) {
  const scale = LOGO_HEIGHT / LOGO_MARK.height
  const width = LOGO_MARK.width * scale
  const left = x0 + LOGO_LEFT
  const top = y1 - LOGO_BOTTOM - LOGO_HEIGHT
  const region = { x: left - LOGO_ROOM, y: top - LOGO_ROOM, width: width + 2 * LOGO_ROOM, height: LOGO_HEIGHT + 2 * LOGO_ROOM }
  const placed = `rotate(${LOGO_TILT} ${left + width / 2} ${top + LOGO_HEIGHT / 2}) translate(${left} ${top}) scale(${scale})`
  return <ChalkLines id={`${id}-logo`} region={region} transform={placed} paths={LOGO_MARK.paths} wobble={LOGO_WOBBLE} />
}

/** The Fourplex Wide chalked into the sheet's bottom-right corner, askew the other way. */
function ChalkFourplex({ id, x1, y1 }: { id: string; x1: number; y1: number }) {
  const sketch = drawFourplex(FOURPLEX_HEIGHT)
  const left = x1 - FOURPLEX_RIGHT - sketch.width
  const top = y1 - FOURPLEX_BOTTOM - sketch.height
  const region = { x: left - LOGO_ROOM, y: top - LOGO_ROOM, width: sketch.width + 2 * LOGO_ROOM, height: sketch.height + 2 * LOGO_ROOM }
  const placed = `rotate(${FOURPLEX_TILT} ${left + sketch.width / 2} ${top + sketch.height / 2}) translate(${left} ${top})`
  return <ChalkLines id={`${id}-fourplex`} region={region} transform={placed} paths={[sketch.d]} wobble={LOGO_WOBBLE} />
}

/** Chalk over whatever it filters: two hand passes over the same lines, each bent its own way by up
 *  to `wobble` px, then, unless `grain` is false, the grain of chalk on paper. Within `region` (px),
 *  or without one round the filtered element's own box (Landing/HandTitle.tsx, on the title's text). */
export function ChalkFilter({ id, region, wobble, grain = true }: { id: string; region?: Box; wobble: number; grain?: boolean }) {
  const area = region ? { filterUnits: 'userSpaceOnUse', ...region } : { filterUnits: 'objectBoundingBox', ...AROUND }
  return (
    <filter id={id} {...area}>
      <feTurbulence type="fractalNoise" baseFrequency={CHALK_BEND} numOctaves={2} seed={3} result="bendA" />
      <feDisplacementMap in="SourceGraphic" in2="bendA" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="passA" />
      <feTurbulence type="fractalNoise" baseFrequency={CHALK_BEND} numOctaves={2} seed={11} result="bendB" />
      <feDisplacementMap in="SourceGraphic" in2="bendB" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="passB" />
      <feMerge result="sketch">
        <feMergeNode in="passA" />
        <feMergeNode in="passB" />
      </feMerge>
      {grain && (
        <>
          <feTurbulence type="fractalNoise" baseFrequency={CHALK_GRAIN} numOctaves={2} seed={7} result="grain" />
          <feColorMatrix in="grain" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${CHALK_GAIN} 0 0 0 ${-CHALK_CUT}`} result="dust" />
          <feComposite in="sketch" in2="dust" operator="in" />
        </>
      )}
    </filter>
  )
}

function BlueprintDrawing({ w, h, logo, edge }: { w: number; h: number; logo: boolean; edge: boolean }) {
  const id = `blueprint-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  // On the card's edge, the outer rule takes the card's corner and the band keeps its width.
  const outer = edge ? 0 : OUTER
  const inner = outer + INNER - OUTER
  const x0 = inner
  const y0 = inner
  const x1 = w - inner
  const y1 = h - inner
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

  const cols = Math.floor((x1 - x0) / UNIT + 0.01)
  const topRow = (outer + y0 - TICK_MAJOR) / 2
  const bottomRow = (y1 + TICK_MAJOR + h - outer) / 2

  return (
    <svg width={w} height={h}>
      <defs>
        <pattern id={`${id}-grid`} patternUnits="userSpaceOnUse" x={x0} y={y1} width={UNIT} height={UNIT}>
          <path className="blueprint-minor" d={minor} />
          <path className="blueprint-major" d={`M0.5 0V${UNIT}M0 0.5H${UNIT}`} />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={`url(#${id}-grid)`} />
      <g className="blueprint-rule" fill="none">
        <rect x={outer + 0.5} y={outer + 0.5} width={w - 2 * outer - 1} height={h - 2 * outer - 1} rx={edge ? CARD_RX : OUTER_RX} />
        <rect x={x0 + 0.5} y={y0 + 0.5} width={x1 - x0 - 1} height={y1 - y0 - 1} />
        <path d={ticks} />
      </g>
      {SHOW_SKYLINE && <ChalkSkyline id={id} x0={x0} y0={y0} x1={x1} y1={y1} />}
      {SHOW_CORNERS && logo && w >= CORNER_MIN_SHEET && <ChalkLogo id={id} x0={x0} y1={y1} />}
      {SHOW_CORNERS && w >= CORNER_MIN_SHEET && <ChalkFourplex id={id} x1={x1} y1={y1} />}
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

/** The sheet, filling the card it sits in and redrawn whenever the card changes size. `logo={false}`
 *  leaves out the chalked mark, for a card whose text runs into that corner, and `edge` draws the
 *  outer rule on the card's own edge, for a card with no border of its own (both the result panel). */
export function Blueprint({ logo = true, edge = false }: { logo?: boolean; edge?: boolean }) {
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
      {size && <BlueprintDrawing w={size.w} h={size.h} logo={logo} edge={edge} />}
    </div>
  )
}
