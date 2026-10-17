import disclaimers from '@contracts/copy/disclaimers.json'
import labels from '@contracts/copy/labels.json'

export { disclaimers, labels }

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
