import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { fill, formatNumber, pending } from '../../copy'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MultiplexMap, type MapBounds } from './MultiplexMap'
import { MultiplexSearch, type PickedPlace } from './MultiplexSearch'
import { MxMarker } from './MxMarker'
import {
  activeFilterCount,
  browse,
  browseToParams,
  clearedBrowse,
  isDefaultBrowse,
  issuedYear,
  NO_YEAR_FROM,
  NO_YEAR_TO,
  PAGE_SIZE,
  parseBrowseParams,
  SORT_KEYS,
  STATUSES,
  PARAM,
  STRUCTURES,
  totalUnits,
  WORKS,
  yearRange,
  type BrowseItem,
  type BrowseSort,
  type BrowseState,
  type LonLat,
} from './multiplex/browse'
import { mxBrowseCopy as copy } from './multiplex/browseCopy'
import { useMultiplexData, type MultiplexData } from './multiplex/data'
import { toggle } from './multiplex/filters'
import { UNIT_OPTIONS } from './multiplex/types'
import './multiplexBrowser.css'

// The "search for permitted multiplexes" page, the way you would search for apartments: search box,
// filters and a list of results on the left, the same permits on the map on the right, always in
// step. On a phone the two become a List / Map toggle. Street names only, never an address; no
// ranking words; no export or download of the list.

/** Same width as the CSS breakpoint in multiplexBrowser.css. */
const NARROW_QUERY = '(max-width: 720px)'
/** Waits before the address bar is rewritten, the result count is announced, and the map refits. */
const URL_DEBOUNCE_MS = 300
const ANNOUNCE_DEBOUNCE_MS = 600
const REFIT_DEBOUNCE_MS = 400
const SKELETON_CARDS = 6

type Pane = 'list' | 'map'

function subscribeNarrow(onChange: () => void): () => void {
  const media = window.matchMedia(NARROW_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const isNarrowNow = () => window.matchMedia(NARROW_QUERY).matches
const useNarrow = () => useSyncExternalStore(subscribeNarrow, isNarrowNow)

function formatFetched(iso: string): string | null {
  const time = Date.parse(iso)
  if (!iso || Number.isNaN(time)) return null
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }).format(time)
}

const resultsLine = (n: number) => fill(n === 1 ? copy.results.count_one : copy.results.count, { count: formatNumber(n, true) })

// ---------- one result card ----------

interface CardProps {
  item: BrowseItem
  selected: boolean
  hot: boolean
  onSelect: (id: number) => void
  onHover: (id: number | null) => void
}

const Card = memo(function Card({ item, selected, hot, onSelect, onHover }: CardProps) {
  const detailId = useId()
  const unitsWork = fill(copy.card.units_work, { units: item.units, work: copy.filters.work_options[item.work] })
  const distance =
    item.distanceM === null
      ? null
      : item.distanceM === 0
        ? copy.card.distance_here
        : fill(copy.card.distance, { distance: formatNumber(item.distanceM, true) })

  return (
    <li
      className="mxb-card"
      data-id={item.id}
      data-selected={selected || undefined}
      data-hot={hot || undefined}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onFocusCapture={() => onHover(item.id)}
      onBlurCapture={() => onHover(null)}
    >
      <h3 className="mxb-card-street">
        <button
          type="button"
          className="mxb-card-button"
          aria-current={selected ? 'true' : undefined}
          aria-describedby={detailId}
          onClick={() => onSelect(item.id)}
        >
          {item.street}
        </button>
      </h3>
      <div id={detailId} className="mxb-card-body">
        <p className="mxb-card-line mxb-card-main">{unitsWork}</p>
        <p className="mxb-card-line">{fill(copy.card.ward, { name: item.wardName, ward: item.ward })}</p>
        <p className="mxb-card-line mxb-card-status">
          <MxMarker kind={item.status} />
          <span>{item.status === 'cleared' ? copy.card.status_cleared : copy.card.status_active}</span>
          <span aria-hidden="true">·</span>
          <span>{fill(copy.card.issued, { year: issuedYear(item.issued) })}</span>
        </p>
        <p className="mxb-card-line">{copy.structure[item.structure]}</p>
        {distance && <p className="mxb-card-line mxb-card-distance">{distance}</p>}
      </div>
      {selected && (
        <p className="mxb-card-selected">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {copy.results.selected}
        </p>
      )}
    </li>
  )
})

