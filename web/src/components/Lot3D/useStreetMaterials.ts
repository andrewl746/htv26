import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { tokenHex } from '../../styles/tokens'
import { NEIGHBOUR_TOKENS } from './buildings'
import { withCutaway } from './cutaway'

export interface StreetMaterials {
  walls: MeshStandardMaterial[]
  roof: MeshStandardMaterial
}

/**
 * One material per neighbour colour token, plus the roof, shared by every building on the street.
 * Neighbours are cut away where they hide the design; the house on the lot itself is not.
 */
export function useStreetMaterials({ cutaway }: { cutaway: boolean }): StreetMaterials {
  const materials = useMemo(() => {
    const make = (color: string, roughness: number) => {
      const material = new MeshStandardMaterial({ color, roughness })
      return cutaway ? withCutaway(material) : material
    }
    return {
      walls: NEIGHBOUR_TOKENS.map((t) => make(tokenHex(t), 0.85)),
      roof: make(tokenHex('--suplex-roof'), 0.9),
    }
  }, [cutaway])
  useEffect(() => () => [...materials.walls, materials.roof].forEach((m) => m.dispose()), [materials])
  return materials
}
