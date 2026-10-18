import type { FacadeModel } from './types'

// Sixplex Narrow, from COT_Multiplex_SIXPLEX NARROW_Comb_Electric.pdf: A200 (p16) front and rear
// elevations, A201 (p17) left side, A202 (p18) right side, A100 to A104 (p11 to p15) plans.
// The elevations are raster tiles: openings were measured by scanning the pixels at 300 dpi against
// the datum lines (within 0.01 m); plan outlines come from the vector plans.
// Cladding as tagged on the sheets: CP-1 brick on the main front wall, the second-floor recess, the
// third-floor stair box front and the left jog; CP-3 on the porch recess, the stepped-back third
// floor and the DC01 jog; CP-4 on the sides and rear.
// Assumed: the front and rear deep balconies have a slatted band from the canopy
// (2.16) up to the balcony floor; it is modelled as the balcony slab only. Walkout guards at grade
// are approximate.
export const sixplexNarrow = {
  id: 'sixplex_narrow',
  sheets: [
    'A200 p16 front and rear elevations',
    'A201 p17 side 1 (left) elevation',
    'A202 p18 side 2 (right) elevation',
    'A100 p11 basement plan',
    'A101 p12 main floor plan',
    'A102 p13 second floor plan',
    'A103 p14 third floor plan',
    'A104 p15 roof plan',
  ],
  width: 5.9,
  length: 19.0,
  datums: { basement: -2.84, grade: -1.2, ground: 0, second: 2.84, third: 5.69, roof: 8.529, parapet: 8.8 },
  blocks: [
    // Basement and ground floor, front face at the entry porch recess (0.295 back).
    {
      u0: 0, u1: 5.9, v0: 0.295, v1: 19.0, z0: -2.84, z1: 2.84, cladding: 'CP-4',
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'DJ01', kind: 'door', from: 2.101, to: 3.117, sill: -2.84, head: -0.755, home: 1 },
          { tag: 'DA01', kind: 'door', from: 0.389, to: 1.409, sill: 0, head: 2.08, home: 6 },
          { tag: 'DA01', kind: 'door', from: 2.019, to: 3.037, sill: 0, head: 2.08, home: 3 },
        ],
      },
      rear: {
        openings: [
          { tag: 'WF05', kind: 'window', from: 1.783, to: 3.133, sill: -2.659, head: -0.755, home: 2 },
          { tag: 'DJ01', kind: 'door', from: 3.285, to: 4.286, sill: -2.84, head: -0.755, home: 2 },
          { tag: 'DA01', kind: 'door', from: 0.407, to: 1.419, sill: 0, head: 2.08, home: 5 },
          { tag: 'DA01', kind: 'door', from: 1.829, to: 2.849, sill: 0, head: 2.08, home: 4 },
          { tag: 'WF01', kind: 'window', from: 3.277, to: 4.801, sill: 0, head: 2.085, home: 4 },
        ],
      },
      right: {
        openings: [
          { tag: 'WE01', kind: 'window', from: 5.047, to: 6.365, sill: -1.05, head: -0.39, home: 1 },
          { tag: 'WE01', kind: 'window', from: 7.396, to: 8.708, sill: -1.05, head: -0.39, home: 1 },
          { tag: 'WE01', kind: 'window', from: 12.366, to: 13.685, sill: -1.05, head: -0.39, home: 2 },
          { tag: 'WB02', kind: 'window', from: 3.463, to: 4.073, sill: 0.9, head: 2.13, home: 3 },
          { tag: 'WB03', kind: 'window', from: 5.906, to: 6.977, sill: 0.76, head: 2.13, home: 3 },
          { tag: 'WB02', kind: 'window', from: 12.429, to: 13.039, sill: 0.9, head: 2.13, home: 4 },
        ],
      },
    },
    // Basement and ground floor projection beside the porch: the main front wall.
    {
      u0: 3.333, u1: 5.9, v0: 0, v1: 0.295, z0: -2.84, z1: 2.84, cladding: 'CP-1',
      right: { cladding: 'CP-4' },
      front: {
        openings: [
          { tag: 'WF05', kind: 'window', from: 3.7, to: 5.041, sill: -2.659, head: -0.755, home: 1 },
          { tag: 'WF01', kind: 'window', from: 3.611, to: 5.126, sill: 0, head: 2.085, home: 3 },
        ],
      },
    },
    // Second floor, front face at the balcony recess (1.408 back).
    {
      u0: 0, u1: 5.9, v0: 1.408, v1: 19.0, z0: 2.84, z1: 5.69, cladding: 'CP-4',
      front: {
        cladding: 'CP-1',
        openings: [{ tag: 'WC01', kind: 'window', from: 1.371, to: 1.981, sill: 2.935, head: 5.015, home: 6 }],
      },
      rear: {
        openings: [{ tag: 'DJ01', kind: 'door', from: 1.143, to: 2.153, sill: 2.84, head: 5.015, home: 5 }],
      },
      right: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 4.102, to: 4.714, sill: 3.74, head: 4.96, home: 6 },
          { tag: 'WB04', kind: 'window', from: 6.729, to: 7.493, sill: 3.74, head: 4.96, home: 6 },
          { tag: 'WB02', kind: 'window', from: 12.082, to: 12.687, sill: 3.74, head: 4.96, home: 5 },
          { tag: 'WB02', kind: 'window', from: 13.849, to: 14.461, sill: 3.74, head: 4.96, home: 5 },
          { tag: 'WB02', kind: 'window', from: 16.375, to: 16.984, sill: 3.74, head: 4.96, home: 5 },
        ],
      },
    },
    // Second floor main front wall, cantilevered over the porch down to the canopy.
    {
      u0: 2.156, u1: 5.9, v0: 0, v1: 1.408, z0: 2.155, z1: 5.69, cladding: 'CP-1',
      right: { cladding: 'CP-4' },
      front: {
        openings: [{ tag: 'WF02', kind: 'window', from: 2.523, to: 3.746, sill: 2.935, head: 5.015, home: 6 }],
      },
      left: {
        openings: [{ tag: 'DB01', kind: 'door', from: 0.322, to: 1.339, sill: 2.84, head: 5.015, home: 6 }],
      },
    },
    // Rear bay window of the second floor, up to the main wall height.
    {
      u0: 2.764, u1: 5.611, v0: 19.0, v1: 19.58, z0: 2.1, z1: 6.3, cladding: 'CP-4',
      rear: {
        openings: [{ tag: 'WF01', kind: 'window', from: 3.434, to: 4.958, sill: 2.935, head: 5.015, home: 5 }],
      },
    },
    // Main wall above the second floor (MAX HEIGHT MAIN WALL 6.300) around the front and rear decks.
    { u0: 2.156, u1: 5.9, v0: 0, v1: 0.273, z0: 5.69, z1: 6.3, cladding: 'CP-1', right: { cladding: 'CP-4' } },
    { u0: 2.156, u1: 2.429, v0: 0.273, v1: 1.408, z0: 5.69, z1: 6.3, cladding: 'CP-1' },
    { u0: 5.611, u1: 5.9, v0: 0.273, v1: 2.874, z0: 5.69, z1: 6.3, cladding: 'CP-4' },
    { u0: 0, u1: 5.9, v0: 18.716, v1: 19.0, z0: 5.69, z1: 6.3, cladding: 'CP-4' },
    { u0: 0, u1: 0.29, v0: 17.59, v1: 18.716, z0: 5.69, z1: 6.3, cladding: 'CP-4' },
    { u0: 5.611, u1: 5.9, v0: 17.59, v1: 18.716, z0: 5.69, z1: 6.3, cladding: 'CP-4' },
    // Third floor: the stair box over the balcony recess, stepped back 1.408 from the main front wall.
    {
      u0: 0, u1: 2.897, v0: 1.408, v1: 2.874, z0: 5.69, z1: 8.8, cladding: 'CP-3', cap: true,
      left: { cladding: 'CP-4' },
      front: {
        cladding: 'CP-1',
        openings: [
          { tag: 'WD01', kind: 'window', from: 0.33, to: 1.244, sill: 5.868, head: 7.945, transom: 6.88, home: 6 },
        ],
      },
      right: {
        openings: [{ tag: 'DC01', kind: 'door', from: 1.761, to: 2.779, sill: 5.868, head: 7.945, home: 6 }],
      },
    },
    // Third floor main box: 2.874 back at the front deck, 1.41 in from the rear wall.
    {
      u0: 0, u1: 5.9, v0: 2.874, v1: 17.59, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      front: {
        cladding: 'CP-3',
        openings: [{ tag: 'WF03', kind: 'window', from: 3.257, to: 5.082, sill: 5.868, head: 7.945, home: 6 }],
      },
      rear: {
        openings: [
          { tag: 'WD01', kind: 'window', from: 0.4, to: 1.313, sill: 5.868, head: 7.944, home: 5 },
          { tag: 'DJ01', kind: 'door', from: 1.52, to: 2.538, sill: 5.868, head: 7.944, home: 5 },
          { tag: 'WF03', kind: 'window', from: 2.64, to: 4.473, sill: 5.868, head: 7.944, home: 5 },
        ],
      },
      right: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 6.373, to: 6.985, sill: 6.59, head: 7.8, home: 6 },
          { tag: 'WB02', kind: 'window', from: 13.098, to: 13.708, sill: 6.59, head: 7.8, home: 5 },
        ],
      },
    },
  ],
  slabs: [
    { kind: 'landing', u0: 0.054, u1: 3.333, v0: -1.606, v1: 0.295, z: 0, thickness: 0.3 },
    { kind: 'canopy', u0: -0.16, u1: 3.34, v0: -0.9, v1: 0.295, z: 2.155, thickness: 0.07 },
    { kind: 'balcony', u0: 0, u1: 2.43, v0: -0.62, v1: 1.408, z: 2.9, thickness: 0.25 },
    { kind: 'deck', u0: 2.429, u1: 5.611, v0: 0.273, v1: 2.874, z: 5.87, thickness: 0.18 },
    { kind: 'landing', u0: 0.188, u1: 3.06, v0: 19.0, v1: 20.22, z: 0, thickness: 0.3 },
    { kind: 'landing', u0: 1.65, u1: 3.06, v0: 20.22, v1: 21.34, z: 0, thickness: 0.3 },
    { kind: 'balcony', u0: 0, u1: 3.08, v0: 19.0, v1: 20.24, z: 2.9, thickness: 0.25 },
    { kind: 'deck', u0: 0.29, u1: 5.611, v0: 17.59, v1: 18.716, z: 5.81, thickness: 0.12 },
  ],
  guards: [
    { points: [[1.1, -1.58], [3.36, -1.58], [3.36, 0]], z: 0, height: 1.07 },
    { points: [[0.03, 1.408], [0.03, -0.6], [2.41, -0.6], [2.41, 0]], z: 2.9, height: 1.07 },
    { points: [[2.43, 1.408], [2.43, 0.273], [5.611, 0.273], [5.611, 2.874]], z: 5.87, height: 1.07 },
    { points: [[2.79, -1.62], [2.79, -3.7]], z: -1.2, height: 1.07 },
    { points: [[3.89, -3.85], [5.69, -3.85], [5.69, 0]], z: -1.2, height: 1.07 },
    { points: [[0.19, 20.22], [1.65, 20.22]], z: 0, height: 1.07 },
    { points: [[1.65, 21.34], [3.06, 21.34], [3.06, 19.0]], z: 0, height: 1.07 },
    { points: [[0.03, 19.0], [0.03, 20.2], [3.06, 20.2], [3.06, 19.58]], z: 2.9, height: 1.07 },
    { points: [[0.29, 17.59], [0.29, 18.716], [5.611, 18.716], [5.611, 17.59]], z: 5.81, height: 1.07 },
    { points: [[1.66, 22.14], [5.69, 22.14], [5.69, 19.0]], z: -1.2, height: 1.07 },
  ],
  stairs: [
    { from: [0.596, -3.001, -1.2], to: [0.596, -1.602, 0], width: 0.91 },
    { from: [3.391, -1.45, -2.84], to: [3.391, -3.7, -1.2], width: 1.0 },
    { from: [0.044, 20.8, -1.2], to: [1.65, 20.8, 0], width: 0.914 },
    { from: [4.21, 21.58, -2.84], to: [1.66, 21.58, -1.2], width: 0.915 },
  ],
  lifts: [{ u0: 1.227, u1: 2.522, v0: -2.904, v1: -1.659, z0: -1.2, z1: 0 }],
  downspouts: [
    { u: 5.96, v: 3.19, z0: -1.0, z1: 8.53 },
    { u: 5.96, v: 17.17, z0: -1.0, z1: 8.53 },
  ],
  walkouts: [
    { u0: 1.371, u1: 3.333, v0: -1.403, v1: 0.295, z: -2.84 },
    { u0: 3.333, u1: 5.587, v0: -1.403, v1: 0, z: -2.84 },
    { u0: 2.891, u1: 5.587, v0: -3.695, v1: -1.403, z: -2.84 },
    { u0: 1.657, u1: 5.594, v0: 19.0, v1: 22.04, z: -2.84 },
  ],
} satisfies FacadeModel
