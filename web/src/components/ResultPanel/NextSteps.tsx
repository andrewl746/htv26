import type { NextStep, NextStepGroup } from '@contracts/types'
import nextStepsCopy from '@contracts/copy/next_steps.json'
import { disclaimers } from '../../copy'
import './nextSteps.css'

/**
 * "Your next steps" (MASTERSPEC 5.10, task Y14): the engine's `CheckResponse.next_steps`, shown in
 * the four groups of contracts/copy/next_steps.json. The list arrives already ordered and the app
 * never reorders or rewrites it. Mount it after the explanation:
 *   <NextSteps steps={check.next_steps} />
 */

/** The shape of contracts/copy/next_steps.json that this component reads. */
export interface NextStepsCopy {
  checked_on: string
  groups: Record<NextStepGroup, string>
  footer: string
  heading?: string // suggested addition to the copy file; falls back to FALLBACK_HEADING
  intro?: string // one line under the heading ("Suplex checks zoning only ..."); omitted when absent
  who_label?: string // optional, e.g. "Who to contact"
  new_tab?: string // optional, spoken after each link, e.g. "opens in a new tab"
}

// Used only until next_steps.json carries `heading`. Delete with the fallback in the component.
const FALLBACK_HEADING = 'Your next steps'

const GROUP_ORDER: NextStepGroup[] = ['confirm', 'approvals', 'apply', 'alternatives']

export interface NextStepsProps {
  steps: NextStep[]
  /** Defaults to contracts/copy/next_steps.json; pass another to test or translate. */
  copy?: NextStepsCopy
}

export function NextSteps({ steps, copy = nextStepsCopy as NextStepsCopy }: NextStepsProps) {
  if (steps.length === 0) return null

  // Group in the fixed order; inside a group keep the engine's order. Empty groups are omitted.
  const groups = GROUP_ORDER.map((group) => ({ group, items: steps.filter((s) => s.group === group) })).filter(
    (g) => g.items.length > 0,
  )
  const footer = copy.footer.replace(/\{checked_on\}/g, copy.checked_on)
  const heading = copy.heading ?? FALLBACK_HEADING

  return (
    <section className="next-steps" aria-labelledby="next-steps-heading">
      <h3 className="next-steps-heading" id="next-steps-heading">
        {heading}
      </h3>
      {copy.intro && <p className="next-steps-intro">{copy.intro}</p>}
      {groups.map(({ group, items }) => (
        <div className="next-steps-group" key={group} data-group={group}>
          <h4 className="next-steps-group-title">{copy.groups[group]}</h4>
          <ol className="next-steps-list">
            {items.map((step) => (
              // Closed to its title, so the list reads at a glance; the rest opens on a click.
              <li className="next-step" key={step.id} data-step={step.id}>
                <details>
                  <summary className="next-step-summary">
                    <span className="next-step-title">{step.title}</span>
                    <span className="next-step-chevron" aria-hidden="true" />
                  </summary>
                  <div className="next-step-body">
                    <p className="next-step-text">{step.text}</p>
                    <p className="next-step-who">
                      {copy.who_label && <span className="next-step-who-label">{copy.who_label}: </span>}
                      {step.who}
                    </p>
                    {step.links.length > 0 && (
                      <ul className="next-step-links">
                        {step.links.map((link) => (
                          <li key={link.url}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.label}
                              <span aria-hidden="true"> ↗</span>
                              {copy.new_tab && <span className="next-step-sr"> ({copy.new_tab})</span>}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="next-step-why">{step.why}</p>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="next-steps-footer disclaimer">{footer}</p>
      {!footer.includes(disclaimers.screening) && <p className="next-steps-footer disclaimer">{disclaimers.screening}</p>}
    </section>
  )
}
