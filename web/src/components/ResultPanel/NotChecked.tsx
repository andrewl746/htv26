import { labels } from '../../copy'

/** What Suplex doesn't check (MASTERSPEC 6.4, 5.6), collapsed until asked for. The engine sends the list. */
export function NotChecked({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <details className="panel-section not-checked">
      <summary>{labels.ui.what_we_dont_check}</summary>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  )
}
