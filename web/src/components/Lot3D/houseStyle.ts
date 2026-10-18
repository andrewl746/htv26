// How the neighbouring houses look in the drawn look: Toronto streets, not tower blocks. Brick or
// painted siding, blue daytime windows in light frames on every full floor (never in the gables),
// a front door with a porch facing the street, and per style chimneys or bay windows.
//
// Three styles to choose from; `?houses=a|b|c` (dev only) switches them for comparison.

export type HouseStyleId = 'a' | 'b' | 'c'

export interface WallFinish {
  kind: 'brick' | 'siding'
  colour: string
  /** Mortar for brick, the shadow line for siding. */
  line: string
}

export interface HouseStyle {
  id: HouseStyleId
  name: string
  /** One per neighbour colour index (5). */
  walls: WallFinish[]
  trim: string
  doors: string[]
  glass: string
  porch: boolean
  chimney: boolean
  bay: boolean
}

const STYLES: Record<HouseStyleId, HouseStyle> = {
  a: {
    id: 'a',
    name: 'Toronto brick',
    walls: [
      { kind: 'brick', colour: '#9d4b37', line: '#d6cbbb' },
      { kind: 'brick', colour: '#c4a172', line: '#e6dccb' },
      { kind: 'brick', colour: '#7e4332', line: '#cdbfae' },
      { kind: 'brick', colour: '#a8603f', line: '#d9cebf' },
      { kind: 'brick', colour: '#b98c66', line: '#e3d9c9' },
    ],
    trim: '#f2eee4',
    doors: ['#2f4a3a', '#6b2226', '#22395a', '#3d3a36'],
    glass: '#7fa9d2',
    porch: true,
    chimney: true,
    bay: false,
  },
  b: {
    id: 'b',
    name: 'Brick and painted siding',
    walls: [
      { kind: 'brick', colour: '#9d4b37', line: '#d6cbbb' },
      { kind: 'siding', colour: '#e8e0cc', line: '#c9c0aa' },
      { kind: 'brick', colour: '#c4a172', line: '#e6dccb' },
      { kind: 'siding', colour: '#9fb08f', line: '#839273' },
      { kind: 'siding', colour: '#93a8bb', line: '#778c9f' },
    ],
    trim: '#fbfaf6',
    doors: ['#b23a32', '#2a6f73', '#d9a63a', '#2f3e5c'],
    glass: '#86b0d8',
    porch: true,
    chimney: false,
    bay: false,
  },
  c: {
    id: 'c',
    name: 'Victorian bay-and-gable',
    walls: [
      { kind: 'brick', colour: '#94432f', line: '#d2c6b4' },
      { kind: 'brick', colour: '#c9a878', line: '#e8dfcf' },
      { kind: 'brick', colour: '#8a4632', line: '#cfc2b0' },
      { kind: 'brick', colour: '#b8875f', line: '#e2d7c6' },
      { kind: 'brick', colour: '#a3523a', line: '#d7ccbc' },
    ],
    trim: '#efe6d2',
    doors: ['#27463a', '#5a1d22', '#1d2f4d', '#4a3526'],
    glass: '#7aa4cf',
    porch: true,
    chimney: true,
    bay: true,
  },
}

/** The style the street is drawn in. */
export const DEFAULT_HOUSE_STYLE: HouseStyleId = 'a'

const asked = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('houses') : null

export const HOUSE_STYLE: HouseStyle = STYLES[asked === 'a' || asked === 'b' || asked === 'c' ? asked : DEFAULT_HOUSE_STYLE]
