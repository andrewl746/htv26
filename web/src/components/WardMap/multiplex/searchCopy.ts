import { labels, pending } from '../../../copy'

/**
 * Every string for the "near me" search on the Multiplexes map: `multiplexes.search` in
 * contracts/copy/labels.json (Simone owns it). The placeholder, no-results and error texts are not
 * retyped: they come from labels.ui and the pending block in web/src/copy.ts.
 *
 * Wording rules: "permitted multiplexes", never "existing"; the typed text is the person's own query
 * and is never drawn on the map; the location stays in the browser.
 */
export const mxSearchCopy = {
  ...labels.multiplexes.search,
  placeholder: labels.ui.search_placeholder,
  no_results: labels.ui.outside_toronto,
  load_error: pending.load_error,
} as const
