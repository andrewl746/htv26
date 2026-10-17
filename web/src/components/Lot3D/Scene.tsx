import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { NeutralToneMapping } from 'three'
import type { CheckResponse, DesignId } from '@contracts/types'
import { designById } from '../../designs'
import { tokenHex } from '../../styles/tokens'
import { Camera } from './Camera'
import { Design } from './Design'
import { Lighting } from './Lighting'
import { Lot } from './Lot'
import { Street } from './Street'
import { FLAT } from './geometry'

// The ground reaches well past the 150 m context so its edge is always lost in the fog.
const GROUND_SCALE = 4
const FOG_NEAR_M = 90
const FOG_FAR_M = 320

/** `?stats=1` in dev shows the frame rate, for the 60 fps check (J1). */
const SHOW_STATS = import.meta.env.DEV && new URLSearchParams(window.location.search).has('stats')

export function Scene({ check, designId }: { check: CheckResponse; designId: DesignId }) {
  const result = check.designs.find((d) => d.design_id === designId)
  const spec = designById(designId)
  const sky = tokenHex('--suplex-sky-bottom')

  return (
    <div className="scene" aria-hidden="true">
      <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true, toneMapping: NeutralToneMapping }}>
        <fog attach="fog" args={[sky, FOG_NEAR_M, FOG_FAR_M]} />
        <Camera frontBearingDeg={check.lot.front_bearing_deg} />
        <Lighting />

        <mesh rotation={FLAT} receiveShadow>
          <circleGeometry args={[check.context.radius_m * GROUND_SCALE, 96]} />
          <meshStandardMaterial color={tokenHex('--suplex-ground')} roughness={1} />
        </mesh>

        <Street buildings={check.context.buildings} />
        {result && <Lot polygon={check.lot.polygon_local} design={result} />}
        {result?.placement_local && <Design placement={result.placement_local} spec={spec} />}

        {SHOW_STATS && <Stats />}
      </Canvas>
    </div>
  )
}
