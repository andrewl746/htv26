import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { mxBrowseCopy } from './multiplex/browseCopy'
import './multiplexEntry.css'

// "Search for Suplex" on the main page: a button that opens the permitted-multiplexes search over
// the whole app. The search code loads only when it is opened. The address carries
// `?search=multiplexes`, so a reload or a shared link opens it again and Back closes it.

const MultiplexBrowser = lazy(() => import('./MultiplexBrowser').then((m) => ({ default: m.MultiplexBrowser })))

const PARAM_NAME = 'search'
const PARAM_VALUE = 'multiplexes'
/** The search's own address parameters, dropped when it closes (kept in step with multiplex/browse.ts PARAM). */
const SEARCH_PARAMS = ['q', 'units', 'status', 'work', 'structure', 'ward', 'from', 'to', 'sort', 'near']

const isOpenInUrl = () => new URLSearchParams(window.location.search).get(PARAM_NAME) === PARAM_VALUE

interface Props {
  /** Show the button (the main page only); the search page itself shows whenever it is open. */
  showButton: boolean
}

export function MultiplexSearchEntry({ showButton }: Props) {
  const [open, setOpen] = useState(isOpenInUrl)
  const pushed = useRef(false)
  const overlay = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const sync = () => setOpen(isOpenInUrl())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const openSearch = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM_NAME, PARAM_VALUE)
    window.history.pushState(null, '', url)
    pushed.current = true
    setOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      window.history.back() // popstate closes it
      return
    }
    const url = new URL(window.location.href)
    for (const key of [PARAM_NAME, ...SEARCH_PARAMS]) url.searchParams.delete(key)
    window.history.replaceState(null, '', url)
    setOpen(false)
  }, [])

  // While the search is open, the app behind it cannot be tabbed into or read by a screen reader.
  useEffect(() => {
    if (!open) return
    const layer = overlay.current
    const behind = layer ? Array.from(layer.parentElement?.children ?? []).filter((el) => el !== layer) : []
    for (const el of behind) el.setAttribute('inert', '')
    return () => {
      for (const el of behind) el.removeAttribute('inert')
    }
  }, [open])

  // Closing returns the keyboard to the button that opened the search (it is back on screen by then).
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) opener.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <>
      {showButton && !open && (
        <button ref={opener} type="button" className="mx-entry" onClick={openSearch}>
          <svg className="mx-entry-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 13l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {mxBrowseCopy.entry.open}
        </button>
      )}
      {open && (
        <div ref={overlay} className="mx-entry-page" role="region" aria-label={mxBrowseCopy.entry.region}>
          <button type="button" className="mx-entry-back" onClick={closeSearch}>
            <span aria-hidden="true">←</span> {mxBrowseCopy.entry.back}
          </button>
          <div className="mx-entry-body">
            <Suspense fallback={<p className="mx-entry-loading" role="status">{mxBrowseCopy.results.loading}</p>}>
              <MultiplexBrowser />
            </Suspense>
          </div>
        </div>
      )}
    </>
  )
}
