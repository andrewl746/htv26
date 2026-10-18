import { memo, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { SearchResult } from '@contracts/types'
import { search } from '../../api/client'
import { isAbort } from '../../api/errors'
import { streetPart } from '../Search/streetPart'
import { mxSearchCopy } from './multiplex/searchCopy'
import './multiplexSearch.css'

// "Near me" search for the permitted-multiplexes map: an address combobox (same API as the app's
// address search) and a "use my location" button. The typed text is the person's own query in a
// search box; it is never drawn on the map. A location is read once, kept in memory only, and
// never stored or sent anywhere.

const DEBOUNCE_MS = 150
const MIN_CHARS = 2
const GEO_TIMEOUT_MS = 10_000
/** A position outside this box is not the City of Toronto (screening-level, not a boundary). */
const TORONTO_BOX = { lonMin: -79.65, lonMax: -79.1, latMin: 43.55, latMax: 43.86 } as const

export interface PickedPlace {
  lon: number
  lat: number
  source: 'address' | 'location'
}

interface Props {
  onPick: (place: PickedPlace) => void
  onClear: () => void
  /** True while a place is chosen; enables the Clear button even when the box is empty. */
  active?: boolean
}

type Lookup = { state: 'idle' } | { state: 'done'; results: SearchResult[] } | { state: 'error' }
type Note = { kind: 'status' | 'alert'; text: string } | null

function inToronto(lon: number, lat: number): boolean {
  return lon >= TORONTO_BOX.lonMin && lon <= TORONTO_BOX.lonMax && lat >= TORONTO_BOX.latMin && lat <= TORONTO_BOX.latMax
}

function geoMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return mxSearchCopy.location_denied
  if (error.code === error.TIMEOUT) return mxSearchCopy.location_timeout
  return mxSearchCopy.location_unavailable
}

export const MultiplexSearch = memo(function MultiplexSearch({ onPick, onClear, active = false }: Props) {
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const listId = useId()
  const locateToken = useRef(0)

  const q = streetPart(query)
  const tooShort = q.length < MIN_CHARS

  useEffect(() => {
    if (tooShort) return
    const request = new AbortController()
    const timer = window.setTimeout(() => {
      search(q, request.signal).then(
        ({ results }) => {
          setLookup({ state: 'done', results })
          setActiveIndex(results.length ? 0 : -1)
        },
        (error: unknown) => {
          if (!isAbort(error)) setLookup({ state: 'error' })
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      request.abort()
    }
  }, [q, tooShort])

  // Under two characters nothing is looked up, and anything from a longer query is stale.
  const shown: Lookup = tooShort ? { state: 'idle' } : lookup
  const results = shown.state === 'done' ? shown.results : []
  const showList = open && shown.state !== 'idle'
  const optionId = (i: number) => `${listId}-${i}`

  function choose(result: SearchResult | undefined) {
    if (!result) return
    locateToken.current += 1
    setLocating(false)
    setQuery(result.address_full)
    setOpen(false)
    setNote({ kind: 'status', text: mxSearchCopy.picked_address })
    onPick({ lon: result.lon, lat: result.lat, source: 'address' })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (!results.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((i) => (i + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      if (!showList || results.length === 0) return
      event.preventDefault()
      choose(results[activeIndex] ?? results[0])
    } else if (event.key === 'Escape') {
      if (showList) {
        event.preventDefault()
        setOpen(false)
      }
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setNote({ kind: 'alert', text: mxSearchCopy.location_unsupported })
      return
    }
    const token = (locateToken.current += 1)
    setOpen(false)
    setLocating(true)
    setNote(null)
    // One reading, held only in this call: no watch, no storage, nothing sent anywhere.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (token !== locateToken.current) return
        setLocating(false)
        const { longitude: lon, latitude: lat } = position.coords
        if (!inToronto(lon, lat)) {
          setNote({ kind: 'alert', text: mxSearchCopy.location_outside })
          return
        }
        setQuery('')
        setNote({ kind: 'status', text: mxSearchCopy.picked_location })
        onPick({ lon, lat, source: 'location' })
      },
      (error) => {
        if (token !== locateToken.current) return
        setLocating(false)
        setNote({ kind: 'alert', text: geoMessage(error) })
      },
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 0 },
    )
  }

  function clear() {
    locateToken.current += 1
    setQuery('')
    setLookup({ state: 'idle' })
    setActiveIndex(-1)
    setOpen(false)
    setLocating(false)
    setNote({ kind: 'status', text: mxSearchCopy.cleared })
    onClear()
  }

  const canClear = active || query !== '' || note !== null

  return (
    <div className="mx-search" role="search" aria-label={mxSearchCopy.aria.search}>
      <div className="mx-search-field">
        <input
          className="mx-search-input"
          type="search"
          role="combobox"
          aria-label={mxSearchCopy.label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={mxSearchCopy.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <div className="mx-search-dropdown" hidden={!showList}>
          <ul id={listId} role="listbox" aria-label={mxSearchCopy.aria.results} className="mx-search-list">
            {results.map((r, i) => (
              <li
                key={r.address_id}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                className="mx-search-option"
                // mousedown, not click: it fires before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(r)
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="mx-search-option-address">{r.address_full}</span>
                <span className="mx-search-option-ward">{r.ward_name}</span>
              </li>
            ))}
          </ul>
          {shown.state === 'done' && results.length === 0 && <p className="mx-search-message">{mxSearchCopy.no_results}</p>}
          {shown.state === 'error' && (
            <p className="mx-search-message" role="alert">
              {mxSearchCopy.load_error}
            </p>
          )}
        </div>
      </div>

      <div className="mx-search-actions">
        <button type="button" className="mx-search-button" onClick={useMyLocation} disabled={locating} aria-describedby={`${listId}-privacy`}>
          <svg className="mx-search-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{locating ? mxSearchCopy.locating : mxSearchCopy.use_location}</span>
        </button>
        <button type="button" className="mx-search-button mx-search-clear" onClick={clear} disabled={!canClear}>
          {mxSearchCopy.clear}
        </button>
      </div>
      <p className="mx-search-privacy" id={`${listId}-privacy`}>
        {mxSearchCopy.location_note}
      </p>
      <p className="mx-search-note" role={note?.kind === 'alert' ? 'alert' : 'status'} data-kind={note?.kind}>
        {note?.text}
      </p>
    </div>
  )
})
