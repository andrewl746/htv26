import { labels, pending } from '../../../copy'

/**
 * Every string for the "near me" search on the Multiplexes map. Pending a home in contracts/copy
 * (Simone owns it). The no-results and error texts are not retyped: they come from labels.json and
 * the pending block in web/src/copy.ts.
 *
 * Wording rules: "permitted multiplexes", never "existing"; the typed text is the person's own query
 * and is never drawn on the map; the location stays in the browser.
 */
export const mxSearchCopy = {
  label: 'Find permitted multiplexes near an address',
  placeholder: labels.ui.search_placeholder,
  no_results: labels.ui.outside_toronto,
  load_error: pending.load_error,

  use_location: 'Use my location',
  locating: 'Finding your location…',
  location_note: 'Your location stays in this browser. It is not sent or saved anywhere.',
  clear: 'Clear',

  location_denied: 'Location permission was declined. You can type an address instead.',
  location_unavailable: 'Your location is not available right now. You can type an address instead.',
  location_timeout: 'Finding your location took too long. You can type an address instead.',
  location_unsupported: 'This browser cannot share its location. You can type an address instead.',
  location_outside: 'That looks outside Toronto.',

  picked_address: 'Map moved to the area around that address.',
  picked_location: 'Map moved to the area around your location.',
  cleared: 'Search cleared.',

  aria: {
    search: 'Search for permitted multiplexes near a place',
    results: 'Matching addresses',
    card: 'Permitted multiplexes near the chosen place',
    circle: 'Search area',
  },
  card: {
    close: 'Close nearby permitted multiplexes',
    reopen: 'Show nearby permitted multiplexes',
  },
} as const
