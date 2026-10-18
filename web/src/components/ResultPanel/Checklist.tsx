import type { DesignResult, Result, RuleRow } from '@contracts/types'
import { formatMargin, formatValue, labels } from '../../copy'
import { ResultIcon } from './ResultIcon'

/** A rule row's own result: the icon's shape, and the words beside it. */
function rowResult(row: RuleRow): Result {
  if (row.not_applicable) return 'not_checked'
  if (row.borderline) return 'borderline'
  return row.pass ? 'fits' : 'no_fit'
}

/**
 * One card per rule (MASTERSPEC 6.4): an icon with the rule and its result in words, then what the
 * design needs, what this lot has and the signed margin side by side, then the engine's detail line
 * and the by-law section. `id="checklist"` is where the explanation's numbers link to.
 */
export function Checklist({ design }: { design: DesignResult }) {
  if (design.rules.length === 0) return null
  return (
    <section className="panel-section" id="checklist" aria-labelledby="checklist-title">
      <h3 id="checklist-title" className="section-title">
        {labels.ui.what_we_checked}
      </h3>
      <ul className="checklist">
        {design.rules.map((row) => {
          const result = rowResult(row)
          // A pass needs no words of its own: the margin and the icon say it. Anything else does.
          const status = row.not_applicable ? null : labels.results[result]
          return (
            <li key={row.rule_id} className={`checklist-item checklist-${result}`}>
              <p className="checklist-rule">
                <ResultIcon result={result} />
                <span>
                  {labels.rules[row.rule_id]}
                  {status && (
                    <span className={result === 'fits' ? 'visually-hidden' : 'checklist-status'}>
                      {result === 'fits' ? `: ${status}` : status}
                    </span>
                  )}
                </span>
              </p>
              {row.not_applicable ? (
                <p className="checklist-none">{labels.ui.no_limit_here}</p>
              ) : (
                // Three columns on every card; a rule without a margin leaves the third empty.
                <dl className="checklist-values">
                  <div>
                    <dt>{labels.ui.column_required}</dt>
                    <dd>{formatValue(row.required, row.unit)}</dd>
                  </div>
                  <div>
                    <dt>{labels.ui.column_actual}</dt>
                    <dd>{formatValue(row.actual, row.unit)}</dd>
                  </div>
                  {row.margin !== null && (
                    <div className="checklist-margin">
                      <dt>{labels.ui.column_margin}</dt>
                      <dd>{formatMargin(row.margin, row.unit)}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="checklist-notes">
                {row.detail && <p className="checklist-detail">{row.detail}</p>}
                <p className="checklist-bylaw">
                  {labels.ui.column_bylaw} {row.bylaw_section}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
