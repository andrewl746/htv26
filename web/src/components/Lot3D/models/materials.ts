import { Color, MeshStandardMaterial, type Material } from 'three'
import { tokenHex } from '../../../styles/tokens'
import { boardTexture, brickTexture } from '../textures'

// Materials for the drawn designs (A16). The cladding follows each sheet's material schedule:
// CP-1 is drawn with brick coursing, CP-3 as light vertical boards, CP-4 as the darker cladding,
// PFM is the pre-finished metal flashing. The plan sets give no colours, so these follow the
// sheets' tones: buff brick, light boards, charcoal panels, dark metal. Each home's windows glow
// faintly in that home's colour, the colour of the swatch on its label, so the homes still read
// one by one.
//
// One shared set for the whole session: the canvas textures and compiled programs are reused by
// every design and every lot.

export type MaterialKey =
  | 'CP-1'
  | 'CP-2'
  | 'CP-3'
  | 'CP-4'
  | 'PFM'
  | 'concrete'
  | 'frame'
  | 'door'
  | 'glass'
  | `glass-${number}`
  | 'metal'
  | 'galv'
  | 'roof'
  | 'deck'
  | 'slab'
  | 'mask'

const BRICK = { colour: '#c4a27c', mortar: '#d9d0c2' }
const BOARD = { colour: '#dcd8cf', groove: '#b4afa5', widthM: 0.15 }
const PANEL = { colour: '#4b4f55', joint: '#383b40', widthM: 0.6 }
/** The glow is a hint of each home's colour behind dark glass, not a painted panel. */
const GLASS = { colour: '#1b252e', glow: 0.13 }

let cache: Map<MaterialKey, Material> | null = null

function build(): Map<MaterialKey, Material> {
  const materials = new Map<MaterialKey, Material>()
  const brick = brickTexture(BRICK.colour, BRICK.mortar, 11)
  const brickMaterial = new MeshStandardMaterial({ map: brick.map, bumpMap: brick.bump, bumpScale: 1.2, roughness: 0.9 })
  materials.set('CP-1', brickMaterial)
  // No sheet uses CP-2; it reads as brick if one ever does.
  materials.set('CP-2', brickMaterial)
  const boards = boardTexture(BOARD.colour, BOARD.groove, BOARD.widthM)
  materials.set('CP-3', new MeshStandardMaterial({ map: boards.map, bumpMap: boards.bump, bumpScale: 0.8, roughness: 0.8 }))
  const panels = boardTexture(PANEL.colour, PANEL.joint, PANEL.widthM)
  materials.set('CP-4', new MeshStandardMaterial({ map: panels.map, bumpMap: panels.bump, bumpScale: 0.6, roughness: 0.65 }))
  materials.set('PFM', new MeshStandardMaterial({ color: '#3c3f44', roughness: 0.45, metalness: 0.6 }))
  materials.set('concrete', new MeshStandardMaterial({ color: '#bdb8ae', roughness: 0.95 }))
  materials.set('frame', new MeshStandardMaterial({ color: '#2a2c30', roughness: 0.5, metalness: 0.3 }))
  materials.set('door', new MeshStandardMaterial({ color: '#33363b', roughness: 0.6, metalness: 0.2 }))
  materials.set('metal', new MeshStandardMaterial({ color: '#25272b', roughness: 0.5, metalness: 0.5 }))
  materials.set('galv', new MeshStandardMaterial({ color: '#9ea2a5', roughness: 0.55, metalness: 0.75 }))
  materials.set('roof', new MeshStandardMaterial({ color: '#7d7f82', roughness: 0.9 }))
  materials.set('deck', new MeshStandardMaterial({ color: '#a08566', roughness: 0.85 }))
  materials.set('slab', new MeshStandardMaterial({ color: '#c9c4ba', roughness: 0.9 }))
  materials.set('glass', glass(null))
  // The depth-only lid over a walkout: hides the ground there so the pit shows (build.ts).
  materials.set('mask', new MeshStandardMaterial({ colorWrite: false }))
  return materials
}

function glass(home: number | null): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: GLASS.colour, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.6 })
  if (home !== null) {
    material.emissive = new Color(tokenHex(`--suplex-home-${home}`))
    material.emissiveIntensity = GLASS.glow
  }
  return material
}

export function facadeMaterial(key: MaterialKey): Material {
  cache ??= build()
  const hit = cache.get(key)
  if (hit) return hit
  const home = Number(key.replace('glass-', ''))
  const made = glass(Number.isFinite(home) ? home : null)
  cache.set(key, made)
  return made
}
