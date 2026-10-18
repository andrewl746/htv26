import { disclaimers } from '../../../copy'

/**
 * Every string the "permitted multiplexes near this address" section needs. Pending a home in
 * contracts/copy (Simone owns it). Placeholders ({{name}}) are filled with `fill` from
 * web/src/copy.ts; keys ending in `_one` are the singular forms.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * units are gross; street names only; no ranking words.
 */
export const mxNearCopy = {
  heading: 'Permitted multiplexes near this address',
  screening: disclaimers.screening,

  summary: '{{count}} permitted multiplexes within {{radius}} m since {{since}}, with {{units}} units in all.',
  summary_one: '1 permitted multiplex within {{radius}} m since {{since}}, with {{units}} units.',

  // Counts in the breakdown line; the `_one` forms are for exactly one.
  new_build: '{{n}} new builds',
  new_build_one: '1 new build',
  conversion: '{{n}} conversions or additions',
  conversion_one: '1 conversion or addition',
  cleared: '{{n}} cleared',
  active: '{{n}} active',
  breakdown: '{{new_build}} and {{conversion}}; {{cleared}} and {{active}}.',

  row_street: '{{street}}',
  row_detail: 'about {{distance}} m away, {{units}} units, {{work}}, {{status}}, {{year}}',
  work_new_build: 'new build',
  work_conversion: 'conversion or addition',
  status_cleared: 'cleared',
  status_active: 'active',

  empty: 'No permitted multiplexes within {{radius}} m since {{since}}.',
  empty_note: 'This says nothing about whether any were built.',

  show_nearest: 'Show nearest {{n}}',
  show_all: 'Show all {{n}}',
  capped_note: 'Showing the nearest {{n}} of {{total}}.',

  caveat: 'A permit is not a finished building. Unit counts are gross. Each dot sits at the middle of its block, so a permit near the edge of the circle may fall either side of it.',
  fetched: 'Data fetched {{date}}',

  loading: 'Loading permitted multiplexes',
  aria: {
    list: 'Permitted multiplexes near this address, nearest first',
    section_busy: 'Loading permitted multiplexes near this address',
  },
}
