import { labels, missing } from '../../copy'

/**
 * The ward map's legend, always visible (MASTERSPEC 6.5), in place of Yuvi's WardMap/Legend.tsx: the
 * same four entries, each a shape or pattern and a word so colour is never alone, and one short line
 * under them. The screening line is on the ward panel's footer (WardBrief.tsx).
 */
export function WardLegend() {
  return (
    <section className="ward-legend">
      <ul>
        <li>
          <span className="ward-swatch ward-swatch-fit" aria-hidden="true" />
          {labels.ui.legend_fit}
        </li>
        <li>
          <span className="ward-swatch ward-swatch-borderline" aria-hidden="true" />
          {labels.ui.legend_borderline}
        </li>
        <li>
          <span className="ward-swatch ward-swatch-nofit" aria-hidden="true" />
          {labels.ui.legend_nofit}
        </li>
        <li>
          <span className="ward-swatch ward-swatch-permit" aria-hidden="true" />
          {labels.ui.legend_permit}
        </li>
      </ul>
      <p>{missing.legend_upper_bound}</p>
    </section>
  )
}
