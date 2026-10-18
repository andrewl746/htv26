import { disclaimers, labels } from '../../copy'
import { EXAMPLES } from '../../examples'
import { useApp } from '../../state/store'
import { Search } from '../Search/Search'
import { Blueprint } from './Blueprint'
import { HandTitle } from './HandTitle'

/** The tagline in two lines, broken at the space nearest its middle: a wrapped paragraph keeps its
 *  full width, and two set lines let the box hug the longer one, so the pair beside the title
 *  centres and the right edge sits flush. */
function twoLines(text: string): [string, string] {
  let at = -1
  for (let i = text.indexOf(' '); i !== -1; i = text.indexOf(' ', i + 1)) {
    if (at === -1 || Math.abs(i - text.length / 2) < Math.abs(at - text.length / 2)) at = i
  }
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)]
}

const tagline = twoLines(labels.ui.tagline)

/**
 * The first screen (MASTERSPEC 6.2): the search, the tagline, the disclaimer and two examples,
 * floating over the base map's view of Toronto. It fades away while the map flies to the address.
 */
export function Landing({ leaving }: { leaving: boolean }) {
  const openAddress = useApp((s) => s.openAddress)
  return (
    <section className={leaving ? 'landing landing-leaving' : 'landing'} aria-hidden={leaving || undefined}>
      <div className="landing-card">
        <Blueprint />
        <div className="landing-head">
          <HandTitle />
          <p className="landing-tagline">
            {tagline[0]}
            <br />
            {tagline[1]}
          </p>
        </div>
        <Search variant="hero" />
        <div className="examples">
          <span>{labels.ui.try_examples}</span>
          {EXAMPLES.map((e) => (
            <button
              key={e.address_id}
              type="button"
              className="chip"
              onClick={() => openAddress(e.address_id, { fly: true })}
            >
              {e.address_full}
            </button>
          ))}
        </div>
        <p className="disclaimer">{disclaimers.screening}</p>
      </div>
    </section>
  )
}
