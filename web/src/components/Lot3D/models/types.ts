import type { DesignId } from '@contracts/types'

// A facade model: one of the City's four pre-approved designs as drawn on its plan set (sheet A200
// front and rear elevations, A201 and A202 side elevations, A100 to A104 plans, A300 sections).
//
// Building frame, in metres:
//   u  across the building, from the outer face of the left side wall as seen from the street (0)
//      to the outer face of the right side wall (width)
//   v  back from the outer face of the main front wall (0) to the outer face of the rear wall (length);
//      things in front of the building (stairs, canopy) have negative v
//   z  up from the ground-floor finished floor, the 0.000 datum on the sheets; the basement and the
//      established grade are negative
//
// The builder splits everything at the floor datums, so a wall that runs from the basement to the
// parapet is still one block here: each piece drops in with its own level.

/** Cladding types from each sheet's material schedule (CP-1 to CP-4), metal flashing, concrete. */
export type Cladding = 'CP-1' | 'CP-2' | 'CP-3' | 'CP-4' | 'PFM' | 'concrete'

export interface Opening {
  /** The tag on the elevation, e.g. "WD01" or "DB01". */
  tag: string
  kind: 'window' | 'door'
  /** Outside edges of the frame along the face: u on the front and rear faces, v on the side faces. */
  from: number
  to: number
  /** z of the bottom and top of the frame. */
  sill: number
  head: number
  /** z of a transom bar between an upper and a lower pane, when the elevation draws one. */
  transom?: number
  /** A Juliet balcony guard across the opening (keynote 02). */
  juliet?: boolean
  /** designs.json homes[].id of the home the opening belongs to; null for a shared stair or hall. */
  home: number | null
}

export interface Face {
  /** Overrides the block's cladding on this face. */
  cladding?: Cladding
  openings?: Opening[]
}

/** A box of wall in plan (u0..u1 by v0..v1) from z0 to z1, clad on its exposed faces. */
export interface Block {
  u0: number
  u1: number
  v0: number
  v1: number
  z0: number
  z1: number
  cladding: Cladding
  front?: Face
  rear?: Face
  left?: Face
  right?: Face
  /** A pre-finished metal flashing coping along the top edge (parapets). */
  cap?: boolean
}

/** A horizontal plate: a balcony floor, the entry canopy, a landing or a roof deck. */
export interface Slab {
  kind: 'balcony' | 'canopy' | 'landing' | 'deck'
  u0: number
  u1: number
  v0: number
  v1: number
  /** z of the top surface. */
  z: number
  thickness: number
}

/** A picket guard (keynote 06) along a polyline in plan, standing on z. */
export interface Guard {
  points: [number, number][]
  z: number
  height: number
}

/** A straight flight of steps from its bottom nosing to its top, centred on the line between them. */
export interface Stair {
  from: [number, number, number]
  to: [number, number, number]
  width: number
}

/** The unenclosed vertical platform lift (keynote 07): its footprint and travel. */
export interface Lift {
  u0: number
  u1: number
  v0: number
  v1: number
  z0: number
  z1: number
}

/** A downspout (keynotes 08 and 09) at a point on a wall, from z0 to z1. */
export interface Downspout {
  u: number
  v: number
  z0: number
  z1: number
}

/** The below-grade walkout (keynote 03): a sunken area in plan, from grade down to its floor at z. */
export interface Walkout {
  u0: number
  u1: number
  v0: number
  v1: number
  z: number
}

export interface Datums {
  basement: number
  /** The established grade: the scene's ground plane. */
  grade: number
  ground: number
  second: number
  third: number
  roof: number
  parapet: number
}

export interface FacadeModel {
  id: DesignId
  /** The sheets read, e.g. "A200 p16 front and rear elevations". */
  sheets: string[]
  width: number
  length: number
  datums: Datums
  blocks: Block[]
  slabs: Slab[]
  guards: Guard[]
  stairs: Stair[]
  lifts: Lift[]
  downspouts: Downspout[]
  walkouts: Walkout[]
}
