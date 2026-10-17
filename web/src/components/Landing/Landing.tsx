import { disclaimers, labels, pending } from '../../copy'
import { EXAMPLES } from '../../examples'
import { useApp } from '../../state/store'
import { Search } from '../Search/Search'

/** The first screen (MASTERSPEC 6.2): the search, the tagline, the disclaimer and two examples. */
export function Landing() {
  const openAddress = useApp((s) => s.openAddress)
  return (
    <section className="landing">
      <h1 className="landing-title">Suplex</h1>
      <p className="landing-tagline">{pending.tagline}</p>
      <Search variant="hero" />
      <div className="examples">
        <span>{labels.ui.try_examples}</span>
        {EXAMPLES.map((e) => (
          <button key={e.address_id} type="button" className="chip" onClick={() => openAddress(e.address_id)}>
            {e.address_full}
          </button>
        ))}
      </div>
      <p className="disclaimer">{disclaimers.screening}</p>
    </section>
  )
}
