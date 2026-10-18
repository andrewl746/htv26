import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { SearchResult } from '@contracts/types'
import { search } from '../../api/client'
import { isAbort } from '../../api/errors'
import { labels } from '../../copy'
import { useApp } from '../../state/store'
import { streetPart } from './streetPart'

// Address autocomplete (MASTERSPEC 6.2, J2): a WAI-ARIA combobox over GET /search.
const DEBOUNCE_MS = 150
const MIN_CHARS = 2

type Lookup =
  | { state: 'idle' }
  | { state: 'done'; results: SearchResult[] }
  | { state: 'error' }

export function Search({ variant }: { variant: 'hero' | 'compact' }) {
  const openAddress = useApp((s) => s.openAddress)
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const listId = useId()

  const q = streetPart(query)
  const tooShort = q.length < MIN_CHARS

  useEffect(() => {
    if (tooShort) return
    const request = new AbortController()
    const timer = window.setTimeout(() => {
      search(q, request.signal).then(
        ({ results }) => {
          setLookup({ state: 'done', results })
          setActive(results.length ? 0 : -1)
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

  function choose(result: SearchResult | undefined) {
    if (!result) return
    setQuery(result.address_full)
    setOpen(false)
    openAddress(result.address_id, { fly: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (!results.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active] ?? results[0])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const optionId = (i: number) => `${listId}-${i}`

  return (
    <div className={`search search-${variant}`}>
      <input
        className="search-input"
        type="search"
        role="combobox"
        aria-label={labels.ui.search_placeholder}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        placeholder={labels.ui.search_placeholder}
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
      {/* With no options, the dropdown only says so; clicks pass through it to the example chips below. */}
      <div className="search-dropdown" hidden={!showList} data-message-only={results.length === 0 || undefined}>
        <ul id={listId} role="listbox" className="search-list">
          {results.map((r, i) => (
            <li
              key={r.address_id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className="search-option"
              // mousedown, not click: it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                choose(r)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-option-address">{r.address_full}</span>
              <span className="search-option-ward">{r.ward_name}</span>
            </li>
          ))}
        </ul>
        {shown.state === 'done' && !results.length && (
          <p className="search-message" role="status">
            {labels.ui.outside_toronto}
          </p>
        )}
        {shown.state === 'error' && (
          <p className="search-message" role="status">
            {labels.ui.load_error}
          </p>
        )}
      </div>
    </div>
  )
}
