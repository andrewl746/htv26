import { useEffect, useState, type ReactNode } from 'react'
import type { CheckResponse, DesignId, ExplainResponse, Lang } from '@contracts/types'
import { explain } from '../../api/client'
import { isAbort } from '../../api/errors'
import { renderNumbers } from '../../api/explainTemplate'
import { formatForLang, labels } from '../../copy'
import { useApp } from '../../state/store'

// The plain-language explanation (MASTERSPEC 6.4): POST /explain for the selected design, loaded
// after the result is on screen, behind a skeleton. The AI only phrases the engine's numbers: it
// writes {{placeholders}} and the service fills them, so here each number carries its label.

const LANGS = Object.keys(labels.languages) as Lang[]

/** Answers for this session, so switching tabs back and forth never asks twice. */
const answers = new Map<string, ExplainResponse>()

function useExplanation(check: CheckResponse, designId: DesignId, lang: Lang): ExplainResponse | null {
  const key = [check.lot.lot_id, check.address.address_id, designId, lang].join('|')
  const [answer, setAnswer] = useState<{ key: string; response: ExplainResponse } | null>(null)

  useEffect(() => {
    if (answers.has(key)) return
    const request = new AbortController()
    explain({ check, design_id: designId, lang }, request.signal).then(
      (response) => {
        answers.set(key, response)
        setAnswer({ key, response })
      },
      (error: unknown) => {
        if (!isAbort(error)) throw error
      },
    )
    return () => request.abort()
  }, [key, check, designId, lang])

  return answers.get(key) ?? (answer?.key === key ? answer.response : null)
}

/** The text with each number marked, its label on hover; plain text if the two ever disagree. */
function Text({ response }: { response: ExplainResponse }) {
  const parts = response.template_text.split(/(\{\{[a-z0-9_]+\}\})/g)
  const nodes: ReactNode[] = parts.map((part, i) => {
    const key = part.match(/^\{\{([a-z0-9_]+)\}\}$/)?.[1]
    const entry = key ? response.numbers[key] : undefined
    if (!entry) return part
    return (
      <span key={i} className="explain-number" title={entry.label}>
        {formatForLang(entry.value, response.lang)}
      </span>
    )
  })
  const same = renderNumbers(response.template_text, response.numbers, response.lang) === response.text
  return <p className="explain-text">{same ? nodes : response.text}</p>
}

export function Explanation({ check, designId }: { check: CheckResponse; designId: DesignId }) {
  const lang = useApp((s) => s.lang)
  const setLang = useApp((s) => s.setLang)
  const response = useExplanation(check, designId, lang)

  return (
    <section className="panel-section explanation" aria-busy={response === null}>
      <div className="explain-head">
        {response ? (
          <span className={`badge badge-${response.source}`}>
            {response.source === 'gemini' ? labels.ui.source_gemini : labels.ui.source_template}
          </span>
        ) : (
          <span className="panel-muted">{labels.ui.explanation_loading}</span>
        )}
        <label className="lang-picker">
          <span className="visually-hidden">{labels.ui.translate}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {labels.languages[l].native}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div aria-live="polite">
        {response ? (
          <>
            <Text response={response} />
            {response.translation_unavailable && <p className="panel-muted">{labels.ui.translation_unavailable}</p>}
            <p className="disclaimer">{response.disclaimer}</p>
          </>
        ) : (
          <div className="explain-skeleton">
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text skeleton-text-short" />
          </div>
        )}
      </div>
    </section>
  )
}
