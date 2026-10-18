import { disclaimers } from '../../../copy'

/**
 * Every string the Multiplexes view needs. Pending a home in contracts/copy (Simone owns it);
 * move it there once she adds it. The screening disclaimer is not retyped: it comes from
 * disclaimers.json and is re-exported here as `screening`.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * "cleared" means the City closed the permit and "active" means permitted, not necessarily built.
 * Placeholders ({{name}}) are filled with `fill` from web/src/copy.ts.
 */
export const mxCopy = {
  title: 'Permitted multiplexes',
  screening: disclaimers.screening,
  layer_toggle: 'Show permitted multiplexes',
  empty: 'No permitted multiplexes match these filters. Try selecting more options.',
  shown: 'Showing {{shown}} of {{total}} permitted multiplexes',
  fetched: 'Data fetched {{date}}',

  aria: {
    map: 'Map of permitted multiplexes by ward. Each dot is placed near the permit’s street; house numbers are not shown.',
    filters: 'Filter permitted multiplexes',
    popup: 'Details for one permitted multiplex',
  },

  filters: {
    title: 'Filters',
    reset: 'Show everything',
    units: {
      title: 'Number of units',
      options: { 2: '2 units', 3: '3 units', 4: '4 units', 5: '5 units', 6: '6 units' } as Record<number, string>,
    },
    status: {
      title: 'Permit status',
      options: { cleared: 'Cleared (permit closed)', active: 'Active (permitted)' },
    },
    work: {
      title: 'Type of work',
      options: { new_build: 'New build', conversion: 'Conversion or addition' },
    },
  },

  structure: {
    detached: 'Detached house',
    semi: 'Semi-detached house',
    townhouse: 'Townhouse',
    other: 'Other building type',
  },

  popup: {
    heading: 'On {{street}}',
    units: 'Units (gross)',
    type: 'Type',
    structure: 'Structure',
    status: 'Status',
    issued: 'Issued',
    status_cleared: 'Permit closed (cleared)',
    status_active: 'Permitted (active)',
    work_new_build: 'New build',
    work_conversion: 'Conversion or addition',
    note: 'A permit is not a finished building.',
  },

  legend: {
    title: 'Legend',
    cleared: 'Cleared: the City closed the permit (solid dot)',
    active: 'Active: permitted, not necessarily built (ring)',
    cluster_label: 'Group of permitted multiplexes',
  },

  ward: {
    tooltip: 'Ward {{ward}} {{name}}: {{count}} permitted multiplexes, {{units}} units',
    // A permit has 2 to 6 units, so one permit is never "1 units".
    tooltip_one: 'Ward {{ward}} {{name}}: 1 permitted multiplex, {{units}} units',
  },

  counts: {
    title: 'Counts by ward',
    headers: {
      ward: 'Ward',
      permits: 'Permits',
      units: 'Units',
      active: 'Active',
      cleared: 'Cleared',
    },
  },

  sources: {
    title: 'Data sources & caveats',
    bullets: [
      'A permit is not a finished building: it shows what the City permitted, not what stands today.',
      'Unit counts are gross: units lost to demolition are not subtracted.',
      'Some permits could not be located on the map and are left out.',
      'Each dot is placed near the permit’s street; house numbers are not shown.',
      'Data: City of Toronto Open Data, active and cleared building permits.',
    ],
  },
}
