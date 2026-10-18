import { disclaimers } from '../../../copy'
import { mxCopy } from './copy'

/**
 * Every string the "search for permitted multiplexes" page needs, beyond what multiplex/copy.ts
 * already has (statuses, work types, structures, the sources list). Pending a home in
 * contracts/copy (Simone owns it). Placeholders ({{name}}) are filled with `fill` from
 * web/src/copy.ts; keys ending in `_one` are the singular forms.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * units are gross; street names only; no ranking words ("best", "top", "popular").
 */
export const mxBrowseCopy = {
  title: 'Search permitted multiplexes',
  screening: disclaimers.screening,
  sources: mxCopy.sources,
  fetched: mxCopy.fetched,
  structure: mxCopy.structure,

  search: {
    label: 'Search by street or ward',
    placeholder: 'Street name, ward name or ward number',
    hint: 'For example Dundas, Parkdale or 04.',
    clear: 'Clear search text',
  },

  near: {
    title: 'Near an address',
    active: 'Distances are measured from the place you chose.',
  },

  filters: {
    title: 'Filters',
    show: 'Filters',
    show_active: 'Filters ({{n}} on)',
    clear_all: 'Clear all',
    units: 'Units',
    status: 'Status',
    work: 'Work type',
    structure: 'Structure',
    ward: 'Ward',
    all_wards: 'All wards',
    ward_option: '{{ward}} {{name}}',
    issued: 'Issued year',
    from: 'From',
    to: 'To',
    in_view: 'Only show what’s on the map',
    unit_option: '{{n}}',
    status_options: { cleared: 'Cleared', active: 'Active' },
    work_options: { new_build: 'New build', conversion: 'Conversion or addition' },
    status_help: 'Cleared = the City closed the permit. Active = permitted; work may be under way.',
  },

  sort: {
    label: 'Sort by',
    options: { newest: 'Newest first', units: 'Most units', street: 'Street A to Z', nearest: 'Nearest first' },
    nearest_hint: 'Choose an address or use your location to sort by distance.',
  },

  results: {
    count: '{{count}} permitted multiplexes',
    count_one: '1 permitted multiplex',
    units: '{{units}} units, gross',
    showing: 'Showing {{shown}} of {{total}}',
    more: 'Show {{n}} more',
    list_label: 'Permitted multiplexes',
    loading: 'Loading permitted multiplexes',
    selected: 'Selected',
  },

  card: {
    units_work: '{{units}} units · {{work}}',
    ward: '{{name}} (ward {{ward}})',
    issued: 'Issued {{year}}',
    status_cleared: 'Cleared',
    status_active: 'Active',
    distance: 'about {{distance}} m away',
    distance_here: 'less than 10 m away',
    open: 'Show {{street}} on the map',
  },

  empty: {
    title: 'No permitted multiplexes match these filters',
    note: 'This says nothing about what has or hasn’t been built.',
    clear_all: 'Clear all',
  },

  error: {
    title: 'The permitted multiplexes could not be loaded',
  },

  panes: {
    label: 'View',
    list: 'List',
    map: 'Map',
  },

  /** The button on the main page and the way back from the search page. */
  entry: {
    open: 'Search for Suplex',
    back: 'Back to Suplex',
    region: 'Search for permitted multiplexes',
  },

  aria: {
    page: 'Search for permitted multiplexes',
    filters: 'Filter permitted multiplexes',
    results: 'Search results',
    map: 'Map of the permitted multiplexes in the list',
  },
} as const
