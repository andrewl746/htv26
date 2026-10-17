import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { tokenHex } from '../../styles/tokens'
import { NEIGHBOUR_TOKENS } from './buildings'

export interface StreetMaterials {
  walls: MeshStandardMaterial[]
  roof: MeshStandardMaterial
}

/** One material per neighbour colour token, plus the roof, shared by every building on the street. */
export function useStreetMaterials(): StreetMaterials {
  const materials = useMemo(
    () => ({
      walls: NEIGHBOUR_TOKENS.map((t) => new MeshStandardMaterial({ color: tokenHex(t), roughness: 0.85 })),
      roof: new MeshStandardMaterial({ color: tokenHex('--suplex-roof'), roughness: 0.9 }),
    }),
    [],
  )
  useEffect(() => () => [...materials.walls, materials.roof].forEach((m) => m.dispose()), [materials])
  return materials
}
