import { useMemo } from 'react'
import type { Design as DesignSpec, LocalPoint } from '@contracts/types'
import { tokenHex } from '../../styles/tokens'
import { FLAT, shapeFrom } from './geometry'

/** The design as one solid block on its placement, as tall as the design. Floors come in J3. */
export function Design({ placement, spec }: { placement: LocalPoint[]; spec: DesignSpec }) {
  const shape = useMemo(() => shapeFrom(placement), [placement])
  return (
    <mesh rotation={FLAT} castShadow receiveShadow>
      <extrudeGeometry args={[shape, { depth: spec.height_m, bevelEnabled: false }]} />
      <meshStandardMaterial color={tokenHex('--suplex-home-1')} roughness={0.7} />
    </mesh>
  )
}
