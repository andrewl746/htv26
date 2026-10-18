import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Lang, LotClass, RuleId, TrendResponse, WardResponse } from '@contracts/types'
import reasons from '@contracts/copy/reasons.json'
import { disclaimers, fill, formatNumber, labels } from '../../copy'
import { Blueprint } from '../Landing/Blueprint'
import { wardCopy } from '../WardMap/copy'
import { TrendChart } from '../WardMap/TrendChart'
import { useCountUp } from '../WardMap/useCountUp'
import type { NearYourLot } from '../WardMap/WardPanel'
import { NumberMarks } from './NumberMarks'

/**
 * The ward panel (MASTERSPEC 6.5) as the app shows it, in place of Yuvi's WardMap/WardPanel.tsx and
 * with the same data and strings, laid out to read at a glance: the three headline numbers set large
 * with their words around them, the near-your-lot box as two numbers, the most common reason in one
 * line, the trend chart, then the not-checked counts and the data dates folded away, and the briefing
 * and the screening line under it all, like the result panel's "See your ward". Counts only: no list,
 * no addresses, no ranking words.
 */

/** Classes counted under "Not checked"; attached houses have their own sentence. */
const NOT_CHECKED_CLASSES: LotClass[] = ['condo', 'non_residential', 'older_bylaw', 'larger_building', 'unmeasurable']

const whole = (n: number) => formatNumber(n, true)

/** A copy template cut at its `{{key}}`: the words before that number and after it, each filled from `values`. */
function splitAt(template: string, key: string, values: Record<string, string | number> = {}): [string, string] {
  const mark = `{{${key}}}`
  const at = template.indexOf(mark)
  if (at < 0) return [fill(template, values), '']
  return [fill(template.slice(0, at), values).trim(), fill(template.slice(at + mark.length), values).trim()]
}

/** The result panel's drafting sheet (app.css .panel, as ResultPanel.tsx's Sheet): the content scrolls
 *  inside the ruled area, and `footer` stays under it. */
