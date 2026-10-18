import { memo } from 'react'
import { fill, formatNumber } from '../../copy'
import { MxMarker } from './MxMarker'
import { mxCopy } from './multiplex/copy'
import type { RampClass } from './multiplex/ramp'
import type { WardCount, WardShapeCollection } from './multiplex/types'

// The legend of the permitted-multiplexes map: always visible, every entry a shape and a word so
// colour is never the only signal. The by-ward table is the accessible twin of the shading: counts
// only, in ward-number order, never sorted by count.

const rangeLabel = (c: RampClass) => (c.from === c.to ? formatNumber(c.from, true) : `${formatNumber(c.from, true)}–${formatNumber(c.to, true)}`)

function formatFetched(iso: string): string | null {
  const time = Date.parse(iso)
  if (!iso || Number.isNaN(time)) return null
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }).format(time)
}

interface Props {
  wards: WardShapeCollection
  counts: Record<string, WardCount>
  /** The shading steps for these counts (from rampClasses). */
  classes: RampClass[]
  /** ISO timestamp the City's files were fetched. */
  fetchedAt: string
}

// Memoised: the map re-renders on every mouse move over a ward (tooltip), the legend table should not.
export const MultiplexLegend = memo(function MultiplexLegend({ wards, counts, classes, fetchedAt }: Props) {
  const fetched = formatFetched(fetchedAt)
  const rows = [...wards.features].sort((a, b) => Number(a.properties.ward) - Number(b.properties.ward))
  const head = mxCopy.counts.headers

  return (
    <section className="mx-legend" aria-label={mxCopy.legend.title}>
      <h2 className="mx-legend-title">{mxCopy.legend.title}</h2>
      <ul className="mx-legend-list">
        <li>
          <MxMarker kind="cleared" />
          <span>{mxCopy.legend.cleared}</span>
        </li>
        <li>
          <MxMarker kind="active" />
          <span>{mxCopy.legend.active}</span>
        </li>
        <li>
          <MxMarker kind="cluster" />
          <span>{mxCopy.legend.cluster_label}</span>
        </li>
      </ul>

      {classes.length > 0 && (
        <div className="mx-ramp">
          <p className="mx-ramp-title">{head.permits}</p>
          <ul className="mx-ramp-steps">
            <li>
              <span className="mx-ramp-swatch mx-ramp-none" aria-hidden="true" />
              <span>0</span>
            </li>
            {classes.map((c) => (
              <li key={c.from}>
                <span className="mx-ramp-swatch" style={{ opacity: c.alpha }} aria-hidden="true" />
                <span>{rangeLabel(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mx-screening">{mxCopy.screening}</p>

      <details className="mx-details" open>
        <summary>{mxCopy.sources.title}</summary>
        <ul className="mx-sources">
          {mxCopy.sources.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        {fetched && <p className="mx-fetched">{fill(mxCopy.fetched, { date: fetched })}</p>}
      </details>

      <details className="mx-details">
        <summary>{mxCopy.counts.title}</summary>
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr>
                <th scope="col">{head.ward}</th>
                <th scope="col">{head.permits}</th>
                <th scope="col">{head.units}</th>
                <th scope="col">{head.active}</th>
                <th scope="col">{head.cleared}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ properties: { ward, name } }) => {
                const c = counts[ward]
                return (
                  <tr key={ward}>
                    <th scope="row">
                      {ward} {name}
                    </th>
                    <td>{c?.permits ?? 0}</td>
                    <td>{c?.units ?? 0}</td>
                    <td>{c?.active ?? 0}</td>
                    <td>{c?.cleared ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
})
