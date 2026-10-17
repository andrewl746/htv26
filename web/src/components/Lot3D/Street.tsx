import { useMemo } from 'react'
import type { ContextBuilding } from '@contracts/types'
import { tokenHex } from '../../styles/tokens'
import { FLAT, seededIndex, shapeFrom } from './geometry'

const NEIGHBOUR_TOKENS = [1, 2, 3, 4, 5].map((i) => `--suplex-neighbour-${i}`)

function Neighbour({ building }: { building: ContextBuilding }) {
  const shape = useMemo(() => shapeFrom(building.footprint_local), [building.footprint_local])
  const color = tokenHex(NEIGHBOUR_TOKENS[seededIndex(building.building_id, NEIGHBOUR_TOKENS.length)])
  return (
    <mesh rotation={FLAT} castShadow receiveShadow>
      <extrudeGeometry args={[shape, { depth: building.avg_height_m, bevelEnabled: false }]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

/** The neighbouring buildings as extruded footprints. The on-lot building belongs to the lot sequence. */
export function Street({ buildings }: { buildings: ContextBuilding[] }) {
  return (
    <group>
      {buildings
        .filter((b) => !b.on_lot)
        .map((b) => (
          <Neighbour key={b.building_id} building={b} />
        ))}
    </group>
  )
}