export function WardSheet({ label, busy = false, footer, children }: { label: string; busy?: boolean; footer?: ReactNode; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  // The scrollbar runs down the band beside the ruled area; app.css takes its width out of the band.
  useLayoutEffect(() => {
    const el = body.current
    if (el) el.style.setProperty('--scrollbar', `${el.offsetWidth - el.clientWidth}px`)
  }, [])
  return (
    <aside className="panel ward-brief" aria-label={label} aria-busy={busy || undefined}>
      <Blueprint logo={false} edge />
      <div ref={body} className="panel-body">
        {children}
      </div>
      {footer}
    </aside>
  )
}

/** One headline number between its words. The words that only repeat the spoken sentence are hidden
 *  from screen readers with the counting number; `spoken` keeps a caption that says something new. */
function Stat({ lead, value, caption, spoken = false, badge, note }: { lead: string; value: string; caption: string; spoken?: boolean; badge?: ReactNode; note?: string }) {
  return (
    <div className="ward-stat">
      <div className="ward-stat-shown" aria-hidden="true">
        {lead && <span className="ward-stat-lead">{lead}</span>}
        <span className="ward-stat-row">
          <span className="ward-figure ward-stat-value">{value}</span>
          {badge}
        </span>
        {!spoken && caption && <span className="ward-stat-caption">{caption}</span>}
      </div>
      {spoken && <p className="ward-stat-caption">{caption}</p>}
      {note && <p className="ward-stat-note">{note}</p>}
    </div>
  )
}

/** One of the near-your-lot numbers, its sentence read as it stands. */
function NearStat({ template, count }: { template: string; count: number }) {
  const [before, after] = splitAt(template, 'count')
  return (
    <p className="ward-near-stat">
      {before && <span className="ward-stat-caption">{before} </span>}
      <span className="ward-figure ward-near-value">{whole(count)}</span> <span className="ward-stat-caption">{after}</span>
    </p>
  )
}

interface Props {
  ward: WardResponse
  lang: Lang
  /** Permits per month for Simone's TrendChart; left out when null or empty. */
  trend?: TrendResponse | null
  /** The near-your-lot box; left out when null (the map opened without a check). */
  near?: NearYourLot | null
  onBack?: () => void
}

export function WardBrief({ ward, lang, trend = null, near = null, onBack }: Props) {
  const { headline, flags, classes } = ward
  const could = useCountUp(headline.could)
  const did = useCountUp(headline.did)
  const perPermit = useCountUp(headline.lots_per_permit ?? 0)
  const topRule = ward.top_blocking_rules[0]?.rule_id as RuleId | undefined
  const copy = labels.ward_panel
  const pct = formatNumber(headline.could_pct_of_house_lots)
  const noPermits = headline.did === 0 || headline.lots_per_permit === null

  const [couldLead, couldCaption] = splitAt(copy.could, 'could_lots', { could_pct: pct })
  const [didLead] = splitAt(copy.did, 'did_permits')
  const [perLead, perCaption] = splitAt(copy.per_permit, 'lots_per_permit')
  // What a screen reader hears once, in place of the counting numbers.
  const spoken = [
    fill(copy.could, { could_lots: whole(headline.could), could_pct: pct }),
    `${copy.upper_bound}.`,
    fill(copy.did, { did_permits: whole(headline.did) }),
    noPermits ? copy.no_permits : fill(copy.per_permit, { lots_per_permit: whole(headline.lots_per_permit ?? 0) }),
  ].join(' ')

  const footer = (
    <div className="panel-footer">
      <a className="button-primary ward-brief-briefing" href={`${ward.briefing_url}?lang=${lang}`} target="_blank" rel="noopener">
        {labels.ui.get_briefing}
      </a>
      <p className="disclaimer">{disclaimers.screening}</p>
    </div>
  )

  return (
    <WardSheet label={ward.ward_name} footer={footer}>
      <header className="ward-brief-header">
        <h2 className="ward-brief-name">{ward.ward_name}</h2>
        {onBack && (
          <button type="button" className="ward-brief-back" onClick={onBack}>
            {labels.ui.back_to_your_lot}
          </button>
        )}
      </header>

      <section className="ward-stats">
        <p className="visually-hidden">{spoken}</p>
        <Stat
          lead={couldLead}
          value={whole(could)}
          caption={couldCaption}
          badge={<span className="badge">{copy.upper_bound}</span>}
          note={fill(copy.flagged, { flagged_fitting_lots: whole(flags.any_on_fitting_lots) })}
        />
        {/* The permits label says the sentence's tail and why the count is a baseline, so it is the caption. */}
        <Stat lead={didLead} value={whole(did)} caption={disclaimers.permits_label} spoken />
        {noPermits ? (
          <p className="ward-stat-caption" aria-hidden="true">
            {copy.no_permits}
          </p>
        ) : (
          <Stat lead={perLead} value={whole(perPermit)} caption={perCaption} />
        )}
      </section>

      {near && (
        <section className="ward-near-box" aria-labelledby="ward-near-heading">
          <h3 id="ward-near-heading" className="section-title">
            {fill(wardCopy.near_heading, { radius_m: whole(near.radiusM) })}
          </h3>
          <div className="ward-near-stats">
            <NearStat template={near.couldCount === 1 ? wardCopy.near_could_one : wardCopy.near_could} count={near.couldCount} />
            <NearStat template={near.didCount === 1 ? wardCopy.near_did_one : wardCopy.near_did} count={near.didCount} />
          </div>
        </section>
      )}

      {topRule && <p className="ward-brief-reason">{fill(copy.blocking_rule, { rule_plain: reasons.rules_plain[topRule] })}</p>}

      {trend && trend.series.length > 0 && (
        <section className="ward-trend">
          <h3 className="section-title">{labels.briefing_page.trend_heading}</h3>
          <TrendChart trend={trend} />
        </section>
      )}

      <details className="ward-more">
        <summary>{labels.results.not_checked}</summary>
        <p>{fill(copy.attached, { attached_pct: formatNumber(ward.attached_share_pct) })}</p>
        <ul className="ward-counts">
          {NOT_CHECKED_CLASSES.map((c) => (
            <li key={c}>
              <span>{labels.classes[c]}</span>
              <span>{whole(classes[c])}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="ward-more">
        <summary>{wardCopy.data_dates}</summary>
        <dl className="ward-dates">
          {Object.entries(ward.data_dates).map(([name, date]) => (
            <div key={name}>
              <dt>{name.replaceAll('_', ' ')}</dt>
              <dd>{date}</dd>
            </div>
          ))}
        </dl>
      </details>

      <NumberMarks />
    </WardSheet>
  )
}
