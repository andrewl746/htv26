import { Fragment } from 'react'
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
 * One row per rule (MASTERSPEC 6.4): what the design needs, what this lot has, the signed margin,
 * an icon with its result in words, and the by-law section; the engine's detail line under it.
 * `id="checklist"` is where the explanation's numbers link to.
 */
export function Checklist({ design }: { design: DesignResult }) {
  if (design.rules.length === 0) return null
  return (
    <section className="panel-section" id="checklist" aria-labelledby="checklist-title">
      <h3 id="checklist-title" className="section-title">
        {labels.ui.what_we_checked}
      </h3>
      <table className="checklist">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">{labels.ui.what_we_checked}</span>
            </th>
            <th scope="col">{labels.ui.column_required}</th>
            <th scope="col">{labels.ui.column_actual}</th>
            <th scope="col">{labels.ui.column_margin}</th>
          </tr>
        </thead>
        <tbody>
          {design.rules.map((row) => {
            const result = rowResult(row)
            // A pass needs no words of its own: the margin and the icon say it. Anything else does.
            const status = row.not_applicable ? null : labels.results[result]
            return (
              <Fragment key={row.rule_id}>
                <tr className={`checklist-row checklist-${result}`}>
                  <th scope="row">
                    <span className="checklist-rule">
                      <ResultIcon result={result} />
                      <span>
                        {labels.rules[row.rule_id]}
                        {status && (
                          <span className={result === 'fits' ? 'visually-hidden' : 'checklist-status'}>
                            {result === 'fits' ? `: ${status}` : status}
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  {row.not_applicable ? (
                    <td colSpan={3} className="checklist-none">
                      {labels.ui.no_limit_here}
                    </td>
                  ) : (
                    <>
                      <td>{formatValue(row.required, row.unit)}</td>
                      <td>{formatValue(row.actual, row.unit)}</td>
                      <td>{row.margin === null ? '' : formatMargin(row.margin, row.unit)}</td>
                    </>
                  )}
                </tr>
                <tr className="checklist-sub">
                  <td colSpan={4}>
                    {row.detail && <span className="checklist-detail">{row.detail}</span>}
                    <span className="checklist-bylaw">
                      {labels.ui.column_bylaw} {row.bylaw_section}
                    </span>
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
