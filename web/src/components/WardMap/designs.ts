import type { DesignId, DesignKey, Result, WardResponse } from '@contracts/types'

/** The ward map's design filter: all four designs together, or one of them. */
export type DesignFilter = 'all' | DesignId

export const DESIGN_KEY: Record<DesignId, DesignKey> = {
  fourplex_narrow: 'fn',
  fourplex_wide: 'fw',
  sixplex_narrow: 'sn',
  sixplex_wide: 'sw',
}

/** The order of contracts/designs.json. */
export const DESIGN_ORDER: DesignId[] = ['fourplex_narrow', 'fourplex_wide', 'sixplex_narrow', 'sixplex_wide']

export const SIXPLEX: DesignId[] = ['sixplex_narrow', 'sixplex_wide']

export const FILTERS: DesignFilter[] = ['all', ...DESIGN_ORDER]

/**
 * The lot property that holds the result for a filter. `b` is the best result across the designs;
 * the per-design results arrive nested in `r`, and are flattened to `rfn`, `rfw`, `rsn` and `rsw`
 * on load so MapLibre expressions can read them.
 */
export function resultProp(filter: DesignFilter): 'b' | `r${DesignKey}` {
  return filter === 'all' ? 'b' : `r${DESIGN_KEY[filter]}`
}

const RANK: Record<Result, number> = { fits: 0, borderline: 1, no_fit: 2, not_checked: 3 }

/** The first design (in designs.json order) with the best result, for the "all designs" tooltip. */
export function bestDesign(results: Record<DesignKey, Result>): DesignId | null {
  let best: DesignId | null = null
  for (const id of DESIGN_ORDER) {
    if (best === null || RANK[results[DESIGN_KEY[id]]] < RANK[results[DESIGN_KEY[best]]]) best = id
  }
  return best
}

/** Whether a filter option is switched off: the sixplexes in wards with no sixplex overlay. */
export function isDisabled(filter: DesignFilter, overlay: WardResponse['sixplex_overlay']): boolean {
  return overlay === 'none' && filter !== 'all' && SIXPLEX.includes(filter)
}
