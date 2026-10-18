import type { FacadeModel } from './types'

// Sixplex Wide, from COT_Multiplex_SIXPLEX WIDE_Comb_Electric.pdf: A200 (p16) front and rear
// elevations, A201/A202 (p17, p18) left and right sides, A100 to A103 (p11 to p14) plans, A002 (p4)
// door and window schedule. The elevations are raster tiles, so edges are read from the pixels
// (4.2 mm per pixel) at the outer frame lines; sizes checked against the schedule and AFF notes.
// Third floor stepped back 1.40 m front and 1.42 m rear ("MAIN WALL STEPBACK 1400" on A201/A202).
// Homes: Unit 1 basement front (2 bed) = 1, Unit 2 basement rear = 2, Unit 3 ground front
// (accessible, lift) = 3, Unit 4 ground rear = 4, Unit 6 rear two-storey (3 bed) = 5,
// Unit 5 front two-storey (4 bed) = 6. Side DA01 doors open onto each unit's private stair.
// Assumed: the picket band under each second-floor balcony (z 2.155 to 2.84) is modelled as part of
// a 1.76 m guard; terrace floors at 5.80 (guard tops 6.87); walkout floors at the basement floor;
// the right-side third-floor WB02 position comes from its tag.
// The front brick is CP-1 (CLADDING, TYPE 1) on this sheet.
const BRICK = 'CP-1' as const

