import { disclaimers, labels } from '../../copy'
import { EXAMPLES } from '../../examples'
import { useApp } from '../../state/store'
import { Search } from '../Search/Search'

/**
 * The first screen (MASTERSPEC 6.2): the search, the tagline, the disclaimer and two examples,
 * floating over the base map's view of Toronto. It fades away while the map flies to the address.
 */
export function Landing({ leaving }: { leaving: boolean }) {
  const openAddress = useApp((s) => s.openAddress)
  return (
    <section className={leaving ? 'landing landing-leaving' : 'landing'} aria-hidden={leaving || undefined}>
      <div className="landing-card">
        <h1 className="landing-title">Suplex</h1>
        <p className="landing-tagline">{labels.ui.tagline}</p>
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
