import type { Result } from '@contracts/types'

// Check mark · tilde · cross · dash (MASTERSPEC 6.4): the shape carries the result, the colour only
// repeats it, and the text label always sits next to it.
const PATHS: Record<Result, string> = {
  fits: 'M4.5 8.4l2.4 2.4 4.6-5.2',
  borderline: 'M3.8 9.2c1.3-1.8 2.7-1.8 4.1-.6s2.8 1.2 4.3-.8',
  no_fit: 'M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6',
  not_checked: 'M4.8 8h6.4',
}

export function ResultIcon({ result }: { result: Result }) {
  return (
    <svg className={`result-icon result-${result}`} viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" />
      <path d={PATHS[result]} />
    </svg>
  )
}
