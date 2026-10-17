import type { LonLat } from '@contracts/types'

/**
 * The "Try:" chips on the landing page (MASTERSPEC 6.2). Fixture addresses until S9 picks the real
 * backup addresses (one that fits, one too close to call or not fitting) in /pitch/demo.md.
 * The position is where the map flies before the check comes back.
 */
export const EXAMPLES: { address_id: string; address_full: string; lonLat: LonLat }[] = [
  { address_id: 'fixture-2', address_full: '200 Fixture St', lonLat: [-79.475, 43.653] },
  { address_id: 'fixture-1', address_full: '100 Fixture St', lonLat: [-79.47, 43.65] },
]
