// The ward shading ramp, shared by the map (fill colours) and the legend (swatches).

/** Ward shading steps, lightest to darkest, as the opacity of the accent colour. */
export const RAMP_ALPHAS = [0.12, 0.24, 0.36, 0.48, 0.6] as const

export interface RampClass {
  /** First count in the step. */
  from: number
  /** Last count in the step. */
  to: number
  /** Opacity of the accent colour, from RAMP_ALPHAS. */
  alpha: number
}

/**
 * Splits 1..max (max being the busiest ward under the current filters) into up to five equal
 * steps. The break values come from the data; a ward with none gets no shading.
 */
export function rampClasses(counts: readonly number[]): RampClass[] {
  const max = counts.reduce((a, b) => Math.max(a, b), 0)
  if (max <= 0) return []
  const steps = RAMP_ALPHAS.length
  const uppers = [...new Set(Array.from({ length: steps }, (_, i) => Math.ceil((max * (i + 1)) / steps)))]
  return uppers.map((to, i) => ({
    from: i === 0 ? 1 : uppers[i - 1] + 1,
    to,
    alpha: RAMP_ALPHAS[steps - uppers.length + i],
  }))
}
