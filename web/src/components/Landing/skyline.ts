/**
 * Downtown Toronto from the islands, after assets/dt_toronto.jpg, sketched in chalk behind the
 * landing card's text: the towers west of the dome, the Rogers Centre, the CN Tower and the core to
 * its east, all standing on the sheet's bottom rule. Edges are shares of the photo's width and the
 * sheet shows its middle, magnified VIEW.zoom times, so the CN Tower and the dome fill the background
 * and the outer towers run off the sides; heights are px before SCALE. The parts come back in drawing
 * order, far row first, so each building can hide the lines of the ones behind it.
 */

type Tower = {
  /** Left and right edges, as shares of the photo's width. */
  from: number
  to: number
  /** Height above the rule (px, before SCALE). */
  h: number
  /** A set-back crown, or a mast on the roof. */
  top?: 'step' | 'mast'
  /** Floor lines, or the mullions of a glass curtain wall. */
  face?: 'floors' | 'glass'
}

/** The part of the photo the sheet shows: the share at its centre, and how many times it is
 *  magnified across, so about the middle half fills the width. */
const VIEW = { centre: 0.5, zoom: 2 }
/** Heights are drawn at this multiple: the CN Tower stands nearly the full height of the sheet, its
 *  pod in the gap between the tagline and the search box. */
const SCALE = 2.1

/** The far row, drawn first. */
const FAR: Tower[] = [
  { from: 0.02, to: 0.068, h: 63, face: 'floors' },
  { from: 0.088, to: 0.132, h: 49, top: 'step' },
  { from: 0.158, to: 0.19, h: 34 },
  { from: 0.186, to: 0.222, h: 50, face: 'floors' },
  { from: 0.216, to: 0.246, h: 35 },
  { from: 0.276, to: 0.31, h: 43, face: 'floors' },
  { from: 0.425, to: 0.468, h: 48, top: 'step' },
  { from: 0.588, to: 0.628, h: 58, face: 'floors' },
  { from: 0.646, to: 0.705, h: 44, face: 'glass' },
  { from: 0.672, to: 0.716, h: 52, top: 'step' },
  { from: 0.804, to: 0.842, h: 52, face: 'floors' },
  { from: 0.852, to: 0.908, h: 46, face: 'glass' },
  { from: 0.904, to: 0.955, h: 70, top: 'mast', face: 'floors' },
  { from: 0.95, to: 0.98, h: 58 },
  { from: 0.975, to: 1, h: 76, face: 'floors' },
]

/** The near row, left to right; the dome and the CN Tower are drawn among these. */
const NEAR_WEST: Tower[] = [
  { from: 0, to: 0.03, h: 20 },
  { from: 0.092, to: 0.128, h: 28, face: 'floors' },
  { from: 0.236, to: 0.27, h: 22 },
]
/** The gap left of the CN Tower is kept clear for its dimension line. */
const NEAR_MIDDLE: Tower[] = [{ from: 0.49, to: 0.53, h: 33, face: 'floors' }]
const NEAR_EAST: Tower[] = [
  { from: 0.612, to: 0.644, h: 41, face: 'floors' },
  { from: 0.69, to: 0.738, h: 24, face: 'glass' },
  { from: 0.738, to: 0.76, h: 31 },
  { from: 0.778, to: 0.826, h: 35, face: 'floors' },
  { from: 0.858, to: 0.9, h: 33 },
  { from: 0.93, to: 1, h: 18 },
]

/** A set-back crown's height, and how far in it steps from each side (share of the width). */
const STEP = 6
const STEP_IN = 0.2
/** A rooftop mast's height. */
const MAST = 14
/** Floor-line and mullion spacing, as drawn (px). */
const FLOOR = 8
const MULLION = 7

/** The Rogers Centre: its edges, the height of its walls and how far the roof rises above them. */
const DOME = { from: 0.272, to: 0.488, wall: 15, rise: 20 }
/** The dome's panel seams, as shares of the roof's rise, and its wall's column spacing (px). */
const DOME_SEAMS = [0.75, 0.5, 0.25]
const DOME_COLUMN = 10

/** The CN Tower: its axis, as a share of the photo's width, and its profile from the ground up as
 *  [half-width before VIEW.zoom, height before SCALE] pairs: the flared base, the shaft, the main pod,
 *  the SkyPod and the mast. */
