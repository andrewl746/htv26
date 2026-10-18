import { useId, useMemo, useState } from 'react'
import { fill, formatNumber, pending } from '../../copy'
import { useMultiplexData } from './multiplex/data'
import { DEFAULT_RADIUS_M, nearbyMultiplexes, type NearbyItem } from './multiplex/nearby'
import { mxNearCopy as copy } from './multiplex/nearbyCopy'
import './nearby.css'

// "Permitted multiplexes near this address": a count, a breakdown and the nearest streets. Street
// names only. A permit is not a finished building, and counts are permits, units are gross.

const DEFAULT_MAX_ITEMS = 5
/** The most rows ever listed, however many permits are near. */
const MAX_ROWS = 30

const WORK_LABEL = { new_build: copy.work_new_build, conversion: copy.work_conversion }
const STATUS_LABEL = { cleared: copy.status_cleared, active: copy.status_active }

/** "May 2023" from an ISO date; the date as given when it does not parse. */
function monthYear(iso: string): string {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? iso : new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(time)
}

function formatFetched(iso: string): string | null {
  const time = Date.parse(iso)
  if (!iso || Number.isNaN(time)) return null
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }).format(time)
}

const issuedYear = (issued: string) => /^(\d{4})-/.exec(issued)?.[1] ?? issued

function Row({ item }: { item: NearbyItem }) {
  return (
    <li className="mx-near-row">
      <span className="mx-near-street">{fill(copy.row_street, { street: item.street })}</span>
      <span className="mx-near-detail">
        {fill(copy.row_detail, {
          distance: formatNumber(item.distanceM, true),
          units: item.units,
          work: WORK_LABEL[item.work],
          status: STATUS_LABEL[item.status],
          year: issuedYear(item.issued),
        })}
      </span>
    </li>
  )
}

interface Props {
  centre: { lon: number; lat: number }
  radiusM?: number
  /** Rows shown before "Show all". Default 5. */
  maxItems?: number
}

export function NearbyMultiplexes({ centre, radiusM = DEFAULT_RADIUS_M, maxItems = DEFAULT_MAX_ITEMS }: Props) {
  const headingId = useId()
  const listId = useId()
  const load = useMultiplexData()
  const [expanded, setExpanded] = useState(false)
  const { lon, lat } = centre
  const data = load.status === 'ready' ? load.data : null
  const summary = useMemo(() => (data ? nearbyMultiplexes(data.permits, { lon, lat }, { radiusM }) : null), [data, lon, lat, radiusM])

  const heading = (
    <h3 id={headingId} className="mx-near-heading">
      {copy.heading}
    </h3>
  )

  if (load.status === 'error') {
    return (
      <section className="mx-near" aria-labelledby={headingId}>
        {heading}
        <p className="mx-near-message" role="alert">
          {pending.load_error}
        </p>
      </section>
    )
  }

  if (!summary || !data) {
    return (
      <section className="mx-near" aria-labelledby={headingId} aria-busy="true">
        {heading}
        <p className="mx-near-sr">{copy.loading}</p>
        <div className="mx-near-skeleton" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </section>
    )
  }

  const since = monthYear(summary.since)
  const fetched = formatFetched(data.meta.fetchedAt)
  const listed = summary.items.slice(0, MAX_ROWS)
  const canExpand = listed.length > maxItems
  const shown = expanded ? listed : listed.slice(0, maxItems)
  const { byWork, byStatus } = summary
  const values = { count: summary.count, radius: summary.radiusM, since, units: summary.units }

  return (
    <section className="mx-near" aria-labelledby={headingId}>
      {heading}

      {summary.count === 0 ? (
        <p className="mx-near-summary">
          {fill(copy.empty, values)} {copy.empty_note}
        </p>
      ) : (
        <>
          <p className="mx-near-summary">{fill(summary.count === 1 ? copy.summary_one : copy.summary, values)}</p>
          <p className="mx-near-breakdown">
            {fill(copy.breakdown, {
              new_build: fill(byWork.new_build === 1 ? copy.new_build_one : copy.new_build, { n: byWork.new_build }),
              conversion: fill(byWork.conversion === 1 ? copy.conversion_one : copy.conversion, { n: byWork.conversion }),
              cleared: fill(copy.cleared, { n: byStatus.cleared }),
              active: fill(copy.active, { n: byStatus.active }),
            })}
          </p>

          <ul id={listId} className="mx-near-list" aria-label={copy.aria.list}>
            {shown.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>

          {canExpand && (
            <button type="button" className="mx-near-toggle" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
              {expanded
                ? fill(copy.show_nearest, { n: maxItems })
                : fill(listed.length < summary.count ? copy.show_nearest : copy.show_all, { n: listed.length })}
            </button>
          )}
          {expanded && listed.length < summary.count && (
            <p className="mx-near-note">{fill(copy.capped_note, { n: listed.length, total: summary.count })}</p>
          )}
        </>
      )}

      <p className="mx-near-note">{copy.caveat}</p>
      {fetched && <p className="mx-near-note">{fill(copy.fetched, { date: fetched })}</p>}
      <p className="mx-near-screening">{copy.screening}</p>
    </section>
  )
}
