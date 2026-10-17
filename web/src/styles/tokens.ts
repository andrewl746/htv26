// Reads colours from /contracts/design-tokens.css so the 3D scene and the CSS share one palette.
// three.js cannot read CSS variables, and it ignores the alpha of rgba(), so split it out here.

export interface TokenColor {
  color: string
  opacity: number
}

const cache = new Map<string, TokenColor>()

const RGBA = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/

export function token(name: string): TokenColor {
  const hit = cache.get(name)
  if (hit) return hit
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) throw new Error(`design token ${name} is missing from contracts/design-tokens.css`)
  const rgba = raw.match(RGBA)
  const parsed = rgba
    ? { color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, opacity: Number(rgba[4]) }
    : { color: raw, opacity: 1 }
  cache.set(name, parsed)
  return parsed
}

/** Just the colour string, for tokens that are always opaque. */
export function tokenHex(name: string): string {
  return token(name).color
}