const CN_AXIS = 0.569
const CN_PROFILE: [number, number][] = [
  [9, 0],
  [4, 80],
  [11, 84],
  [11, 88],
  [7, 91],
  [3, 91],
  [3, 98],
  [5, 98],
  [5, 102],
  [2, 102],
  [0.5, 124],
]
/** The pod's glass band and the mast's ticks (heights before SCALE, half-width before VIEW.zoom). */
const CN_POD_BAND = 86
const CN_MAST_TICKS = { from: 106, to: 118, every: 6, half: 3 }
/** The dimension line measuring the tower: its offset to the left of the axis, its slash ticks'
 *  half-length and how far the extension line runs past it (px, as drawn). */
const CN_DIM_OFFSET = 30
const SLASH = 5
const OVERSHOOT = 5

/** One building: its outline, which also hides what stands behind it, and its inner lines. */
export type SkylinePart = { outline: string; detail: string }
export type Skyline = { parts: SkylinePart[]; dimension: string }

/** The skyline for a sheet whose ruled area runs from `left` to `right` (px), standing on `ground`.
 *  Whatever falls outside the sheet is left for the caller to clip. */
export function drawSkyline(left: number, right: number, ground: number): Skyline {
  const x = (share: number) => Math.round(left + (0.5 + (share - VIEW.centre) * VIEW.zoom) * (right - 1 - left)) + 0.5
  const y = (height: number) => ground - Math.round(height * SCALE)

  const tower = ({ from, to, h, top, face }: Tower): SkylinePart => {
    const a = x(from)
    const b = x(to)
    let outline: string
    if (top === 'step') {
      const inset = Math.round((b - a) * STEP_IN)
      outline = `M${a} ${ground}V${y(h - STEP)}H${a + inset}V${y(h)}H${b - inset}V${y(h - STEP)}H${b}V${ground}Z`
    } else {
      outline = `M${a} ${ground}V${y(h)}H${b}V${ground}Z`
      if (top === 'mast') outline += `M${Math.round((a + b) / 2) + 0.5} ${y(h)}V${y(h + MAST)}`
    }
    const roof = y(top === 'step' ? h - STEP : h)
    let detail = ''
    if (face === 'floors') for (let f = ground - FLOOR; f > roof + 2; f -= FLOOR) detail += `M${a + 2} ${f}H${b - 2}`
    if (face === 'glass') for (let m = a + MULLION; m < b - 1; m += MULLION) detail += `M${m} ${ground}V${roof + 2}`
    return { outline, detail }
  }

  const dome = (): SkylinePart => {
    const a = x(DOME.from)
    const b = x(DOME.to)
    const rx = (b - a) / 2
    const eaves = y(DOME.wall)
    const rise = DOME.rise * SCALE
    const roof = (share: number) => `M${a} ${eaves}A${rx} ${rise * share} 0 0 1 ${b} ${eaves}`
    let detail = DOME_SEAMS.map(roof).join('')
    for (let c = a + DOME_COLUMN; c < b - 1; c += DOME_COLUMN) detail += `M${c} ${ground}V${eaves}`
    return { outline: `M${a} ${ground}V${eaves}A${rx} ${rise} 0 0 1 ${b} ${eaves}V${ground}Z`, detail }
  }

  const axis = x(CN_AXIS)
  const cnTower = (): SkylinePart => {
    const side = (sign: number) => CN_PROFILE.map(([half, height]) => `${axis + sign * half * VIEW.zoom} ${y(height)}`)
    const podHalf = CN_PROFILE[2][0] * VIEW.zoom
    let detail = `M${axis} ${ground}V${y(CN_PROFILE[1][1])}M${axis - podHalf} ${y(CN_POD_BAND)}H${axis + podHalf}`
    const tick = CN_MAST_TICKS.half * VIEW.zoom
    for (let t = CN_MAST_TICKS.from; t <= CN_MAST_TICKS.to; t += CN_MAST_TICKS.every) {
      detail += `M${axis - tick} ${y(t)}H${axis + tick}`
    }
    return { outline: `M${[...side(-1), ...side(1).reverse()].join('L')}Z`, detail }
  }

  const tip = y(CN_PROFILE[CN_PROFILE.length - 1][1])
  const dimX = axis - CN_DIM_OFFSET
  const slash = (at: number) => `M${dimX - SLASH} ${at + SLASH}l${2 * SLASH} ${-2 * SLASH}`
  const dimension = `M${axis - 1} ${tip}H${dimX - OVERSHOOT}M${dimX} ${ground}V${tip}${slash(ground)}${slash(tip)}`

  return {
    parts: [...FAR.map(tower), ...NEAR_WEST.map(tower), dome(), ...NEAR_MIDDLE.map(tower), cnTower(), ...NEAR_EAST.map(tower)],
    dimension,
  }
}
