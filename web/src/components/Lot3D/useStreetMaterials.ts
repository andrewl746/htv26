import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial, type Material } from 'three'
import { tokenHex } from '../../styles/tokens'
import { NEIGHBOUR_TOKENS, type PartSlot } from './buildings'
import { withCutaway } from './cutaway'
import { LOOK } from './look'
import { facadeTexture, shingleTexture, type TexturePair } from './textures'

export interface StreetMaterials {
  walls: Material[]
  roof: Material
  flat: Material
}

/** The material for a building part: the walls of its colour, the pitched roof or the flat roof. */
export function slotMaterial(materials: StreetMaterials, slot: PartSlot, colorIndex: number): Material {
  return slot === 'wall' ? materials.walls[colorIndex] : slot === 'roof' ? materials.roof : materials.flat
}

// A15, the drawn look: Toronto's street walls, one per colour index so a building keeps its look
// between visits: red brick, buff brick, painted brick, siding and dark brick, each with a window
// on every floor of every bay. Neutral on purpose, so the green, grey and red of the results stand
// out against them. A bay is 2.6 m and a floor 3 m.
const FACADES = [
  { wall: '#9a5b47', mortar: '#cbbfae', frame: '#ece7de' },
  { wall: '#c8ab86', mortar: '#e2d9ca', frame: '#3b3d40' },
  { wall: '#e4dfd6', mortar: '#d2ccc2', frame: '#34373b' },
  { wall: '#9ba5aa', mortar: null, frame: '#f1efe9' },
  { wall: '#72503f', mortar: '#bbae9d', frame: '#e8e2d8' },
]
const BAY_M = 2.6
const FLOOR_M = 3
const GLASS = '#2c3640'
const SHINGLE_BASE = '#d6d6d6'
const FLAT_ROOF = '#8b8d90'

/** Painted once and shared by every street of the session (the materials still come and go). */
let textures: { walls: TexturePair[]; shingles: TexturePair } | null = null

function drawnTextures(): { walls: TexturePair[]; shingles: TexturePair } {
  textures ??= {
    walls: FACADES.map((f, i) => {
      const t = facadeTexture({ wall: f.wall, mortar: f.mortar, glass: GLASS, frame: f.frame, bayM: BAY_M, floorM: FLOOR_M, seed: i + 3 })
      // The walls' v runs 1 - height: start each floor at the ground.
      for (const texture of [t.map, t.bump]) texture.offset.y = -1 / FLOOR_M
      return t
    }),
    shingles: shingleTexture(SHINGLE_BASE),
  }
  return textures
}

/**
 * One material per neighbour colour, plus the roofs, shared by every building on the street.
 * Neighbours sink out of the way where they hide the design; the house on the lot itself does not.
 */
export function useStreetMaterials({ cutaway }: { cutaway: boolean }): StreetMaterials {
  const materials = useMemo(() => {
    const cut = <T extends Material>(material: T) => (cutaway ? withCutaway(material) : material)
    if (LOOK === 'classic') {
      const roof = cut(new MeshStandardMaterial({ color: tokenHex('--suplex-roof'), roughness: 0.9 }))
      return {
        walls: NEIGHBOUR_TOKENS.map((t) => cut(new MeshStandardMaterial({ color: tokenHex(t), roughness: 0.85 }))),
        roof,
        flat: roof,
      }
    }
    const painted = drawnTextures()
    const walls = painted.walls.map((t) =>
      cut(new MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.8, roughness: 0.85 })),
    )
    const shingles = painted.shingles
    const roof = cut(
      new MeshStandardMaterial({ map: shingles.map, bumpMap: shingles.bump, bumpScale: 1, vertexColors: true, roughness: 0.92 }),
    )
    const flat = cut(new MeshStandardMaterial({ color: FLAT_ROOF, roughness: 0.95 }))
    return { walls, roof, flat }
  }, [cutaway])
  useEffect(() => () => new Set<Material>([...materials.walls, materials.roof, materials.flat]).forEach((m) => m.dispose()), [materials])
  return materials
}
