import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'

// Procedural textures for the drawn look (A15, A16), painted on canvases at start-up: nothing is
// downloaded, so the scene works offline. Faces carry UVs in metres (ExtrudeGeometry's world UVs),
// so each texture is told how many metres one tile covers.

export interface TexturePair {
  /** Colour, in sRGB. */
  map: CanvasTexture
  /** Height for bumpMap: white is proud, black is recessed. */
  bump: CanvasTexture
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return [c, c.getContext('2d')]
}

function finish(map: HTMLCanvasElement, bump: HTMLCanvasElement, tileM: [number, number]): TexturePair {
  const pair = { map: new CanvasTexture(map), bump: new CanvasTexture(bump) }
  pair.map.colorSpace = SRGBColorSpace
  for (const t of [pair.map, pair.bump]) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(1 / tileM[0], 1 / tileM[1])
    t.anisotropy = 4
  }
  return pair
}

/** A repeatable random sequence, so a texture paints the same every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Vertical boards: one board per tile, its groove at the left edge. */
export function boardTexture(colour: string, groove: string, boardM: number): TexturePair {
  const px = 64
  const [map, m] = canvas(px, px)
  const [bump, b] = canvas(px, px)
  const grooveShare = 0.08
  if (m && b) {
    m.fillStyle = colour
    m.fillRect(0, 0, px, px)
    m.fillStyle = groove
    m.fillRect(0, 0, Math.max(2, px * grooveShare), px)
    b.fillStyle = '#fff'
    b.fillRect(0, 0, px, px)
    b.fillStyle = '#000'
    b.fillRect(0, 0, Math.max(2, px * grooveShare), px)
  }
  return finish(map, bump, [boardM, 1])
}

/**
 * Running-bond brick: standard 215 x 65 mm units in 10 mm mortar. Each brick gets a little
 * lightness of its own so a wall does not read as a flat print.
 */
export function brickTexture(colour: string, mortar: string, seed = 1): TexturePair {
  const brick = { w: 0.225, h: 0.075 }
  const courses = 8
  const perCourse = 4
  const tile: [number, number] = [brick.w * perCourse, brick.h * courses]
  const scale = 512 / tile[0]
  const [W, H] = [Math.round(tile[0] * scale), Math.round(tile[1] * scale)]
  const [map, m] = canvas(W, H)
  const [bump, b] = canvas(W, H)
  const random = seeded(seed)
  const base = new Color(colour)
  const joint = 0.01 * scale
  if (m && b) {
    m.fillStyle = mortar
    m.fillRect(0, 0, W, H)
    b.fillStyle = '#000'
    b.fillRect(0, 0, W, H)
    for (let row = 0; row < courses; row++) {
      const y = row * brick.h * scale
      const offset = row % 2 ? (brick.w * scale) / 2 : 0
      for (let i = -1; i < perCourse; i++) {
        const x = offset + i * brick.w * scale
        const tint = base.clone().offsetHSL(0, (random() - 0.5) * 0.06, (random() - 0.5) * 0.08)
        m.fillStyle = `#${tint.getHexString()}`
        m.fillRect(x + joint / 2, y + joint / 2, brick.w * scale - joint, brick.h * scale - joint)
        b.fillStyle = '#fff'
        b.fillRect(x + joint / 2, y + joint / 2, brick.w * scale - joint, brick.h * scale - joint)
      }
    }
  }
  return finish(map, bump, tile)
}

/**
 * A neighbour's wall: brick or siding with a window per bay on every floor. One tile is one bay of
 * one floor; the window sits in the upper middle with a light sill and frame.
 */
export function facadeTexture(opts: {
  wall: string
  mortar: string | null
  glass: string
  frame: string
  bayM: number
  floorM: number
  seed: number
}): TexturePair {
  const { wall, mortar, glass, frame, bayM, floorM, seed } = opts
  const scale = 128 / bayM
  const [W, H] = [Math.round(bayM * scale), Math.round(floorM * scale)]
  const [map, m] = canvas(W, H)
  const [bump, b] = canvas(W, H)
  const random = seeded(seed)
  const base = new Color(wall)
  if (m && b) {
    m.fillStyle = wall
    m.fillRect(0, 0, W, H)
    b.fillStyle = '#fff'
    b.fillRect(0, 0, W, H)
    if (mortar) {
      // Brick coursing, coarse enough to read at street distance.
      const course = 0.075 * scale
      for (let y = 0; y < H; y += course) {
        m.fillStyle = mortar
        m.fillRect(0, y, W, Math.max(1, course * 0.14))
        for (let x = (Math.floor(y / course) % 2) * 0.11 * scale; x < W; x += 0.225 * scale) {
          const tint = base.clone().offsetHSL(0, 0, (random() - 0.5) * 0.07)
          m.fillStyle = `#${tint.getHexString()}`
          m.fillRect(x + 1, y + course * 0.14, 0.225 * scale - 2, course * 0.86)
        }
      }
    }
    // The window: 45% of the bay wide, 50% of the floor tall, its head 30% down from the floor above
    // (UV v runs up the wall, the canvas runs down it).
    const ww = W * 0.45
    const wh = H * 0.5
    const x = (W - ww) / 2
    const y = H * 0.2
    m.fillStyle = frame
    m.fillRect(x - 3, y - 3, ww + 6, wh + 8)
    m.fillStyle = glass
    m.fillRect(x, y, ww, wh)
    // A sky reflection across the upper pane, and the mullion.
    const sky = m.createLinearGradient(0, y, 0, y + wh)
    sky.addColorStop(0, 'rgba(210, 225, 240, 0.35)')
    sky.addColorStop(0.5, 'rgba(210, 225, 240, 0.05)')
    sky.addColorStop(1, 'rgba(0, 0, 0, 0)')
    m.fillStyle = sky
    m.fillRect(x, y, ww, wh)
    m.fillStyle = frame
    m.fillRect(x + ww / 2 - 1.5, y, 3, wh)
    // Recessed glass in the bump map.
    b.fillStyle = '#555'
    b.fillRect(x, y, ww, wh)
  }
  return finish(map, bump, [bayM, floorM])
}

/** Asphalt shingles in courses, for the pitched roofs. */
export function shingleTexture(colour: string, seed = 7): TexturePair {
  const courseM = 0.14
  const tabM = 0.33
  const courses = 6
  const tile: [number, number] = [tabM * 4, courseM * courses]
  const scale = 256 / tile[0]
  const [W, H] = [Math.round(tile[0] * scale), Math.round(tile[1] * scale)]
  const [map, m] = canvas(W, H)
  const [bump, b] = canvas(W, H)
  const random = seeded(seed)
  const base = new Color(colour)
  if (m && b) {
    for (let row = 0; row < courses; row++) {
      const y = row * courseM * scale
      const offset = row % 2 ? (tabM * scale) / 2 : 0
      for (let i = -1; i < 5; i++) {
        const tint = base.clone().offsetHSL(0, 0, (random() - 0.5) * 0.1)
        m.fillStyle = `#${tint.getHexString()}`
        m.fillRect(offset + i * tabM * scale, y, tabM * scale, courseM * scale)
        // Each course's lower edge casts a thin shadow line.
        b.fillStyle = '#fff'
        b.fillRect(offset + i * tabM * scale, y, tabM * scale, courseM * scale)
        b.fillStyle = '#000'
        b.fillRect(offset + i * tabM * scale, y + courseM * scale - 2, tabM * scale, 2)
        b.fillRect(offset + i * tabM * scale, y, 1.5, courseM * scale)
      }
    }
  }
  return finish(map, bump, tile)
}
