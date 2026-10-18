import { disclaimers, labels } from '../../../copy'

/**
 * Every string the Multiplexes view needs: `multiplexes.view` in contracts/copy/labels.json (Simone
 * owns it). The screening disclaimer is not retyped: it comes from disclaimers.json and is
 * re-exported here as `screening`.
 *
 * Wording rules: "permitted multiplexes", never "existing"; a permit is not a finished building;
 * "cleared" means the City closed the permit and "active" means permitted, not necessarily built.
 * Placeholders ({{name}}) are filled with `fill` from web/src/copy.ts.
 */
const view = labels.multiplexes.view

export const mxCopy = {
  ...view,
  screening: disclaimers.screening,
  filters: {
    ...view.filters,
    // JSON keys are strings; the filter panel looks the options up by unit count.
    units: { ...view.filters.units, options: view.filters.units.options as Record<number, string> },
  },
}
