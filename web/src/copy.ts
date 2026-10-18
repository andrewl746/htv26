import type { Lang, RuleRow } from '@contracts/types'
import disclaimers from '@contracts/copy/disclaimers.json'
import labels from '@contracts/copy/labels.json'
import reasons from '@contracts/copy/reasons.json'

export { disclaimers, labels, reasons }

/**
 * The 3D scene and the ward map still read these three from here; the strings themselves live in
 * contracts/copy/labels.json now. Everything in /web outside those folders uses `labels.ui`.
 */
export const pending = {
  home_bedrooms: labels.ui.home_bedrooms,
  home_bedrooms_one: labels.ui.home_bedrooms_one,
  load_error: labels.ui.load_error,
}

/**
 * Strings contracts/copy does not have yet. Simone owns contracts/copy and has been asked to add
 * them to labels.json `ui`; delete each entry here once it lands there.
 */
export const missing = {
  /** The banner while the app runs on /contracts/fixtures (no VITE_API_BASE). */
  sample_data: 'Sample data: made-up addresses and lots for testing, not real Toronto results.',
  /** The banner on a lot where none of the four designs could be checked (condo, non-residential zone, older by-law, ...). */
  not_supported_title: "Multiplexes can't be checked here",
  not_supported_note: 'None of the four free City designs were checked on this lot, so there is no result to show.',
}

/** Fills the {{key}} placeholders used throughout contracts/copy. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

const number = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 })

export function formatNumber(value: number, wholeOnly = false): string {
  return (wholeOnly ? whole : number).format(value)
}

/** A rule row's value with its unit: "7.62 m", "45%", "4 homes"; words such as "detached" as they are. */
export function formatValue(value: number | string | null, unit: RuleRow['unit']): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  const n = formatNumber(value)
  if (unit === 'pct') return `${n}${labels.units.pct}`
  return unit ? `${n} ${labels.units[unit]}` : n
}

/** A signed margin: "+0.02 m", "−1.5 m", "0 m". */
export function formatMargin(margin: number, unit: RuleRow['unit']): string {
  const sign = margin > 0 ? '+' : margin < 0 ? '−' : ''
  return sign + formatValue(Math.abs(margin), unit)
}

// Decimal and grouping separators per language, as the AI service writes numbers into its text
// (ai/numbers.py format_number), so a number the web renders reads the same as the service's.
const SEPARATORS: Partial<Record<Lang, [decimal: string, group: string]>> = {
  fr: [',', ' '],
  es: [',', '.'],
  pt: [',', '.'],
}

export function formatForLang(value: number, lang: Lang): string {
  const [decimal, group] = SEPARATORS[lang] ?? ['.', ',']
  const plain = value.toFixed(6).replace(/\.?0+$/, '')
  const [whole, frac] = (plain === '-0' ? '0' : plain).split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const grouped = whole.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return sign + grouped + (frac ? decimal + frac : '')
}
