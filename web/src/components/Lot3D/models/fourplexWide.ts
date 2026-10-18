import type { FacadeModel } from './types'

// Fourplex Wide, from COT_Multiplex_FOURPLEX WIDE_Comb-Electric.pdf: A200 (p16) front and rear
// elevations, A201 (p17) left side, A202 (p18) right side, A100 to A103 (p11 to p14) plans,
// A002 (p4) window schedule. Elevations are raster on this set: edges measured from the pixels
// (about 4 mm a pixel), datums calibrated to within 0.006 m.
// Homes: Unit 1 = home 1 (basement), Unit 2 = home 2 (ground), Unit 4 = home 3 (A, 3 bedrooms:
// second floor rear + third floor front), Unit 3 = home 4 (B, 2 bedrooms: second floor front +
// third floor rear).
// The sheets clad the front in CP-1 (brick, cladding type 1).
const CP1 = 'CP-1' as const

export const fourplexWide = {
  id: 'fourplex_wide',
  sheets: [
    'A200 p16 front and rear elevations',
    'A201 p17 side 1 (left) elevation',
    'A202 p18 side 2 (right) elevation',
    'A100 p11 basement plan',
    'A101 p12 main floor plan',
    'A102 p13 second floor plan',
    'A103 p14 third floor plan',
    'A002 p4 door and window schedule',
  ],
  width: 6.64,
  length: 17.0,
  datums: { basement: -2.84, grade: -1.2, ground: 0, second: 2.84, third: 5.69, roof: 8.529, parapet: 8.8 },
  blocks: [
    // Basement and ground floor, left strip: entry recess (front wall 0.648 back; the basement
    // wall below is 0.624 back, taken as one face).
    {
      u0: 0, u1: 3.66, v0: 0.648, v1: 17.0, z0: -2.84, z1: 2.84, cladding: 'CP-4',
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'WA07', kind: 'window', from: 1.316, to: 1.926, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'DB01', kind: 'door', from: 1.926, to: 2.936, sill: -2.84, head: -0.757, home: 1 },
          { tag: 'WA07', kind: 'window', from: 2.936, to: 3.546, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'WA01', kind: 'window', from: 1.176, to: 2.084, sill: 0, head: 2.082, home: 2 },
          { tag: 'DB02', kind: 'door', from: 2.084, to: 3.102, sill: 0, head: 2.082, home: 2 },
          { tag: 'WA04', kind: 'window', from: 3.102, to: 3.559, sill: 0, head: 2.082, home: 2 },
        ],
      },
      left: {
        openings: [
          { tag: 'DA01', kind: 'door', from: 2.747, to: 3.764, sill: -0.997, head: 1.08, home: 3 },
          { tag: 'DA01', kind: 'door', from: 8.022, to: 9.039, sill: -0.997, head: 1.08, home: 4 },
          { tag: 'WB02', kind: 'window', from: 12.267, to: 12.878, sill: 0.745, head: 1.964, home: 2 },
        ],
      },
      rear: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 2.224, to: 3.241, sill: -2.84, head: -0.757, home: 1 },
          { tag: 'WC02', kind: 'window', from: 0.63, to: 1.241, sill: 0, head: 2.082, transom: 0.911, home: 2 },
          { tag: 'WA06', kind: 'window', from: 1.241, to: 2.457, sill: 0, head: 2.082, home: 2 },
          { tag: 'DB02', kind: 'door', from: 2.457, to: 3.475, sill: 0, head: 2.082, home: 2 },
        ],
      },
    },
    // Basement and ground floor, right strip: on the main front wall.
    {
      u0: 3.66, u1: 6.64, v0: 0, v1: 17.0, z0: -2.84, z1: 2.84, cladding: 'CP-4',
      front: {
        cladding: CP1,
        openings: [
          { tag: 'WA08', kind: 'window', from: 4.091, to: 5.008, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'WA08', kind: 'window', from: 5.008, to: 5.925, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'WA01', kind: 'window', from: 3.977, to: 4.89, sill: 0, head: 2.082, home: 2 },
          { tag: 'WB01', kind: 'window', from: 4.89, to: 5.806, sill: 0, head: 2.082, juliet: true, home: 2 },
        ],
      },
      right: {
        openings: [
          { tag: 'WE01', kind: 'window', from: 8.018, to: 9.237, sill: -1.05, head: -0.44, home: 1 },
          { tag: 'WE01', kind: 'window', from: 10.43, to: 11.649, sill: -1.05, head: -0.44, home: 1 },
          { tag: 'WB02', kind: 'window', from: 3.478, to: 4.088, sill: 0.864, head: 2.083, home: 2 },
          { tag: 'WB02', kind: 'window', from: 14.299, to: 14.909, sill: 0.864, head: 2.083, home: 2 },
        ],
      },
      rear: {
        openings: [
          { tag: 'WA08', kind: 'window', from: 4.104, to: 5.014, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'WB05', kind: 'window', from: 5.014, to: 5.932, sill: -2.659, head: -0.757, home: 1 },
          { tag: 'WA01', kind: 'window', from: 4.192, to: 5.099, sill: 0, head: 2.082, home: 2 },
          { tag: 'WA02', kind: 'window', from: 5.099, to: 5.709, sill: 0, head: 2.082, home: 2 },
        ],
      },
    },
    // Second floor body; its front (u 0 to 2.446) is the wall behind the front balcony.
    {
      u0: 0, u1: 6.64, v0: 1.4, v1: 17.0, z0: 2.84, z1: 5.69, cladding: 'CP-4',
      front: {
        cladding: CP1,
        openings: [
          { tag: 'WA01', kind: 'window', from: 0.466, to: 1.384, sill: 2.935, head: 5.011, home: 4 },
          { tag: 'WA01', kind: 'window', from: 1.384, to: 2.291, sill: 2.935, head: 5.011, home: 4 },
        ],
      },
      left: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 3.714, to: 4.324, sill: 3.754, head: 4.973, home: 4 },
          { tag: 'WB02', kind: 'window', from: 14.731, to: 15.341, sill: 3.754, head: 4.973, home: 3 },
        ],
      },
      right: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 6.731, to: 7.341, sill: 3.74, head: 4.959, home: 4 },
          { tag: 'WB02', kind: 'window', from: 10.09, to: 10.7, sill: 3.74, head: 4.959, home: 3 },
        ],
      },
      rear: {
        openings: [
          { tag: 'DB02', kind: 'door', from: 4.098, to: 5.107, sill: 2.935, head: 5.011, home: 3 },
          { tag: 'WA02', kind: 'window', from: 5.107, to: 5.718, sill: 2.935, head: 5.011, home: 3 },
        ],
      },
    },
    // Second floor front projection on the main front wall, and its overhang above the entry.
    {
      u0: 2.446, u1: 6.64, v0: 0, v1: 1.4, z0: 2.84, z1: 5.69, cladding: CP1,
      right: { cladding: 'CP-4' },
      front: {
        openings: [
          { tag: 'WD03', kind: 'window', from: 4.979, to: 6.196, sill: 2.935, head: 5.011, transom: 4.456, home: 4 },
        ],
      },
      left: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 0.335, to: 1.352, sill: 2.933, head: 5.011, home: 4 },
        ],
      },
    },
    { u0: 2.446, u1: 3.66, v0: 0, v1: 0.648, z0: 2.08, z1: 2.84, cladding: CP1 },
    // Second floor rear projection (0.6 m past the rear wall).
    {
      u0: 0.308, u1: 3.357, v0: 17.0, v1: 17.6, z0: 2.08, z1: 6.3, cladding: 'CP-4', cap: true,
      rear: {
        openings: [
          { tag: 'WA01', kind: 'window', from: 0.728, to: 1.643, sill: 2.935, head: 5.011, home: 3 },
          { tag: 'WC01', kind: 'window', from: 1.643, to: 2.559, sill: 2.935, head: 5.011, transom: 3.846, home: 3 },
        ],
      },
    },
    // Terrace parapets (main wall height 6.300) around the third-floor front and rear terraces.
    { u0: 2.446, u1: 6.64, v0: 0, v1: 0.2, z0: 5.69, z1: 6.3, cladding: CP1, cap: true },
    { u0: 2.446, u1: 2.646, v0: 0.2, v1: 1.4, z0: 5.69, z1: 6.3, cladding: CP1, cap: true },
    { u0: 6.44, u1: 6.64, v0: 0.2, v1: 2.894, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
    { u0: 0, u1: 6.64, v0: 16.8, v1: 17.0, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
    { u0: 0, u1: 0.2, v0: 14.379, v1: 16.8, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
    { u0: 6.44, u1: 6.64, v0: 15.6, v1: 16.8, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
    // Third floor: front strip (stepped back 1.4 m), with the open notch at the front right.
    {
      u0: 0, u1: 5.4, v0: 1.4, v1: 2.894, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      front: {
        cladding: CP1,
        openings: [
          { tag: 'WA01', kind: 'window', from: 3.265, to: 4.18, sill: 5.868, head: 7.945, home: 3 },
          { tag: 'WA01', kind: 'window', from: 4.18, to: 5.092, sill: 5.868, head: 7.945, home: 3 },
        ],
      },
      right: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 1.77, to: 2.788, sill: 5.868, head: 7.943, home: 3 },
        ],
      },
    },
    {
      u0: 0, u1: 6.64, v0: 2.894, v1: 14.379, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      front: { cladding: 'CP-3' },
      left: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 5.553, to: 6.164, sill: 6.6, head: 7.817, home: 3 },
          { tag: 'WB02', kind: 'window', from: 10.304, to: 10.914, sill: 6.604, head: 7.823, home: 4 },
        ],
      },
      right: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 5.423, to: 6.033, sill: 6.59, head: 7.809, home: 3 },
          { tag: 'WB02', kind: 'window', from: 10.428, to: 11.038, sill: 6.604, head: 7.823, home: 4 },
        ],
      },
      rear: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 2.233, to: 3.25, sill: 5.868, head: 7.945, home: 4 },
        ],
      },
    },
    // Third floor rear right: reaches 15.6 (1.4 m stepback); the left part stops at 14.379.
    {
      u0: 3.357, u1: 6.64, v0: 14.379, v1: 15.6, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      rear: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 3.636, to: 4.654, sill: 5.868, head: 7.945, home: 4 },
          { tag: 'WA01', kind: 'window', from: 4.654, to: 5.563, sill: 5.868, head: 7.945, home: 4 },
        ],
      },
      left: {
        openings: [
          { tag: 'WA05', kind: 'window', from: 14.57, to: 15.3, sill: 5.868, head: 7.945, home: 4 },
        ],
      },
    },
  ],
  slabs: [
    // Second floor balconies (13); the slatted fascia under each runs down to about 2.08.
    { kind: 'balcony', u0: 0, u1: 2.77, v0: -0.64, v1: 1.4, z: 2.84, thickness: 0.76 },
    { kind: 'balcony', u0: 3.357, u1: 6.64, v0: 17.0, v1: 18.26, z: 2.84, thickness: 0.76 },
    // Canopy (04) over the entry recess and along the left side over the DA01 doors.
    { kind: 'canopy', u0: -0.7, u1: 2.446, v0: 0, v1: 0.648, z: 2.1, thickness: 0.1 },
    { kind: 'canopy', u0: -0.7, u1: 0, v0: 0.648, v1: 10.11, z: 2.1, thickness: 0.1 },
    // Entry porches (12) at the ground floor, front and rear, over the walkouts.
    { kind: 'landing', u0: 0, u1: 3.872, v0: -1.57, v1: 0.648, z: 0, thickness: 0.2 },
    { kind: 'landing', u0: 0, u1: 3.35, v0: 17.0, v1: 19.327, z: 0, thickness: 0.2 },
    // Third floor roof decks (01) behind the parapets.
    { kind: 'deck', u0: 2.646, u1: 6.44, v0: 0.2, v1: 1.4, z: 5.74, thickness: 0.05 },
    { kind: 'deck', u0: 5.4, u1: 6.44, v0: 1.4, v1: 2.894, z: 5.74, thickness: 0.05 },
    { kind: 'deck', u0: 0.2, u1: 3.357, v0: 14.379, v1: 16.8, z: 5.74, thickness: 0.05 },
    { kind: 'deck', u0: 3.357, u1: 6.44, v0: 15.6, v1: 16.8, z: 5.74, thickness: 0.05 },
  ],
  guards: [
    { points: [[0, 1.4], [0, -0.64], [2.77, -0.64], [2.77, 0]], z: 2.84, height: 1.07 },
    { points: [[3.357, 17.6], [3.357, 18.26], [6.64, 18.26], [6.64, 17.0]], z: 2.84, height: 1.07 },
    { points: [[2.72, 1.4], [2.72, 0.1], [6.54, 0.1], [6.54, 2.894]], z: 6.3, height: 0.58 },
    { points: [[0.1, 14.379], [0.1, 16.9], [6.54, 16.9], [6.54, 15.6]], z: 6.3, height: 0.58 },
    { points: [[1.07, -1.57], [3.872, -1.57], [3.872, 0]], z: 0, height: 1.07 },
    { points: [[3.35, 17.0], [3.35, 19.327], [2.23, 19.327]], z: 0, height: 1.07 },
    // Walkout edge guards at grade: approximate (plan reading).
    { points: [[6.3, 0], [6.3, -1.6], [3.6, -1.6]], z: -1.2, height: 1.07 },
    { points: [[6.3, 17.0], [6.3, 19.05], [1.19, 19.05]], z: -1.2, height: 1.07 },
  ],
  // Stairs, lift and walkouts: positions read from the plans at about 0.1 m (approximate).
  stairs: [
    { from: [0.55, -3.2, -1.2], to: [0.55, -1.57, 0], width: 1.0 },
    { from: [3.05, -1.6, -2.84], to: [3.05, -3.9, -1.2], width: 1.1 },
    { from: [1.76, 21.0, -1.2], to: [1.76, 19.327, 0], width: 0.94 },
    { from: [0.69, 19.05, -2.84], to: [0.69, 20.8, -1.2], width: 1.0 },
  ],
  lifts: [{ u0: 1.07, u1: 2.17, v0: -2.6, v1: -1.57, z0: -1.2, z1: 0 }],
  downspouts: [
    { u: 6.72, v: 3.27, z0: -1.2, z1: 8.53 },
    { u: 6.72, v: 15.25, z0: -1.2, z1: 8.53 },
  ],
  walkouts: [
    { u0: 0.29, u1: 6.3, v0: -1.6, v1: 0, z: -2.84 },
    { u0: 0.29, u1: 6.3, v0: 17.0, v1: 19.05, z: -2.84 },
  ],
} satisfies FacadeModel
