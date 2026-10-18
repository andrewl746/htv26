import { labels } from '../../copy'

/**
 * TEMPORARY FALLBACK for Y15's "Near your lot" strings. Simone adds these keys to `ward_map` in
 * contracts/copy/labels.json (S15, the exact strings from MASTERSPEC 8.5). Until that is on main the
 * text below stands in; the real file wins whenever it has the key. DELETE this block, and the
 * spread below, once S15 is on main.
 */
const NEAR_FALLBACK = {
  near_heading: 'Near your lot (within {{radius_m}} m)',
  near_could: '{{count}} lots in this ward may fit a free City design (an upper bound)',
  near_could_one: '{{count}} lot in this ward may fit a free City design (an upper bound)',
  near_did: '{{count}} multiplex permits issued since May 2023',
  near_did_one: '{{count}} multiplex permit issued since May 2023',
  near_ring_label: 'The area within {{radius_m}} m of your lot',
}

/** The ward map's own strings: the `ward_map` group of contracts/copy/labels.json. Everything else
 * on the ward map comes from labels.ward_panel, labels.ui, labels.results_map, labels.classes,
 * labels.briefing_page (the trend chart), reasons.json and disclaimers.json. */
export const wardCopy = { ...NEAR_FALLBACK, ...labels.ward_map }
