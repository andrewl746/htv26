import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Stats } from '@react-three/drei'
import { ACESFilmicToneMapping, Color, NeutralToneMapping } from 'three'
import type { CheckResponse, DesignId } from '@contracts/types'
import engineConfig from '@contracts/engine_config.json'
import { designById } from '../../designs'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { tokenHex } from '../../styles/tokens'
import { buildingTop } from './buildings'
import { Camera, type FixedPose } from './Camera'
import { CutawayFocus } from './CutawayFocus'
import { DebugBridge, ELEVATION_VIEW, OFF, STRESS_BUILDINGS, stressed } from './debug'
import { Effects } from './Effects'
import { ClassicDesign } from './ClassicDesign'
import { DrawnDesign } from './DrawnDesign'
import { failSlab } from './failSlabs'
import { FailSlices } from './FailSlices'
import { Frontage } from './Frontage'
import { planCity, type City } from './cityPlan'
import { Garden } from './Garden'
import { Yards, YardWarmUp } from './Yards'
import { Ground } from './Ground'
import { openRing, toScene, vertexMean } from './geometry'
import { LabelProjector } from './LabelProjector'
import { failLabel, homeLabels, oldHouseLabels } from './labels'
import { Lighting } from './Lighting'
import { LOOK } from './look'
import { Lot } from './Lot'
import { FACADES } from './models'
import { OldHouse } from './OldHouse'
import { Pin } from './Pin'
import { QualityMonitor } from './QualityMonitor'
import { SceneLabels } from './SceneLabels'
import { SettleWatch, ShadowFreeze } from './Settle'
import { Sky, type SkyLook } from './Sky'
import { Sequence } from './Sequence'
import { Roads } from './Roads'
import { Street } from './Street'
import { streetFrame } from './streetFrame'
import { sunPosition } from './sun'
import { Studio } from './Studio'
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
/** The drawn look sees further down the street, which it continues past the data (streetExtension.ts). */
const DRAWN_FOG = { near: 150, far: 540 }
/**
 * The drawn look's sunny sky (Sky.tsx), in linear light. ACES turns pale blues grey, so these run
 * past 1 to show, after the tone mapping and the grade, as a light haze at the horizon (#d6e0e9;
 * also the fog, so the far ground fades into it), clear blue a few degrees up (#96c0ec) and deeper
 * blue overhead (#689ee2); the sun, where the shadow light comes from, adds a warm white glow (more
 * yellow than orange: added to a strong blue, orange light shows lilac after the tone mapping).
 */
const SKY: SkyLook = {
  horizon: new Color().setRGB(0.489, 0.798, 1.551),
  blue: new Color().setRGB(0.096, 0.426, 1.903),
  zenith: new Color().setRGB(0.064, 0.267, 1.137),
  sun: { direction: sunPosition(), disc: new Color().setRGB(1, 0.92, 0.78), glow: new Color().setRGB(1.1, 1, 0.45) },
}
/** Dev elevation view: how far in front of the design the camera stands. */
const ELEVATION_DISTANCE_M = 70
/**
 * A15: under this frame rate the drawn look steps down, for good: on a high-DPI screen first to
 * one pixel per CSS pixel, then without ambient occlusion and shadows. Nothing is unmounted or
 * switched in a way that changes the shaders, so a step down never stalls on recompiling them.
 */
