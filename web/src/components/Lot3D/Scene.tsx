import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { NeutralToneMapping } from 'three'
import type { CheckResponse, DesignId } from '@contracts/types'
import engineConfig from '@contracts/engine_config.json'
import { designById } from '../../designs'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { tokenHex } from '../../styles/tokens'
import { buildingTop } from './buildings'
import { Camera } from './Camera'
import { CutawayFocus } from './CutawayFocus'
import { Design } from './Design'
import { FLAT, openRing, toScene, vertexMean } from './geometry'
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
import { lotFraming, type Framing } from './framing'
import { HANDOFF_S, restDistance, restViewBearingDeg } from './view'
import { WarmUp } from './WarmUp'

// The ground reaches well past the 150 m context so its edge is always lost in the fog.
const GROUND_SCALE = 4
/** Before any lot: where the hidden camera waits. */
const DEFAULT_FRAMING: Framing = { distanceM: restDistance(0, 0), viewBearingDeg: restViewBearingDeg(null) }
const FOG_NEAR_M = 90
const FOG_FAR_M = 320

/** `?stats=1` in dev shows the frame rate, for the 60 fps check (J1). */
const SHOW_STATS = import.meta.env.DEV && new URLSearchParams(window.location.search).has('stats')

/**
 * The street builds itself around the lot and the selected design rises on it (MASTERSPEC 6.3).
 *
 * The canvas lives for the whole session: created while the landing page loads, its shaders
 * compiled by WarmUp, drawing nothing until shown. A lot's street is built as soon as `check` is
 * passed, which is when the check comes back and just before the map's flight starts, so that work
 * never lands mid-flight; the scene then fades in over the flight's last stretch.
 */
export function Scene({
  check,
  designId,
  visible,
  rightInsetPx,
}: {
  check: CheckResponse | null
  designId: DesignId | null
  visible: boolean
  rightInsetPx: number
}) {
  const reduced = useReducedMotion()
  const result = check?.designs.find((d) => d.design_id === designId) ?? null
  const placement = result?.placement_local ?? null
  const spec = result && placement ? designById(result.design_id) : null
  const timeline = useMemo(
    () => buildTimeline(spec?.levels.length ?? 0, spec?.homes.length ?? 0, reduced),
    [spec, reduced],
  )

  const labels = useMemo(
    () =>
      check
        ? [
            ...oldHouseLabels({
              buildings: check.context.buildings,
              vacant: check.lot.vacant,
              frontage: check.lot.frontage_edge_local,
              squash: placement !== null,
            }),
            ...(placement && spec ? homeLabels(placement, spec) : []),
          ]
        : [],
    [check, placement, spec],
  )
  const labelElements = useRef<(HTMLDivElement | null)[]>([])

  const lotKey = check?.lot.lot_id ?? ''
  const groundRadius = check?.context.radius_m ?? engineConfig.context_radius_m
  const pinHeight = check ? Math.max(0, ...check.context.buildings.filter((b) => b.on_lot).map(buildingTop)) : 0
  // The same rest view the base map's flight ended on.
  const framing = check ? lotFraming(check, designId) : DEFAULT_FRAMING

  // What the camera must always see past the street: the design's corners at the ground and at its
  // top, and its middle; or the lot's, up to the tallest building on it, if no design is placed.
  const targets = useMemo(() => {
    if (!check) return []
    const [ring, top] =
      placement && spec ? [openRing(placement), spec.height_m] : [openRing(check.lot.polygon_local), pinHeight]
    return [...ring.flatMap((p) => [toScene(p, 0), toScene(p, top)]), toScene(vertexMean(ring), top / 2)]
  }, [check, placement, spec, pinHeight])

  return (
    <div
      className={visible ? 'scene scene-visible' : 'scene'}
      // The fade lasts the handoff: fully drawn as the map lands. Hiding stays instant.
      style={visible ? { transitionDuration: `${HANDOFF_S}s` } : undefined}
      aria-hidden="true"
    >
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: NeutralToneMapping }}
      >
        <Sequence lotKey={lotKey} designKey={designId ?? ''} timeline={timeline} reduced={reduced}>
          <fog attach="fog" args={[tokenHex('--suplex-sky-bottom'), FOG_NEAR_M, FOG_FAR_M]} />
          <Camera
            lotKey={lotKey}
            distanceM={framing.distanceM}
            viewBearingDeg={framing.viewBearingDeg}
            rightInsetPx={rightInsetPx}
          />
          <CutawayFocus targets={targets} />
          <Lighting />

          <mesh rotation={FLAT} receiveShadow>
            <circleGeometry args={[groundRadius * GROUND_SCALE, 96]} />
            <meshStandardMaterial color={tokenHex('--suplex-ground')} roughness={1} />
          </mesh>

          <WarmUp />

          {check && (
            <>
              <Street key={`street-${lotKey}`} buildings={check.context.buildings} />
              <Trees key={`trees-${lotKey}`} trees={check.context.trees} />
              <Lot key={`lot-${lotKey}`} polygon={check.lot.polygon_local} design={result} />
              <OldHouse key={`old-${lotKey}`} buildings={check.context.buildings} squash={placement !== null} />
              <Pin restHeight={pinHeight} leaves={placement !== null} />
              {placement && spec && <Design key={`design-${lotKey}-${spec.id}`} placement={placement} spec={spec} />}
            </>
          )}
          <LabelProjector labels={labels} elements={labelElements} />
        </Sequence>
        {SHOW_STATS && <Stats />}
      </Canvas>
      <SceneLabels labels={labels} elements={labelElements} />
    </div>
  )
}
