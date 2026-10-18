import { grassTexture, type TexturePair } from './textures'

/** The lawn's colour: a natural, slightly dry green, well away from the "may fit" green. */
export const LAWN_COLOUR = '#6f8e4b'

let lawn: TexturePair | null = null

/** Painted once per session; users clone it to set their own repeat. */
export function lawnTexture(): TexturePair {
  lawn ??= grassTexture(LAWN_COLOUR, 1)
  return lawn
}
