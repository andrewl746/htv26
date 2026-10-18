import type { Flag, FlagId } from '@contracts/types'
import { labels } from '../../copy'

// Flags (MASTERSPEC 6.4): one chip per flag with its icon, label and sentence. The four that send a
// lot for extra review sit under that heading. The site-specific exception is informational only
// (section 0, T19): one muted line, never a chip and never counted as extra review.

const REVIEW: FlagId[] = ['heritage_register', 'heritage_district', 'ravine', 'trca']

const ICONS: Record<FlagId, string> = {
  // A pediment on two columns.
  heritage_register: 'M3 6.5L8 3l5 3.5M4 6.5h8M5.5 7v5M10.5 7v5M3.5 12.5h9',
  // The same inside a district boundary.
  heritage_district: 'M5 7l3-2 3 2M5.5 7v3.5M10.5 7v3.5M5 11h6M2.5 4.5v-2h2M11.5 2.5h2v2M13.5 11.5v2h-2M4.5 13.5h-2v-2',
  // A tree on a slope.
  ravine: 'M8 2.5l3.5 5.5h-7zM8 8v4M2.5 13.5c3-1 8-1 11 0',
  // Water.
  trca: 'M2.5 6c1.4-1.2 2.6-1.2 3.7 0s2.4 1.2 3.6 0 2.4-1.2 3.7 0M2.5 10c1.4-1.2 2.6-1.2 3.7 0s2.4 1.2 3.6 0 2.4-1.2 3.7 0',
  // An information mark.
  site_exception: 'M8 7.2v4.3M8 4.6v.1',
  // An empty plot.
  vacant: 'M3 3h10v10H3z',
}

function FlagIcon({ id }: { id: FlagId }) {
  return (
    <svg className={`flag-icon flag-icon-${id}`} viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
      {id === 'site_exception' && <circle cx="8" cy="8" r="6" />}
      <path d={ICONS[id]} />
    </svg>
  )
}

function FlagChip({ flag }: { flag: Flag }) {
  return (
    <li className="flag">
      <FlagIcon id={flag.id} />
      <span>
        {flag.source_url ? (
          <a className="flag-label" href={flag.source_url} target="_blank" rel="noreferrer">
            {flag.label}
          </a>
        ) : (
          <span className="flag-label">{flag.label}</span>
        )}{' '}
        {flag.text}
      </span>
    </li>
  )
}

export function Flags({ flags }: { flags: Flag[] }) {
  const review = flags.filter((f) => REVIEW.includes(f.id))
  const others = flags.filter((f) => !REVIEW.includes(f.id) && f.id !== 'site_exception')
  const exception = flags.find((f) => f.id === 'site_exception')
  if (flags.length === 0) return null
  return (
    <section className="panel-section">
      {review.length > 0 && (
        <>
          <h3 className="section-title">{labels.ui.extra_review}</h3>
          <ul className="flags">
            {review.map((f) => (
              <FlagChip key={f.id} flag={f} />
            ))}
          </ul>
        </>
      )}
      {others.length > 0 && (
        <ul className="flags">
          {others.map((f) => (
            <FlagChip key={f.id} flag={f} />
          ))}
        </ul>
      )}
      {exception && (
        <p className="flag-note">
          <FlagIcon id="site_exception" />
          <span>{exception.text}</span>
        </p>
      )}
    </section>
  )
}
