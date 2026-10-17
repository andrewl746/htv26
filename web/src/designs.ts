import type { CheckResponse, Design, DesignId, DesignResult, DesignsFile, Result } from '@contracts/types'
import designsJson from '@contracts/designs.json'

// The JSON import infers plain strings and number[] where the contract has unions and tuples.
export const designsFile = designsJson as unknown as DesignsFile

const ORDER = designsFile.designs.map((d) => d.id)

export function designById(id: DesignId): Design {
  const design = designsFile.designs.find((d) => d.id === id)
  if (!design) throw new Error(`design ${id} is missing from contracts/designs.json`)
  return design
}

/** Fourplex Narrow, Fourplex Wide, Sixplex Narrow, Sixplex Wide: the order of designs.json. */
export function inDesignOrder(results: DesignResult[]): DesignResult[] {
  return [...results].sort((a, b) => ORDER.indexOf(a.design_id) - ORDER.indexOf(b.design_id))
}

const RANK: Record<Result, number> = { fits: 0, borderline: 1, no_fit: 2, not_checked: 3 }

/** The tab that opens first: the best result, ties going to the design order (MASTERSPEC 6.4). */
export function defaultDesign(check: CheckResponse): DesignId | null {
  const best = inDesignOrder(check.designs).sort((a, b) => RANK[a.result] - RANK[b.result])[0]
  return best?.design_id ?? null
}