export const sixplexWide = {
  id: 'sixplex_wide',
  sheets: [
    'A200 p16 front and rear elevations',
    'A201 p17 left side elevation',
    'A202 p18 right side elevation',
    'A100 p11 basement plan',
    'A101 p12 main floor plan',
    'A102 p13 second floor plan',
    'A103 p14 third floor plan',
    'A002 p4 door and window schedule',
  ],
  width: 8.1,
  length: 17.0,
  datums: { basement: -2.84, grade: -1.2, ground: 0, second: 2.84, third: 5.69, roof: 8.529, parapet: 8.8 },
  blocks: [
    // Basement and ground floor; the front of the left part is the entry recess (v 0.416).
    {
      u0: 0, u1: 8.1, v0: 0.416, v1: 17.0, z0: -2.84, z1: 2.84, cladding: 'CP-4',
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'WA03', kind: 'window', from: 0.37, to: 1.44, sill: 0, head: 2.09, home: 3 },
          { tag: 'WA05', kind: 'window', from: 1.44, to: 2.202, sill: 0, head: 2.09, home: 3 },
          { tag: 'WA05', kind: 'window', from: 2.202, to: 2.965, sill: 0, head: 2.09, home: 3 },
          { tag: 'DB02', kind: 'door', from: 2.965, to: 3.991, sill: 0, head: 2.09, home: 3 },
          { tag: 'DJ01', kind: 'door', from: 2.87, to: 3.91, sill: -2.84, head: -0.746, home: 1 },
        ],
      },
      rear: {
        openings: [
          { tag: 'WA01', kind: 'window', from: 1.43, to: 2.351, sill: 0, head: 2.094, home: 4 },
          { tag: 'WA01', kind: 'window', from: 2.351, to: 3.266, sill: 0, head: 2.094, home: 4 },
          { tag: 'WA01', kind: 'window', from: 3.266, to: 4.189, sill: 0, head: 2.094, home: 4 },
          { tag: 'DB01', kind: 'door', from: 4.777, to: 5.796, sill: 0, head: 2.094, home: 4 },
          { tag: 'WA02', kind: 'window', from: 5.796, to: 6.415, sill: 0, head: 2.094, home: 4 },
          { tag: 'WF06', kind: 'window', from: 1.642, to: 3.491, sill: -2.67, head: -0.755, home: 2 },
          { tag: 'DJ01', kind: 'door', from: 3.618, to: 4.65, sill: -2.84, head: -0.746, home: 2 },
        ],
      },
      left: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 2.354, to: 2.981, sill: 0.9, head: 2.12, home: 3 },
          { tag: 'DA01', kind: 'door', from: 6.028, to: 7.057, sill: -1.03, head: 1.06, home: 5 },
          { tag: 'DA01', kind: 'door', from: 7.472, to: 8.513, sill: -1.03, head: 1.06, home: 1 },
          { tag: 'DA01', kind: 'door', from: 8.932, to: 9.969, sill: -1.03, head: 1.06, home: 2 },
          { tag: 'DA01', kind: 'door', from: 10.354, to: 11.383, sill: -1.03, head: 1.06, home: 6 },
          { tag: 'WB02', kind: 'window', from: 13.7, to: 14.33, sill: 0.9, head: 2.12, home: 4 },
        ],
      },
      right: {
        openings: [
          { tag: 'WE01', kind: 'window', from: 3.82, to: 5.04, sill: -1.05, head: -0.44, home: 1 },
          { tag: 'WE01', kind: 'window', from: 5.955, to: 7.175, sill: -1.05, head: -0.44, home: 1 },
          { tag: 'WE01', kind: 'window', from: 10.45, to: 11.67, sill: -1.05, head: -0.44, home: 2 },
          { tag: 'WE01', kind: 'window', from: 12.67, to: 13.89, sill: -1.05, head: -0.44, home: 2 },
          { tag: 'WB04', kind: 'window', from: 3.276, to: 3.906, sill: 0.76, head: 2.132, home: 3 },
          { tag: 'WB02', kind: 'window', from: 10.68, to: 11.31, sill: 0.904, head: 2.144, home: 4 },
          { tag: 'WB02', kind: 'window', from: 14.0, to: 14.63, sill: 0.904, head: 2.144, home: 4 },
        ],
      },
    },
    // Front right of the basement and ground floor, on the main front wall (v 0), brick.
    {
      u0: 4.25, u1: 8.1, v0: 0, v1: 0.416, z0: -2.84, z1: 2.84, cladding: BRICK,
      front: {
        openings: [
          { tag: 'WF06', kind: 'window', from: 4.613, to: 6.462, sill: -2.67, head: -0.755, home: 1 },
          { tag: 'WA02', kind: 'window', from: 5.992, to: 6.614, sill: 0, head: 2.09, home: 3 },
          { tag: 'DB01', kind: 'door', from: 6.614, to: 7.641, sill: 0, head: 2.09, juliet: true, home: 3 },
        ],
      },
    },
    // Front right of the second floor up to MAX HEIGHT MAIN WALL 6.300 (terrace parapet).
    {
      u0: 2.96, u1: 8.1, v0: 0, v1: 1.4, z0: 2.84, z1: 6.3, cladding: BRICK, cap: true,
      front: {
        openings: [
          { tag: 'WF01', kind: 'window', from: 3.242, to: 4.786, sill: 2.923, head: 5.022, home: 6 },
        ],
      },
      left: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 0.4, to: 1.32, sill: 2.84, head: 4.93, home: 6 },
        ],
      },
    },
    // Second and third floors beside the front-right notch: the stepped-back front face (v 1.40).
    {
      u0: 0, u1: 6.88, v0: 1.4, v1: 2.77, z0: 2.84, z1: 8.8, cladding: 'CP-4', cap: true,
      front: {
        cladding: BRICK,
        openings: [
          { tag: 'WD01', kind: 'window', from: 1.271, to: 2.197, sill: 2.923, head: 5.022, home: 6 },
          { tag: 'WF02', kind: 'window', from: 0.446, to: 1.677, sill: 5.856, head: 7.951, home: 6 },
          { tag: 'WF04', kind: 'window', from: 5.641, to: 6.575, sill: 5.856, head: 7.951, home: 6 },
        ],
      },
      right: {
        cladding: 'CP-3',
        openings: [
          { tag: 'DA02', kind: 'door', from: 1.785, to: 2.674, sill: 5.69, head: 7.78, home: 6 },
        ],
      },
    },
    // Second floor under the third-floor notch at the front right.
    { u0: 6.88, u1: 8.1, v0: 1.4, v1: 2.77, z0: 2.84, z1: 5.69, cladding: 'CP-4' },
    // Second and third floors, full width, from the notch back wall to the stepped-back rear face.
    {
      u0: 0, u1: 8.1, v0: 2.77, v1: 15.58, z0: 2.84, z1: 8.8, cladding: 'CP-4', cap: true,
      front: { cladding: 'CP-3' },
      rear: {
        openings: [
          { tag: 'WF03', kind: 'window', from: 0.52, to: 2.356, sill: 2.923, head: 5.022, home: 5 },
          { tag: 'WF03', kind: 'window', from: 0.952, to: 2.793, sill: 5.856, head: 7.951, home: 5 },
          { tag: 'DJ01', kind: 'door', from: 4.308, to: 5.344, sill: 5.69, head: 7.78, home: 5 },
          { tag: 'WF01', kind: 'window', from: 5.467, to: 7.003, sill: 5.856, head: 7.951, home: 5 },
        ],
      },
      left: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 4.424, to: 5.055, sill: 6.604, head: 7.823, home: 6 },
          { tag: 'WB02', kind: 'window', from: 12.42, to: 13.05, sill: 6.604, head: 7.823, home: 5 },
        ],
      },
      right: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 4.87, to: 5.49, sill: 6.593, head: 7.824, home: 6 },
          { tag: 'WB02', kind: 'window', from: 6.077, to: 6.708, sill: 3.74, head: 4.98, home: 6 },
          { tag: 'WB02', kind: 'window', from: 10.678, to: 11.309, sill: 3.74, head: 4.98, home: 5 },
        ],
      },
    },
    // Rear right of the second floor up to the main wall height (rear terrace parapet).
    {
      u0: 3.02, u1: 8.1, v0: 15.58, v1: 17.0, z0: 2.84, z1: 6.3, cladding: 'CP-4', cap: true,
      rear: {
        openings: [
          { tag: 'WC01', kind: 'window', from: 4.777, to: 5.408, sill: 2.923, head: 5.022, transom: 4.33, home: 5 },
          { tag: 'WC01', kind: 'window', from: 5.784, to: 6.415, sill: 2.923, head: 5.022, transom: 4.33, home: 5 },
        ],
      },
      left: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 15.66, to: 16.58, sill: 2.84, head: 4.93, home: 5 },
        ],
      },
    },
  ],
  slabs: [
    { kind: 'balcony', u0: 0, u1: 3.18, v0: -0.609, v1: 1.4, z: 2.84, thickness: 0.2 },
    { kind: 'balcony', u0: 0, u1: 3.35, v0: 15.58, v1: 17.61, z: 2.84, thickness: 0.2 },
    { kind: 'canopy', u0: -0.46, u1: 4.25, v0: -0.92, v1: 0.416, z: 2.16, thickness: 0.08 },
    { kind: 'canopy', u0: -0.46, u1: 0, v0: 0.416, v1: 12.03, z: 2.16, thickness: 0.08 },
    { kind: 'landing', u0: 2.26, u1: 4.29, v0: -1.99, v1: 0.416, z: 0, thickness: 0.34 },
    { kind: 'landing', u0: 4.68, u1: 6.58, v0: 17.0, v1: 18.875, z: 0, thickness: 0.34 },
    { kind: 'deck', u0: 2.96, u1: 8.1, v0: 0, v1: 1.4, z: 5.8, thickness: 0.11 },
    { kind: 'deck', u0: 6.88, u1: 8.1, v0: 1.4, v1: 2.77, z: 5.8, thickness: 0.11 },
    { kind: 'deck', u0: 3.02, u1: 8.1, v0: 15.58, v1: 17.0, z: 5.8, thickness: 0.11 },
  ],
  guards: [
    { points: [[0, 1.4], [0, -0.609], [3.18, -0.609], [3.18, 0]], z: 2.155, height: 1.76 },
    { points: [[0, 15.58], [0, 17.61], [3.35, 17.61], [3.35, 17.0]], z: 2.155, height: 1.76 },
    { points: [[3.233, 1.4], [3.233, 0.326], [7.81, 0.326], [7.81, 2.77]], z: 5.8, height: 1.07 },
    { points: [[3.31, 15.58], [3.31, 16.674], [7.81, 16.674], [7.81, 15.58]], z: 5.8, height: 1.07 },
    { points: [[2.26, -1.99], [4.29, -1.99], [4.29, 0]], z: 0, height: 1.07 },
    { points: [[4.68, 17.0], [4.68, 18.875], [6.58, 18.875]], z: 0, height: 1.07 },
    { points: [[4.29, -2.02], [6.68, -2.02], [6.68, 0]], z: -1.2, height: 1.07 },
    { points: [[1.42, 17.0], [1.42, 18.62], [4.84, 18.62], [4.84, 17.0]], z: -1.2, height: 1.07 },
  ],
  stairs: [
    { from: [0.73, -1.49, -1.164], to: [2.26, -1.49, 0], width: 1.0 },
    { from: [8.11, 18.37, -1.2], to: [6.58, 18.37, 0], width: 0.914 },
  ],
  lifts: [{ u0: 0.61, u1: 2.27, v0: -0.594, v1: 0.416, z0: -1.2, z1: 0, exit: 'right' }],
  downspouts: [
    { u: 8.18, v: 3.14, z0: -1.2, z1: 8.53 },
    { u: 8.18, v: 15.2, z0: -1.2, z1: 8.53 },
  ],
  walkouts: [
    { u0: 1.95, u1: 6.68, v0: -2.02, v1: 0.416, z: -2.84 },
    { u0: 1.42, u1: 4.84, v0: 17.0, v1: 18.62, z: -2.84 },
  ],
} satisfies FacadeModel
