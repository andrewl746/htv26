import type { Lang, RuleRow } from '@contracts/types'
import disclaimers from '@contracts/copy/disclaimers.json'
import labels from '@contracts/copy/labels.json'
import reasons from '@contracts/copy/reasons.json'

export { disclaimers, labels, reasons }

/**
 * Strings the web app needs that contracts/copy does not have yet. Simone owns contracts/copy and
 * has been asked to add them; delete each entry here once it lands there.
 */
export const pending = {
  tagline: 'Before you build, before you vote.',
  home_bedrooms: '{{bedrooms}} bedrooms',
  home_bedrooms_one: '{{bedrooms}} bedroom',
  load_error: "This couldn't load. Please try again in a moment.",
  m2: 'm²',
  /** The label on the red slice in the 3D view (MASTERSPEC 6.3), for a rule the lot itself fails. */
  fail_lot: '{{rule}}: needs {{required}}, this lot has {{actual}}',
  /** The same, for a rule where the design is bigger than the lot allows. */
  fail_design: '{{rule}}: {{allowed}} allowed here, the design needs {{design}}',
  ward_unavailable: "The ward numbers aren't ready yet. Please try again in a moment.",
  data_dates: 'Data as of {{date}}',
  not_checked_line: '{{count}} lots not checked: {{reasons}}',
  trend_tooltip_one: '{{month}}: 1 multiplex permit',
  trend_tooltip_other: '{{month}}: {{count}} multiplex permits',
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
