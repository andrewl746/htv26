import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { NeutralToneMapping } from 'three'
import type { CheckResponse, DesignId } from '@contracts/types'
import { designById } from '../../designs'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { tokenHex } from '../../styles/tokens'
import { buildingTop } from './buildings'
import { Camera } from './Camera'
import { Design } from './Design'
import { FLAT } from './geometry'
import { LabelProjector } from './LabelProjector'
import { homeLabels, oldHouseLabels } from './labels'
import { Lighting } from './Lighting'
import { Lot } from './Lot'
import { OldHouse } from './OldHouse'
import { Pin } from './Pin'
import { SceneLabels } from './SceneLabels'
import { Sequence } from './Sequence'
import { Street } from './Street'
import { buildTimeline } from './timeline'
import { Trees } from './Trees'

// The ground reaches well past the 150 m context so its edge is always lost in the fog.
const GROUND_SCALE = 4
const FOG_NEAR_M = 90
const FOG_FAR_M = 320

/** `?stats=1` in dev shows the frame rate, for the 60 fps check (J1). */
const SHOW_STATS = import.meta.env.DEV && new URLSearchParams(window.location.search).has('stats')

/** The street builds itself around the lot and the selected design rises on it (MASTERSPEC 6.3). */
export function Scene({
  check,
  designId,
  rightInsetPx,
}: {
  check: CheckResponse
  designId: DesignId | null
  rightInsetPx: number
}) {
  const reduced = useReducedMotion()
  const { lot, context } = check
  const result = check.designs.find((d) => d.design_id === designId) ?? null
  const placement = result?.placement_local ?? null
  const spec = result && placement ? designById(result.design_id) : null
  const timeline = useMemo(
    () => buildTimeline(spec?.levels.length ?? 0, spec?.homes.length ?? 0, reduced),
    [spec, reduced],
  )
  const pinHeight = Math.max(0, ...context.buildings.filter((b) => b.on_lot).map(buildingTop))
  const lotKey = lot.lot_id

  const labels = useMemo(
    () => [
      ...oldHouseLabels({
        buildings: context.buildings,
        vacant: lot.vacant,
        frontage: lot.frontage_edge_local,
        squash: placement !== null,
      }),
      ...(placement && spec ? homeLabels(placement, spec) : []),
    ],
    [context.buildings, lot.vacant, lot.frontage_edge_local, placement, spec],
  )
  const labelElements = useRef<(HTMLDivElement | null)[]>([])

  return (
    <div className="scene" aria-hidden="true">
      <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true, toneMapping: NeutralToneMapping }}>
        <Sequence lotKey={lotKey} designKey={designId ?? ''} timeline={timeline} reduced={reduced}>
          <fog attach="fog" args={[tokenHex('--suplex-sky-bottom'), FOG_NEAR_M, FOG_FAR_M]} />
          <Camera frontBearingDeg={lot.front_bearing_deg} rightInsetPx={rightInsetPx} />
          <Lighting />

          <mesh rotation={FLAT} receiveShadow>
            <circleGeometry args={[context.radius_m * GROUND_SCALE, 96]} />
            <meshStandardMaterial color={tokenHex('--suplex-ground')} roughness={1} />
          </mesh>

          <Street key={`street-${lotKey}`} buildings={context.buildings} />
          <Trees key={`trees-${lotKey}`} trees={context.trees} />
          <Lot key={`lot-${lotKey}`} polygon={lot.polygon_local} design={result} />
          <OldHouse key={`old-${lotKey}`} buildings={context.buildings} squash={placement !== null} />
          <Pin restHeight={pinHeight} leaves={placement !== null} />
          {placement && spec && <Design key={`design-${lotKey}-${spec.id}`} placement={placement} spec={spec} />}
          <LabelProjector labels={labels} elements={labelElements} />
        </Sequence>
        {SHOW_STATS && <Stats />}
      </Canvas>
      <SceneLabels labels={labels} elements={labelElements} />
    </div>
  )
}
