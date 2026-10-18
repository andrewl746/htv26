import type { ExplainRequest, ExplainResponse, NumberEntry, RuleId } from '@contracts/types'
import engineConfig from '@contracts/engine_config.json'
import template from '@prompts/explain_template.json'
import numberCopy from '@prompts/numbers.json'
import { defaultDesign } from '../designs'
import { disclaimers, formatForLang, labels, reasons } from '../copy'

// The plain-template explanation the web writes itself when the AI service is unreachable
// (MASTERSPEC 6.4). A port of ai/templates.py explain_template over the same strings in
// /ai/prompts, so it reads exactly as the service's own fallback: English, the same sentences,
// each used only when every number it names is known.

/** rule_id -> the numbers-map keys for the row's required and actual values (ai/numbers.py RULE_KEYS). */
const RULE_KEYS: Partial<Record<RuleId, [required: string, actual: string]>> = {
  lot_width: ['lot_width_required', 'lot_width_actual'],
  lot_depth: ['lot_depth_required', 'lot_depth_actual'],
  building_length: ['building_length_allowed', 'building_length_design'],
  height: ['height_allowed', 'height_design'],
  lot_coverage: ['coverage_allowed_pct', 'coverage_actual_pct'],
  units_allowed: ['units_design', 'units_allowed'],
}

const PLACEHOLDER = /\{\{([a-z0-9_]+)\}\}/g
const numberLabels: Record<string, string> = numberCopy.labels

function numbersFor(request: ExplainRequest, designId: ExplainResponse['design_id']): Record<string, NumberEntry> {
  const design = request.check.designs.find((d) => d.design_id === designId)
  const name = labels.designs[designId]
  const numbers: Record<string, NumberEntry> = {}
  const add = (key: string, value: unknown, unit: string | null) => {
    if (typeof value !== 'number') return
    numbers[key] = { value, unit, label: (numberLabels[key] ?? key).replace('{design}', name), source_url: '' }
  }
  for (const row of design?.rules ?? []) {
    const keys = RULE_KEYS[row.rule_id]
    if (!keys || row.not_applicable) continue
    add(keys[0], row.required, row.unit)
    add(keys[1], row.actual, row.unit)
  }
  add('uncertainty_band_m', engineConfig.uncertainty_band_m, 'm')
  add('uncertainty_band_coverage_pp', engineConfig.uncertainty_band_coverage_pp, 'pp')
  return numbers
}

function ifKnown(sentence: string, numbers: Record<string, NumberEntry>): string | null {
  return [...sentence.matchAll(PLACEHOLDER)].every((m) => m[1] in numbers) ? sentence : null
}

export function explainFromTemplate(request: ExplainRequest): ExplainResponse {
  const { check } = request
  const designId = request.design_id ?? defaultDesign(check) ?? 'fourplex_narrow'
  const design = check.designs.find((d) => d.design_id === designId)
  const numbers = numbersFor(request, designId)
  const result = design?.result ?? 'not_checked'
  const rules = template.rule as Record<RuleId, string>
  const sentences: (string | null)[] = [template.opening[result].replace('{design}', labels.designs[designId])]

  if (result === 'fits') {
    sentences.push(ifKnown(rules.lot_width, numbers), template.screening, template.next_step)
  } else if (result === 'borderline') {
    const row = design?.rules.find((r) => r.borderline)
    if (row) {
      sentences.push(ifKnown(rules[row.rule_id], numbers))
      sentences.push(ifKnown(template.band[row.unit === 'pct' ? 'pct' : 'm'], numbers))
    }
    sentences.push(template.screening, template.next_step_borderline)
  } else if (result === 'no_fit') {
    if (design?.blocking_rule) sentences.push(ifKnown(rules[design.blocking_rule], numbers))
    sentences.push(template.screening, template.next_step)
  } else {
    const lot = check.lot
    sentences.push(lot.reason?.text ?? reasons.classes[lot.class].text)
    if (lot.class === 'attached' || lot.attached) sentences.push(reasons.attached_note)
    sentences.push(template.screening)
  }

  const templateText = sentences.filter(Boolean).join(' ')
  return {
    // The template stays English (MASTERSPEC 7.5), and says so when another language was asked for.
    lang: 'en',
    design_id: designId,
    template_text: templateText,
    text: renderNumbers(templateText, numbers, 'en'),
    numbers,
    validated: true,
    source: 'template',
    model: null,
    cached: false,
    translation_unavailable: request.lang !== 'en',
    disclaimer: disclaimers.screening,
  }
}

/** Fills each {{key}} with its number, written the way the AI service writes it for that language. */
export function renderNumbers(text: string, numbers: Record<string, NumberEntry>, lang: ExplainResponse['lang']): string {
  return text.replace(PLACEHOLDER, (match, key: string) =>
    key in numbers ? formatForLang(numbers[key].value, lang) : match,
  )
}
