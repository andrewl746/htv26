import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial, type Material } from 'three'
import { tokenHex } from '../../styles/tokens'
import { NEIGHBOUR_TOKENS, type PartSlot } from './buildings'
import { withCutaway } from './cutaway'
import { HOUSE_STYLE } from './houseStyle'
import { LOOK } from './look'
import { brickTexture, shingleTexture, sidingTexture, type TexturePair } from './textures'

export interface StreetMaterials {
  walls: Material[]
  roof: Material
  flat: Material
  glass: Material
  trim: Material
  door: Material
}

/** The material for a building part: the walls of its colour, or the street-wide one for its slot. */
export function slotMaterial(materials: StreetMaterials, slot: PartSlot, colorIndex: number): Material {
  return slot === 'wall' ? materials.walls[colorIndex] : materials[slot]
}

// A15, the drawn look: Toronto houses in the chosen style (houseStyle.ts), one wall finish per
// colour index so a building keeps its look between visits; blue daytime windows in light trim,
// tinted shingle roofs, grey flat roofs.
const SHINGLE_BASE = '#d6d6d6'
const FLAT_ROOF = '#8b8d90'
const SIDING_BOARD_M = 0.18

/** Painted once and shared by every street of the session (the materials still come and go). */
let textures: { walls: TexturePair[]; shingles: TexturePair } | null = null

function drawnTextures(): { walls: TexturePair[]; shingles: TexturePair } {
  textures ??= {
    walls: HOUSE_STYLE.walls.map((w, i) =>
      w.kind === 'brick' ? brickTexture(w.colour, w.line, i + 3) : sidingTexture(w.colour, w.line, SIDING_BOARD_M),
    ),
    shingles: shingleTexture(SHINGLE_BASE),
  }
  return textures
}

/**
 * One material per neighbour colour, plus the roofs, glass, trim and doors, shared by every
 * building on the street. Neighbours sink out of the way where they hide the design; the house on
 * the lot itself does not.
 */
export function useStreetMaterials({ cutaway }: { cutaway: boolean }): StreetMaterials {
  const materials = useMemo((): StreetMaterials => {
    const cut = <T extends Material>(material: T) => (cutaway ? withCutaway(material) : material)
    if (LOOK === 'classic') {
      const roof = cut(new MeshStandardMaterial({ color: tokenHex('--suplex-roof'), roughness: 0.9 }))
      return {
        walls: NEIGHBOUR_TOKENS.map((t) => cut(new MeshStandardMaterial({ color: tokenHex(t), roughness: 0.85 }))),
        roof,
        flat: roof,
        glass: roof,
        trim: roof,
        door: roof,
      }
    }
    const painted = drawnTextures()
    return {
      walls: painted.walls.map((t) => cut(new MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.8, roughness: 0.88 }))),
      roof: cut(
        new MeshStandardMaterial({ map: painted.shingles.map, bumpMap: painted.shingles.bump, bumpScale: 1, vertexColors: true, roughness: 0.92 }),
      ),
      flat: cut(new MeshStandardMaterial({ color: FLAT_ROOF, roughness: 0.95 })),
      // Daytime glass: the sky's blue in it, a little shine from the environment.
      glass: cut(new MeshStandardMaterial({ color: HOUSE_STYLE.glass, roughness: 0.12, metalness: 0.25, envMapIntensity: 1.3 })),
      trim: cut(new MeshStandardMaterial({ color: HOUSE_STYLE.trim, roughness: 0.6 })),
      door: cut(new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })),
    }
  }, [cutaway])
  useEffect(
    () => () => new Set<Material>([...materials.walls, materials.roof, materials.flat, materials.glass, materials.trim, materials.door]).forEach((m) => m.dispose()),
    [materials],
  )
  return materials
}
