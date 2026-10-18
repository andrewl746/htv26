import { disclaimers, labels } from '../../../copy'
import { mxCopy } from './copy'

/**
 * Every string the "search for permitted multiplexes" page needs: `multiplexes.browse` in
 * contracts/copy/labels.json (Simone owns it), plus what multiplex/copy.ts already has (structures,
 * the sources list, the fetched date). Placeholders ({{name}}) are filled with `fill` from
 * web/src/copy.ts; keys ending in `_one` are the singular forms.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * units are gross; street names only; no ranking words ("best", "top", "popular").
 */
export const mxBrowseCopy = {
  ...labels.multiplexes.browse,
  screening: disclaimers.screening,
  sources: mxCopy.sources,
  fetched: mxCopy.fetched,
  structure: mxCopy.structure,
} as const