const MIN_FPS = 45
type Quality = 'high' | 'fewer-pixels' | 'low'
function stepDown(quality: Quality): Quality {
  return quality === 'high' && window.devicePixelRatio > 1 ? 'fewer-pixels' : 'low'
}
/** Contact shadows: just above every flat layer on the ground, over the lot and its neighbours. */
const CONTACT = { y: 0.09, scaleM: 90, farM: 12, blur: 2.2, opacity: 0.45, resolution: 1024 }
/** The drawn look renders at most this many pixels per CSS pixel: the ambient occlusion is per pixel. */
const DRAWN_MAX_DPR = 1.25

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
  check: given,
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
  // Dev only: ?stress=400 swaps in a dense synthetic street (debug.ts).
  const check = useMemo(() => (given && STRESS_BUILDINGS > 0 ? stressed(given, STRESS_BUILDINGS) : given), [given])
  // Lowered for good each time the frame rate stays under MIN_FPS (the drawn look only).
  const [quality, setQuality] = useState<Quality>('high')
  const drawn = LOOK === 'drawn'
  const rich = drawn && quality !== 'low'
  // Dev only (debug.ts): step down by hand.
  const stepQuality = useCallback(() => setQuality(stepDown), [])
  // Once the sequence rests, the drawn look stops redrawing its shadows every frame.
  const [settled, setSettled] = useState(false)
  const result = check?.designs.find((d) => d.design_id === designId) ?? null
  const placement = result?.placement_local ?? null
  const spec = result && placement ? designById(result.design_id) : null
  const timeline = useMemo(
    () => buildTimeline(spec?.levels.length ?? 0, spec?.homes.length ?? 0, reduced),
    [spec, reduced],
  )
  // A16: the design as the City drew it, unless ?look=classic or it is not modelled yet.
  const facade = spec && LOOK === 'drawn' ? FACADES[spec.id] : undefined
  // J8: where the selected design fails, or is too close to call.
  const slab = useMemo(() => (result && spec ? failSlab(result, spec) : null), [result, spec])

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
            ...(slab ? [failLabel(slab)] : []),
          ]
        : [],
    [check, placement, spec, slab],
  )
  const labelElements = useRef<(HTMLDivElement | null)[]>([])

  const lotKey = check?.lot.lot_id ?? ''
  // The street in front of the lot: doors face it, the road runs along it.
  const frontage = check?.lot.frontage_edge_local ?? null
  const lotRing = check?.lot.polygon_local ?? null
  const street = useMemo(() => (frontage ? streetFrame(frontage, lotRing) : null), [frontage, lotRing])
  // The drawn look's city round the lot (cityPlan.ts): the map's streets, the block continued past
  // the real data (so the street does not stop at 150 m) and every house's yard, planned a step at a
  // time while the map flies in. The street appears once it is planned.
  const [city, setCity] = useState<City | null>(null)
  const wantCity = drawn && !ELEVATION_VIEW && check !== null && street !== null
  useEffect(() => {
    if (!wantCity || !check || !street) return
    const controller = new AbortController()
    void planCity(
      check,
      street,
      controller.signal,
      (planned) => setCity(planned),
      (roads) => setCity((c) => (c?.lotKey === check.lot.lot_id ? { ...c, roads } : c)),
      !OFF.has('roads'),
    )
    return () => controller.abort()
  }, [wantCity, check, street])
  const cityNow = city?.lotKey === lotKey ? city : null
  const streetReady = !wantCity || cityNow !== null
  const extension = cityNow?.extension ?? null
  const streetBuildings = useMemo(
    () => (check ? [...check.context.buildings, ...(extension?.buildings ?? [])] : []),
    [check, extension],
  )
  const streetTrees = useMemo(() => (check ? [...check.context.trees, ...(extension?.trees ?? [])] : []), [check, extension])
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

  // Dev only: square to the design's front, at half its height (debug.ts).
  const fixedPose = useMemo((): FixedPose | null => {
    if (!ELEVATION_VIEW || !placement || !spec) return null
    const [fl, fr, , rl] = placement
    const mid: [number, number] = [(fl[0] + fr[0]) / 2, (fl[1] + fr[1]) / 2]
    const back = [rl[0] - fl[0], rl[1] - fl[1]]
    const len = Math.hypot(back[0], back[1])
    const out: [number, number] = [-back[0] / len, -back[1] / len]
    const h = spec.height_m / 2
    return {
      position: toScene([mid[0] + out[0] * ELEVATION_DISTANCE_M, mid[1] + out[1] * ELEVATION_DISTANCE_M], h),
      target: toScene(mid, h),
    }
  }, [placement, spec])

  return (
    <div
      className={visible ? 'scene scene-visible' : 'scene'}
      // The fade lasts the handoff: fully drawn as the map lands. Hiding stays instant.
      style={visible ? { transitionDuration: `${HANDOFF_S}s` } : undefined}
      aria-hidden="true"
      data-look={LOOK}
      data-quality={quality}
      data-settled={settled}
    >
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        shadows="percentage"
        dpr={[1, drawn ? (quality === 'high' ? DRAWN_MAX_DPR : 1) : 2]}
        gl={{ antialias: true, toneMapping: drawn ? ACESFilmicToneMapping : NeutralToneMapping }}
      >
        {import.meta.env.DEV && <DebugBridge stepDown={stepQuality} />}
        <Sequence lotKey={lotKey} designKey={designId ?? ''} timeline={timeline} reduced={reduced}>
          <fog
            attach="fog"
            args={[
              drawn ? SKY.horizon : tokenHex('--suplex-sky-bottom'),
              drawn ? DRAWN_FOG.near : FOG_NEAR_M,
              drawn ? DRAWN_FOG.far : FOG_FAR_M,
            ]}
          />
          {ELEVATION_VIEW ? (
            <color attach="background" args={['white']} />
          ) : (
<Sky backdrop={tokenHex('--suplex-sky-bottom')} look={drawn && !OFF.has('glow') ? SKY : null} />
          )}
          <Camera
            lotKey={lotKey}
            distanceM={framing.distanceM}
            viewBearingDeg={framing.viewBearingDeg}
            rightInsetPx={rightInsetPx}
            fixed={fixedPose}
          />
          <CutawayFocus targets={targets} />
          {drawn && <SettleWatch onChange={setSettled} />}
          {/* At low quality the shadows are off, so their map need not be redrawn either. */}
          {drawn && <ShadowFreeze frozen={(settled && check !== null) || !rich} />}
          {drawn && check && !OFF.has('monitor') && (
            <QualityMonitor key={`quality-${lotKey}`} minFps={MIN_FPS} onDecline={stepQuality} />
          )}
          {drawn ? <Studio shadows={rich} /> : <Lighting />}

          <Ground radius={groundRadius * GROUND_SCALE} drawn={drawn} />

          <WarmUp />
          {drawn && <YardWarmUp />}

          {check && (
            <>
              {!ELEVATION_VIEW && streetReady && <Street key={`street-${lotKey}`} buildings={streetBuildings} street={street} />}
              {cityNow?.roads && <Roads key={`roads-${lotKey}`} layers={cityNow.roads.layers} />}
              {drawn && !ELEVATION_VIEW && check.lot.frontage_edge_local && (
                <Frontage key={`frontage-${lotKey}`} edge={check.lot.frontage_edge_local} buildings={check.context.buildings} />
              )}
              {!ELEVATION_VIEW && streetReady && <Trees key={`trees-${lotKey}`} trees={streetTrees} />}
              {drawn && !ELEVATION_VIEW && street && !OFF.has('garden') && (
                <Garden key={`garden-${lotKey}-${designId ?? ''}`} lot={check.lot.polygon_local} design={result} street={street} />
              )}
              {cityNow && !OFF.has('yards') && <Yards key={`yards-${lotKey}`} yards={cityNow.yards} />}
              <Lot key={`lot-${lotKey}`} polygon={check.lot.polygon_local} design={result} />
              <OldHouse key={`old-${lotKey}`} buildings={check.context.buildings} squash={placement !== null} street={street} />
              <Pin restHeight={pinHeight} leaves={placement !== null} />
              {placement &&
                spec &&
                (facade ? (
                  <DrawnDesign key={`design-${lotKey}-${spec.id}`} placement={placement} spec={spec} model={facade} />
                ) : (
                  <ClassicDesign key={`design-${lotKey}-${spec.id}`} placement={placement} spec={spec} />
                ))}
              {slab && spec && <FailSlices key={`fail-${lotKey}-${spec.id}`} slab={slab} />}
            </>
          )}
          {/* Mounted before any lot too, so WarmUp's frames compile its shaders. */}
          {rich && !OFF.has('contact') && (
            <ContactShadows
              frames={settled && check ? 1 : Infinity}
              position={[0, CONTACT.y, 0]}
              scale={CONTACT.scaleM}
              far={CONTACT.farM}
              blur={CONTACT.blur}
              opacity={CONTACT.opacity}
              resolution={CONTACT.resolution}
            />
          )}
          <LabelProjector labels={labels} elements={labelElements} />
        </Sequence>
        {drawn && !OFF.has('ao') && <Effects ao={rich} rightInsetPx={rightInsetPx} />}
        {SHOW_STATS && <Stats />}
      </Canvas>
      {!ELEVATION_VIEW && <SceneLabels labels={labels} elements={labelElements} />}
    </div>
  )
}
