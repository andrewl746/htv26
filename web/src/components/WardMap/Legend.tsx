import { disclaimers, labels } from '../../copy'

/** Always visible (MASTERSPEC 6.5): each entry a shape or pattern and a word, so colour is never alone. */
export function Legend() {
  return (
    <section className="ward-legend" aria-label={labels.ui.legend_screening}>
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
      <p>{disclaimers.upper_bound}</p>
      <p>{labels.ui.legend_screening}</p>
    </section>
  )
}
