import { useEffect, useState } from 'react'
import { API_BASE } from '../api/config'
import { onCacheUsed } from '../api/demoCache'
import { disclaimers, labels } from '../copy'

/**
 * Where the numbers on screen come from, when it is not the live API (MASTERSPEC 6.7): a banner on
 * the built-in sample data, and a small badge once any answer came from the demo cache.
 */
export function DataBadges() {
  const [cached, setCached] = useState(false)
  useEffect(() => onCacheUsed(() => setCached(true)), [])
  if (API_BASE === null) return <p className="data-banner">{labels.ui.sample_data}</p>
  return cached ? <p className="data-badge">{disclaimers.cached}</p> : null
}
