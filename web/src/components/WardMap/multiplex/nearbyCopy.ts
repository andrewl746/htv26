import { disclaimers, labels } from '../../../copy'

/**
 * Every string the "permitted multiplexes near this address" section needs: `multiplexes.near` in
 * contracts/copy/labels.json (Simone owns it). Placeholders ({{name}}) are filled with `fill` from
 * web/src/copy.ts; keys ending in `_one` are the singular forms.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * units are gross; street names only; no ranking words.
 */
export const mxNearCopy = {
  ...labels.multiplexes.near,
  screening: disclaimers.screening,
}