// ---------- a check chip ----------

interface ChipProps {
  label: string
  checked: boolean
  onChange: () => void
}

function Chip({ label, checked, onChange }: ChipProps) {
  return (
    <label className="mxb-chip">
      <input type="checkbox" className="mxb-chip-input" checked={checked} onChange={onChange} />
      <span className="mxb-chip-face">
        <svg className="mxb-chip-check" width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
          <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </span>
    </label>
  )
}

// ---------- the page ----------

export function MultiplexBrowser() {
  const load = useMultiplexData()
  const data: MultiplexData | null = load.status === 'ready' ? load.data : null
  const reducedMotion = useReducedMotion()
  const narrow = useNarrow()
  const ids = useId()

  const [initial] = useState(() => parseBrowseParams(window.location.search))
  const [state, setState] = useState<BrowseState>(initial.state)
  const [near, setNear] = useState<LonLat | null>(initial.near)
  const [pane, setPane] = useState<Pane>('list')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [focusId, setFocusId] = useState<number | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const [fitNonce, setFitNonce] = useState(0)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const deferred = useDeferredValue(state)

  const wardNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const f of data?.wards.features ?? []) names[f.properties.ward] = f.properties.name
    return names
  }, [data])
  const wardOptions = useMemo(
    () => [...(data?.wards.features ?? [])].map((f) => f.properties).sort((a, b) => Number(a.ward) - Number(b.ward)),
    [data],
  )
  const years = useMemo(() => (data ? yearRange(data.permits) : null), [data])
  const yearList = useMemo(() => (years ? Array.from({ length: years.max - years.min + 1 }, (_, i) => years.min + i) : []), [years])

  const result = useMemo(
    () => (data ? browse(data.permits, deferred, { near, bounds: deferred.onlyInView ? bounds : null, wardNames }) : null),
    [data, deferred, near, bounds, wardNames],
  )
  const items = result?.items ?? []

  // Latest values for handlers that must stay stable (the cards and the map are memoised on them).
  const itemsRef = useRef<BrowseItem[]>(items)
  useEffect(() => {
    itemsRef.current = items
  })

  // ----- changing the search or a filter -----
  const refitDue = useRef(false)
  const update = useCallback((patch: Partial<BrowseState> | ((s: BrowseState) => Partial<BrowseState>), refit = true) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
    setVisible(PAGE_SIZE)
    if (refit) refitDue.current = true
  }, [])

  // The map refits to the new results once they have settled; never while it is filtering by its own view.
  const permitsOnMap = result?.permits
  useEffect(() => {
    if (!refitDue.current || !permitsOnMap || deferred.onlyInView) return
    const timer = window.setTimeout(() => {
      refitDue.current = false
      if (permitsOnMap.features.length > 0) setFitNonce((n) => n + 1)
    }, REFIT_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [permitsOnMap, deferred.onlyInView])

  // ----- the address bar -----
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // Parameters that are not the search's own (the app's `search=multiplexes`) stay as they are.
      const params = new URLSearchParams(browseToParams(state, near))
      const own = new Set<string>(Object.values(PARAM))
      for (const [key, value] of new URLSearchParams(window.location.search)) if (!own.has(key)) params.set(key, value)
      const text = params.toString().replaceAll('%2C', ',')
      const url = window.location.pathname + (text ? `?${text}` : '') + window.location.hash
      try {
        window.history.replaceState(null, '', url)
      } catch {
        // Some browsers rate-limit replaceState; the next change writes it again.
      }
    }, URL_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state, near])

  // ----- announce the count after a change (not on first load) -----
  const count = items.length
  const announced = useRef<number | null>(null)
  useEffect(() => {
    if (!data) return
    if (announced.current === null) {
      announced.current = count
      return
    }
    if (announced.current === count) return
    const timer = window.setTimeout(() => {
      announced.current = count
      setAnnouncement(resultsLine(count))
    }, ANNOUNCE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [count, data])

  // ----- near point -----
  const onPick = useCallback((place: PickedPlace) => {
    setNear({ lon: place.lon, lat: place.lat })
    setState((s) => (s.sort === 'newest' ? { ...s, sort: 'nearest' } : s))
  }, [])
  const onClearNear = useCallback(() => {
    setNear(null)
    setState((s) => (s.sort === 'nearest' ? { ...s, sort: 'newest' } : s))
  }, [])

  // ----- list <-> map -----
  const fromMap = useRef(false)

  const onSelectCard = useCallback((id: number) => {
    fromMap.current = false
    setSelectedId(id)
    setFocusId(id)
    setFocusNonce((n) => n + 1)
    if (isNarrowNow()) setPane('map')
  }, [])

  const onSelectPermit = useCallback((id: number | null) => {
    fromMap.current = id !== null
    setSelectedId(id)
    if (id === null) return
    const index = itemsRef.current.findIndex((item) => item.id === id)
    if (index >= 0) setVisible((v) => Math.max(v, Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE))
  }, [])

  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!fromMap.current || selectedId === null) return
    const card = listRef.current?.querySelector(`[data-id="${selectedId}"]`)
    if (!card) return
    fromMap.current = false
    card.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [selectedId, visible, reducedMotion])

  const onBoundsChange = useCallback((b: MapBounds) => setBounds(b), [])

  // ----- filters -----
  const clearAll = () => {
    update(clearedBrowse(state))
  }
  const filtersOn = activeFilterCount(state)
  const fromShown = state.fromYear === NO_YEAR_FROM ? (years?.min ?? 0) : state.fromYear
  const toShown = state.toYear === NO_YEAR_TO ? (years?.max ?? 0) : state.toYear

  function pickYear(which: 'from' | 'to', value: number) {
    if (!years) return
    const from = which === 'from' ? value : fromShown
    const to = which === 'to' ? value : toShown
    // A range cannot run backwards: the other end follows.
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    update({ fromYear: lo === years.min ? NO_YEAR_FROM : lo, toYear: hi === years.max ? NO_YEAR_TO : hi })
  }

  const unitsLabel = fill(copy.results.units, { units: formatNumber(totalUnits(items), true) })
  const fetched = data ? formatFetched(data.meta.fetchedAt) : null
  const shown = items.slice(0, visible)
  const remaining = items.length - shown.length
  const sortId = `${ids}-sort`
  const sortHintId = `${ids}-sort-hint`
  const tabId = (p: Pane) => `${ids}-tab-${p}`
  const panelId = (p: Pane) => `${ids}-panel-${p}`

  const filtersBlock = (
    <details className="mxb-filters" open={narrow ? undefined : true} key={narrow ? 'narrow' : 'wide'}>
      <summary className="mxb-filters-summary">{filtersOn > 0 ? fill(copy.filters.show_active, { n: filtersOn }) : copy.filters.show}</summary>
      <div className="mxb-filters-body" role="group" aria-label={copy.aria.filters}>
        <fieldset className="mxb-group">
          <legend>{copy.filters.units}</legend>
          <div className="mxb-chips">
            {UNIT_OPTIONS.map((n) => (
              <Chip
                key={n}
                label={fill(copy.filters.unit_option, { n })}
                checked={state.filters.units.includes(n)}
                onChange={() => update((s) => ({ filters: { ...s.filters, units: toggle(s.filters.units, n) } }))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mxb-group">
          <legend>{copy.filters.status}</legend>
          <div className="mxb-chips">
            {STATUSES.map((v) => (
              <Chip
                key={v}
                label={copy.filters.status_options[v]}
                checked={state.filters.status.includes(v)}
                onChange={() => update((s) => ({ filters: { ...s.filters, status: toggle(s.filters.status, v) } }))}
              />
            ))}
          </div>
          <p className="mxb-help">{copy.filters.status_help}</p>
        </fieldset>

        <fieldset className="mxb-group">
          <legend>{copy.filters.work}</legend>
          <div className="mxb-chips">
            {WORKS.map((v) => (
              <Chip
                key={v}
                label={copy.filters.work_options[v]}
                checked={state.filters.work.includes(v)}
                onChange={() => update((s) => ({ filters: { ...s.filters, work: toggle(s.filters.work, v) } }))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mxb-group">
          <legend>{copy.filters.structure}</legend>
          <div className="mxb-chips">
            {STRUCTURES.map((v) => (
              <Chip
                key={v}
                label={copy.structure[v]}
                checked={state.structures.includes(v)}
                onChange={() => update((s) => ({ structures: toggle(s.structures, v) }))}
              />
            ))}
          </div>
        </fieldset>

        <div className="mxb-row">
          <label className="mxb-field">
            <span className="mxb-field-label">{copy.filters.ward}</span>
            <select className="mxb-select" value={state.ward} onChange={(e) => update({ ward: e.target.value })}>
              <option value="">{copy.filters.all_wards}</option>
              {wardOptions.map((w) => (
                <option key={w.ward} value={w.ward}>
                  {fill(copy.filters.ward_option, { ward: w.ward, name: w.name })}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="mxb-group">
          <legend>{copy.filters.issued}</legend>
          <div className="mxb-row">
            <label className="mxb-field">
              <span className="mxb-field-label">{copy.filters.from}</span>
              <select className="mxb-select" value={fromShown} onChange={(e) => pickYear('from', Number(e.target.value))} disabled={!years}>
                {yearList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="mxb-field">
              <span className="mxb-field-label">{copy.filters.to}</span>
              <select className="mxb-select" value={toShown} onChange={(e) => pickYear('to', Number(e.target.value))} disabled={!years}>
                {yearList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <div className="mxb-chips">
          <Chip label={copy.filters.in_view} checked={state.onlyInView} onChange={() => update((s) => ({ onlyInView: !s.onlyInView }), state.onlyInView)} />
        </div>

        <button type="button" className="mxb-button" onClick={clearAll} disabled={isDefaultBrowse(state)}>
          {copy.filters.clear_all}
        </button>
      </div>
    </details>
  )

  const sourcesBlock = (
    <details className="mxb-sources">
      <summary>{copy.sources.title}</summary>
      <ul className="mxb-sources-list">
        {copy.sources.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
        <li>{copy.filters.status_help}</li>
      </ul>
      {fetched && <p className="mxb-fetched">{fill(copy.fetched, { date: fetched })}</p>}
    </details>
  )

  let results
  if (load.status === 'error') {
    results = (
      <div className="mxb-message" role="alert">
        <p className="mxb-message-title">{copy.error.title}</p>
        <p>{load.message || pending.load_error}</p>
      </div>
    )
  } else if (!data) {
    results = (
      <div aria-busy="true">
        <p className="mxb-sr">{copy.results.loading}</p>
        <ul className="mxb-skeleton" aria-hidden="true">
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <li key={i} className="mxb-skeleton-card" />
          ))}
        </ul>
      </div>
    )
  } else {
    results = (
      <>
        <div className="mxb-results-head">
          <h3 className="mxb-count">{resultsLine(count)}</h3>
          {count > 0 && <p className="mxb-units">{unitsLabel}</p>}
          <div className="mxb-sort">
            <label htmlFor={sortId}>{copy.sort.label}</label>
            <select
              id={sortId}
              className="mxb-select"
              value={state.sort}
              aria-describedby={near ? undefined : sortHintId}
              onChange={(e) => update({ sort: e.target.value as BrowseSort }, false)}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key} disabled={key === 'nearest' && !near}>
                  {copy.sort.options[key]}
                </option>
              ))}
            </select>
          </div>
          {!near && (
            <p id={sortHintId} className="mxb-help">
              {copy.sort.nearest_hint}
            </p>
          )}
        </div>

        {count === 0 ? (
          <div className="mxb-message">
            <p className="mxb-message-title">{copy.empty.title}</p>
            <p>{copy.empty.note}</p>
            <button type="button" className="mxb-button" onClick={clearAll}>
              {copy.empty.clear_all}
            </button>
          </div>
        ) : (
          <>
            <ul ref={listRef} className="mxb-list" aria-label={copy.results.list_label}>
              {shown.map((item) => (
                <Card key={item.id} item={item} selected={item.id === selectedId} hot={item.id === hoverId} onSelect={onSelectCard} onHover={setHoverId} />
              ))}
            </ul>
            <p className="mxb-showing">{fill(copy.results.showing, { shown: formatNumber(shown.length, true), total: formatNumber(count, true) })}</p>
            {remaining > 0 && (
              <button type="button" className="mxb-button mxb-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                {fill(copy.results.more, { n: Math.min(PAGE_SIZE, remaining) })}
              </button>
            )}
          </>
        )}
      </>
    )
  }

  const paneAttrs = (p: Pane) => (narrow ? { role: 'tabpanel' as const, id: panelId(p), 'aria-labelledby': tabId(p) } : {})

  return (
    <div className="mxb" data-pane={pane}>
      {narrow && (
        <div className="mxb-tabs" role="tablist" aria-label={copy.panes.label}>
          {(['list', 'map'] as const).map((p) => (
            <button
              key={p}
              id={tabId(p)}
              type="button"
              role="tab"
              className="mxb-tab"
              aria-selected={pane === p}
              aria-controls={panelId(p)}
              tabIndex={pane === p ? 0 : -1}
              onClick={() => setPane(p)}
              onKeyDown={(e) => {
                const target = e.key === 'Home' ? 'list' : e.key === 'End' ? 'map' : e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (p === 'list' ? 'map' : 'list') : null
                if (target) {
                  e.preventDefault()
                  const next: Pane = target
                  setPane(next)
                  document.getElementById(tabId(next))?.focus()
                }
              }}
            >
              {copy.panes[p]}
            </button>
          ))}
        </div>
      )}

      <section className="mxb-side" aria-label={copy.title} {...paneAttrs('list')}>
        <h2 className="mxb-title">{copy.title}</h2>

        <form className="mxb-search" role="search" aria-label={copy.aria.page} onSubmit={(e) => e.preventDefault()}>
          <label className="mxb-field" htmlFor={`${ids}-q`}>
            <span className="mxb-field-label">{copy.search.label}</span>
          </label>
          <div className="mxb-search-box">
            <input
              id={`${ids}-q`}
              className="mxb-input"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.search.placeholder}
              aria-describedby={`${ids}-q-hint`}
              value={state.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </div>
          <p id={`${ids}-q-hint`} className="mxb-help">
            {copy.search.hint}
          </p>
        </form>

        <div className="mxb-near">
          <h3 className="mxb-subtitle">{copy.near.title}</h3>
          <MultiplexSearch onPick={onPick} onClear={onClearNear} active={near !== null} />
          {near && <p className="mxb-help">{copy.near.active}</p>}
        </div>

        {filtersBlock}

        {results}

        {sourcesBlock}

        <p className="mxb-screening">{copy.screening}</p>
        <p className="mxb-sr" role="status" aria-live="polite">
          {announcement}
        </p>
      </section>

      <div className="mxb-map" aria-label={copy.aria.map} {...paneAttrs('map')}>
        <MultiplexMap
          chrome="bare"
          permits={result?.permits}
          near={near}
          selectedId={selectedId}
          hoverId={hoverId}
          onSelectPermit={onSelectPermit}
          onHoverPermit={setHoverId}
          onBoundsChange={onBoundsChange}
          focusId={focusId}
          focusNonce={focusNonce}
          fitTo="results"
          fitNonce={fitNonce}
        />
      </div>
    </div>
  )
}
