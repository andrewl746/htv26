import type { Design, DesignId, DesignsFile } from '@contracts/types'
import designsJson from '@contracts/designs.json'

// The JSON import infers plain strings and number[] where the contract has unions and tuples.
export const designsFile = designsJson as unknown as DesignsFile

export function designById(id: DesignId): Design {
  const design = designsFile.designs.find((d) => d.id === id)
  if (!design) throw new Error(`design ${id} is missing from contracts/designs.json`)
  return design
}
