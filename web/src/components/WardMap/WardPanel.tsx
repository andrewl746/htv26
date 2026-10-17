import type { LotClass, Lang, RuleId, TrendResponse, WardResponse } from '@contracts/types'
import reasons from '@contracts/copy/reasons.json'
import { disclaimers, fill, formatNumber, labels } from '../../copy'
import { wardCopy } from './copy'
import { TrendChart } from './TrendChart'
import { useCountUp } from './useCountUp'

/** Classes counted under "Not checked"; attached houses have their own sentence. */
const NOT_CHECKED_CLASSES: LotClass[] = ['condo', 'non_residential', 'older_bylaw', 'larger_building', 'unmeasurable']

const whole = (n: number) => formatNumber(n, true)

interface Props {
  ward: WardResponse
  lang: Lang
  /** Permits per month for Simone's TrendChart; the chart is left out when this is null or empty. */
  trend?: TrendResponse | null
  onBack?: () => void
}

/**
 * The ward panel (MASTERSPEC 6.5): the could-versus-did headline with counters that count up,
 * the most common reason lots don't fit, the attached share, the review flags, what is not
 * checked, the data dates and the way to the ward briefing. No ranking language anywhere.
 */
export function WardPanel({ ward, lang, trend = null, onBack }: Props) {
  const { headline, flags, classes } = ward
  const could = useCountUp(headline.could)
  const did = useCountUp(headline.did)
  const perPermit = useCountUp(headline.lots_per_permit ?? 0)
  const topRule = ward.top_blocking_rules[0]?.rule_id as RuleId | undefined

  const finalCould = fill(labels.ward_panel.could, { could_lots: whole(headline.could), could_pct: formatNumber(headline.could_pct_of_house_lots) })
  const finalDid = fill(labels.ward_panel.did, { did_permits: whole(headline.did) })
  const finalPer =
    headline.did === 0 || headline.lots_per_permit === null
      ? labels.ward_panel.no_permits
      : fill(labels.ward_panel.per_permit, { lots_per_permit: whole(headline.lots_per_permit) })

  return (
    <aside className="ward-panel" aria-label={ward.ward_name}>
      <header className="ward-panel-header">
        <h2>{ward.ward_name}</h2>
        <p className="disclaimer">{disclaimers.screening}</p>
        {onBack && (
          <button type="button" className="ward-back" onClick={onBack}>
            {labels.ui.back_to_your_lot}
          </button>
        )}
      </header>

      <section className="ward-headline">
        {/* The animated numbers are decoration; screen readers get the final sentences once. */}
        <p className="sr-only">{`${finalCould} ${finalDid} ${finalPer}`}</p>
        <p aria-hidden="true">
          {fill(labels.ward_panel.could, { could_lots: whole(could), could_pct: formatNumber(headline.could_pct_of_house_lots) })}{' '}
          <span className="ward-chip">{labels.ward_panel.upper_bound}</span>
        </p>
        <p aria-hidden="true">{fill(labels.ward_panel.did, { did_permits: whole(did) })}</p>
        <p aria-hidden="true">
          {headline.did === 0 || headline.lots_per_permit === null
            ? labels.ward_panel.no_permits
            : fill(labels.ward_panel.per_permit, { lots_per_permit: whole(perPermit) })}
        </p>
        <p className="ward-note">{disclaimers.permits_label}</p>
      </section>

      <section>
        {topRule && <p>{fill(labels.ward_panel.blocking_rule, { rule_plain: reasons.rules_plain[topRule] })}</p>}
        <p>{fill(labels.ward_panel.attached, { attached_pct: formatNumber(ward.attached_share_pct) })}</p>
        <p>{fill(labels.ward_panel.flagged, { flagged_fitting_lots: whole(flags.any_on_fitting_lots) })}</p>
      </section>

      <section>
        <h3>{labels.results.not_checked}</h3>
        <ul className="ward-counts">
          {NOT_CHECKED_CLASSES.map((c) => (
            <li key={c}>
              <span>{labels.classes[c]}</span>
              <span>{whole(classes[c])}</span>
            </li>
          ))}
        </ul>
      </section>

      {trend && trend.series.length > 0 && (
        <section className="ward-trend">
          <h3>{labels.briefing_page.trend_heading}</h3>
          <TrendChart trend={trend} />
        </section>
      )}

      <a className="ward-briefing" href={`${ward.briefing_url}?lang=${lang}`} target="_blank" rel="noopener">
        {labels.ui.get_briefing}
      </a>

      <section>
        <h3>{wardCopy.data_dates}</h3>
        <dl className="ward-dates">
          {Object.entries(ward.data_dates).map(([name, date]) => (
            <div key={name}>
              <dt>{name.replaceAll('_', ' ')}</dt>
              <dd>{date}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  )
}
