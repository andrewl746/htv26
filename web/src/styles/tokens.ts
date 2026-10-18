// Reads colours from /contracts/design-tokens.css so the 3D scene and the CSS share one palette.
// three.js cannot read CSS variables, and it ignores the alpha of rgba(), so split it out here.
// The production CSS minifier rewrites rgba(47, 111, 237, 0.18) as #2f6fed2e, which three.js
// rejects, so the alpha comes out of every spelling: #rrggbbaa, #rgba, rgba(r, g, b, a) and the
// CSS Color 4 rgb(r g b / a), with the alpha as a number or a percentage.

export interface TokenColor {
  color: string
  opacity: number
}

const cache = new Map<string, TokenColor>()

const HEX_ALPHA = /^#([0-9a-f]{8}|[0-9a-f]{4})$/i
const RGB = /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/i

function parse(raw: string): TokenColor {
  const hex = raw.match(HEX_ALPHA)
  if (hex) {
    const digits = hex[1].length === 4 ? hex[1].replace(/./g, (d) => d + d) : hex[1]
    return { color: `#${digits.slice(0, 6)}`, opacity: parseInt(digits.slice(6), 16) / 255 }
  }
  const rgb = raw.match(RGB)
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1)
    return { color: `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`, opacity: alpha }
  }
  return { color: raw, opacity: 1 }
}

export function token(name: string): TokenColor {
  const hit = cache.get(name)
  if (hit) return hit
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) throw new Error(`design token ${name} is missing from contracts/design-tokens.css`)
  const parsed = parse(raw)
  cache.set(name, parsed)
  return parsed
}

/** Just the colour string, for tokens that are always opaque. */
export function tokenHex(name: string): string {
  return token(name).color
}
