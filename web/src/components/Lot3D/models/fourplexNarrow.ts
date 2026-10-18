import type { FacadeModel } from './types'

// Fourplex Narrow, from COT_Multiplex_FOURPLEX_ Narrow_Comb-Electric.pdf: A200 (p16) front and rear
// elevations, A201 (p17) left side elevation, A100 to A103 (p11 to p14) plans. Plans are vector (u, v
// from the wall lines); elevations are 300 dpi rasters (z from pixel scans, datums within 0.01 m).
// Assumed: third-floor terrace door sills at 5.86 (measured on the rear DC01 only; the others sit behind
// the parapet); second-floor DB03 head; rear exterior stair landings 1.3 and 4.2; downspout v positions;
// the guard round the rear sunken area.
export const fourplexNarrow = {
  id: 'fourplex_narrow',
  sheets: [
    'A200 p16 front and rear elevations',
    'A201 p17 side elevation (left side, u = 0)',
    'A100 p11 basement plan',
    'A101 p12 main floor plan',
    'A102 p13 second floor plan',
    'A103 p14 third floor plan',
  ],
  width: 5.5,
  length: 17.0,
  datums: { basement: -2.84, grade: -1.2, ground: 0, second: 2.84, third: 5.69, roof: 8.529, parapet: 8.8 },
  blocks: [
    // Body behind the second-floor recess line, basement to the third floor.
    {
      u0: 0, u1: 5.5, v0: 1.399, v1: 17.0, z0: -2.84, z1: 5.69, cladding: 'CP-4',
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'WA01', kind: 'window', from: 1.056, to: 1.969, sill: 2.935, head: 5.008, home: 3 },
        ],
      },
      rear: {
        openings: [
          { tag: 'WA08', kind: 'window', from: 1.695, to: 2.608, sill: -2.659, head: -0.765, home: 1 },
          { tag: 'DC01', kind: 'door', from: 3.791, to: 4.807, sill: -2.84, head: -0.765, home: 1 },
          { tag: 'DC01', kind: 'door', from: 3.802, to: 4.818, sill: 0, head: 2.078, home: 2 },
          { tag: 'DC01', kind: 'door', from: 3.818, to: 4.834, sill: 2.84, head: 4.91, home: 3 },
        ],
      },
      left: {
        openings: [
          { tag: 'WE01', kind: 'window', from: 11.51, to: 12.74, sill: -0.95, head: -0.538, home: 1 },
          { tag: 'WB02', kind: 'window', from: 2.935, to: 3.545, sill: 0.859, head: 2.075, home: 2 },
          { tag: 'DA01', kind: 'door', from: 4.089, to: 5.107, sill: 0, head: 2.08, home: null },
          { tag: 'WB02', kind: 'window', from: 3.075, to: 3.685, sill: 3.745, head: 4.965, home: 3 },
          { tag: 'WB02', kind: 'window', from: 10.947, to: 11.555, sill: 3.745, head: 4.965, home: 3 },
        ],
      },
    },
    // Main front wall, right of the entry, basement to the third floor (the walkout is in front of it).
    {
      u0: 2.402, u1: 5.5, v0: 0, v1: 1.399, z0: -2.84, z1: 5.69, cladding: 'CP-3',
      front: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 2.843, to: 3.859, sill: -2.84, head: -0.765, home: 1 },
          { tag: 'WA07', kind: 'window', from: 3.859, to: 4.468, sill: -2.659, head: -0.765, home: 1 },
          { tag: 'WA07', kind: 'window', from: 4.468, to: 5.08, sill: -2.659, head: -0.765, home: 1 },
          { tag: 'WC03', kind: 'window', from: 2.919, to: 3.986, sill: 0, head: 2.078, transom: 0.58, home: 2 },
          { tag: 'WD01', kind: 'window', from: 4.072, to: 5.139, sill: 2.935, head: 5.008, transom: 4.45, home: 3 },
        ],
      },
    },
    // Second-floor strip over the entry: its left face is the recess jamb with the balcony door.
    {
      u0: 1.968, u1: 2.402, v0: 0, v1: 1.399, z0: 2.84, z1: 5.69, cladding: 'CP-3',
      left: {
        openings: [
          { tag: 'DB03', kind: 'door', from: 0.381, to: 1.399, sill: 2.84, head: 4.91, home: 3 },
        ],
      },
    },
    // Entry recess (0.288 behind the main front wall), basement and ground floor.
    {
      u0: 0, u1: 2.402, v0: 0.288, v1: 1.399, z0: -2.84, z1: 2.84, cladding: 'CP-3',
      front: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 0.396, to: 1.426, sill: 0, head: 2.075, home: 2 },
          { tag: 'WA04', kind: 'window', from: 1.426, to: 1.867, sill: 0, head: 2.075, home: 2 },
        ],
      },
    },
    // Rear bay window (600 projection), ground and second floor, face up to the main wall top.
    {
      u0: 0.29, u1: 3.198, v0: 17.0, v1: 17.587, z0: -0.4, z1: 6.3, cladding: 'CP-4',
      rear: {
        openings: [
          { tag: 'WC02', kind: 'window', from: 0.944, to: 1.525, sill: 0, head: 2.078, transom: 0.85, home: 2 },
          { tag: 'WA01', kind: 'window', from: 1.525, to: 2.466, sill: 0, head: 2.078, home: 2 },
          { tag: 'WA01', kind: 'window', from: 0.923, to: 1.85, sill: 2.84, head: 4.912, home: 3 },
          { tag: 'WC02', kind: 'window', from: 1.85, to: 2.442, sill: 2.84, head: 4.912, transom: 3.69, home: 3 },
        ],
      },
    },
    // Third floor, stepped back 1.399 front and 1.411 rear; the part right of u 4.092 sits 0.273 further back.
    {
      u0: 0, u1: 4.092, v0: 1.399, v1: 15.589, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'WD02', kind: 'window', from: 0.389, to: 1.304, sill: 5.868, head: 7.94, transom: 7.38, home: 4 },
        ],
      },
      rear: {
        openings: [
          { tag: 'DB01', kind: 'door', from: 0.87, to: 1.88, sill: 5.86, head: 7.94, home: 4 },
          { tag: 'WA02', kind: 'window', from: 1.88, to: 2.49, sill: 5.868, head: 7.94, home: 4 },
        ],
      },
      left: {
        openings: [
          { tag: 'WB02', kind: 'window', from: 3.075, to: 3.685, sill: 6.597, head: 7.812, home: 4 },
          { tag: 'WB02', kind: 'window', from: 10.964, to: 11.574, sill: 6.597, head: 7.812, home: 4 },
        ],
      },
    },
    {
      u0: 4.092, u1: 5.5, v0: 1.672, v1: 15.589, z0: 5.69, z1: 8.8, cladding: 'CP-4', cap: true,
      front: {
        cladding: 'CP-3',
        openings: [
          { tag: 'DB03', kind: 'door', from: 4.193, to: 5.108, sill: 5.86, head: 7.94, home: 4 },
        ],
      },
      rear: {
        openings: [
          { tag: 'DC01', kind: 'door', from: 4.1, to: 5.105, sill: 5.86, head: 7.94, home: 4 },
        ],
      },
    },
    // Parapets to the main wall top (MAX HEIGHT MAIN WALL 6.300) round the front and rear terraces.
    { u0: 1.968, u1: 5.5, v0: 0, v1: 0.29, z0: 5.69, z1: 6.3, cladding: 'CP-3', cap: true },
    { u0: 5.21, u1: 5.5, v0: 0.29, v1: 1.672, z0: 5.69, z1: 6.3, cladding: 'CP-3', cap: true },
    { u0: 1.968, u1: 2.258, v0: 0.29, v1: 1.399, z0: 5.69, z1: 6.3, cladding: 'CP-3', cap: true },
    { u0: 0, u1: 0.29, v0: 15.589, v1: 17.0, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
    { u0: 5.21, u1: 5.5, v0: 15.589, v1: 17.0, z0: 5.69, z1: 6.3, cladding: 'CP-4', cap: true },
  ],
  slabs: [
    { kind: 'landing', u0: 0, u1: 2.47, v0: -1.518, v1: 0.288, z: 0, thickness: 0.2 },
    { kind: 'canopy', u0: -0.556, u1: 2.398, v0: -0.932, v1: 0.288, z: 2.118, thickness: 0.04 },
    { kind: 'canopy', u0: -0.556, u1: 0, v0: 0.288, v1: 6.709, z: 2.118, thickness: 0.04 },
    { kind: 'balcony', u0: 0, u1: 2.294, v0: -0.661, v1: 1.399, z: 2.84, thickness: 0.2 },
    { kind: 'deck', u0: 2.258, u1: 5.21, v0: 0.29, v1: 1.672, z: 5.69, thickness: 0.05 },
    { kind: 'deck', u0: 0.29, u1: 5.21, v0: 15.589, v1: 17.0, z: 5.69, thickness: 0.05 },
    { kind: 'landing', u0: 3.2, u1: 5.19, v0: 17.0, v1: 18.19, z: 0, thickness: 0.15 },
    { kind: 'landing', u0: 3.2, u1: 5.19, v0: 17.0, v1: 18.19, z: 2.84, thickness: 0.15 },
    { kind: 'landing', u0: 3.2, u1: 5.19, v0: 17.0, v1: 18.19, z: 5.86, thickness: 0.15 },
    { kind: 'landing', u0: 3.2, u1: 5.19, v0: 20.48, v1: 21.53, z: 1.3, thickness: 0.15 },
    { kind: 'landing', u0: 3.2, u1: 5.19, v0: 20.48, v1: 21.53, z: 4.2, thickness: 0.15 },
  ],
  guards: [
    // Second-floor balcony (front left).
    { points: [[0.05, 1.399], [0.05, -0.611], [2.244, -0.611], [2.244, 0]], z: 2.84, height: 1.07 },
    // Entry porch: left side and lift gate, and the edge beside the walkout.
    { points: [[0.051, 0.288], [0.051, -1.499], [1.1, -1.499]], z: 0, height: 1.07 },
    { points: [[2.47, -1.518], [2.47, 0]], z: 0, height: 1.07 },
    // Front walkout, on the retaining walls at grade.
    { points: [[2.617, 0], [2.617, -2.425], [5.29, -2.425], [5.29, 0]], z: -1.2, height: 1.07 },
    // Terrace guards stand on the 6.300 wall top; their rail is 1.07 over the 5.69 deck.
    { points: [[2.25, 1.399], [2.25, 0.145], [5.355, 0.145], [5.355, 1.672]], z: 6.3, height: 0.46 },
    { points: [[0.145, 15.589], [0.145, 17.44], [3.05, 17.44], [3.05, 16.85], [4.24, 16.85]], z: 6.3, height: 0.46 },
    // Rear sunken area at grade (assumed).
    { points: [[0.213, 17.587], [0.213, 20.52], [3.2, 20.52]], z: -1.2, height: 1.07 },
    // Rear exterior stair (A201): the open sides of each landing, in line with the flights' guards.
    { points: [[3.225, 17.587], [3.225, 18.19]], z: 0, height: 1.07 },
    { points: [[5.17, 17.0], [5.17, 18.19]], z: 0, height: 1.07 },
    { points: [[3.225, 20.48], [3.225, 21.48], [5.17, 21.48], [5.17, 20.48]], z: 1.3, height: 1.07 },
    { points: [[3.225, 17.587], [3.225, 18.19]], z: 2.84, height: 1.07 },
    { points: [[5.17, 17.0], [5.17, 18.19]], z: 2.84, height: 1.07 },
    { points: [[3.225, 20.48], [3.225, 21.48], [5.17, 21.48], [5.17, 20.48]], z: 4.2, height: 1.07 },
    // The top landing, where no flight goes on up: its left side and the open half of its far edge.
    { points: [[3.225, 17.44], [3.225, 18.14], [4.125, 18.14]], z: 5.86, height: 1.07 },
    { points: [[5.17, 17.0], [5.17, 18.19]], z: 5.86, height: 1.07 },
  ],
  stairs: [
    // Entry stair (7 risers) from grade to the porch.
    { from: [1.922, -3.046, -1.2], to: [1.922, -1.518, 0], width: 1.0 },
    // Rear walkout private stair (11 risers) from the sunken area up to grade.
    { from: [3.69, 17.91, -2.84], to: [3.69, 20.38, -1.2], width: 0.9 },
    // Rear exterior public stair (keynote 01), switchback flights.
    { from: [4.72, 20.48, -1.2], to: [4.72, 18.19, 0], width: 0.9 },
    { from: [3.675, 18.19, 0], to: [3.675, 20.48, 1.3], width: 0.9 },
    { from: [4.72, 20.48, 1.3], to: [4.72, 18.19, 2.84], width: 0.9 },
    { from: [3.675, 18.19, 2.84], to: [3.675, 20.48, 4.2], width: 0.9 },
    { from: [4.72, 20.48, 4.2], to: [4.72, 18.19, 5.86], width: 0.9 },
  ],
  lifts: [{ u0: 0.05, u1: 1.1, v0: -2.77, v1: -1.5, z0: -1.2, z1: 0 }],
  downspouts: [
    { u: 5.58, v: 1.75, z0: -1.2, z1: 8.53 },
    { u: 5.58, v: 15.45, z0: -1.2, z1: 8.53 },
  ],
  walkouts: [
    { u0: 2.718, u1: 5.188, v0: -2.324, v1: 0, z: -2.84 },
    { u0: 0.315, u1: 5.188, v0: 17.0, v1: 20.419, z: -2.84 },
  ],
} satisfies FacadeModel
