import type { CheckResponse } from '@contracts/types'
import { missing } from '../../copy'
import { ResultIcon } from './ResultIcon'

/**
 * Shown instead of the design tabs and the checklist when none of the four designs could be checked
 * (a condo, a non-residential zone, an older by-law, a larger building or an unmeasurable lot). It
 * says plainly that multiplexes are not checked here and gives the engine's own reason. The dash icon
 * and the words carry the message, never colour alone.
 */
export function NotSupportedBanner({ reason }: { reason: NonNullable<CheckResponse['lot']['reason']> }) {
  return (
    <section className="not-supported" aria-labelledby="not-supported-title">
      <div className="not-supported-head">
        <ResultIcon result="not_checked" />
        <h3 id="not-supported-title" className="not-supported-title">
          {missing.not_supported_title}
        </h3>
      </div>
      <p className="not-supported-reason">
        <strong>{reason.label}.</strong> {reason.text}
      </p>
      <p className="not-supported-note">{missing.not_supported_note}</p>
    </section>
  )
}
