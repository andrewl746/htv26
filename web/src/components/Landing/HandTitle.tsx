import { useId } from 'react'
import { ChalkFilter } from './Blueprint'

/** How far each of the two pen passes bends the letters (px). */
const TITLE_WOBBLE = 3

/**
 * The name, gone over twice by hand: still the page's heading in real text, run through the sheet's
 * chalk filter without its grain, which waits in a hidden svg beside it.
 */
export function HandTitle() {
  const id = `hand-title-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <>
      <svg className="hand-title-defs" width={0} height={0} aria-hidden="true">
        <defs>
          <ChalkFilter id={id} wobble={TITLE_WOBBLE} grain={false} />
        </defs>
      </svg>
      <h1 className="landing-title" style={{ filter: `url(#${id})` }}>
        Suplex
      </h1>
    </>
  )
}
