import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// A15: ambient occlusion (N8AO) grounds the buildings, the stairs and the guards; the composer then
// tone-maps with ACES, the same curve the renderer uses when the PerformanceMonitor drops this pass.
// Edges are smoothed by SMAA after tone mapping: multisampled half-float targets cost the Radeon
// 780M more than the whole rest of the frame (58 fps against 129 at 1080p with 400 buildings).
const AO = { radiusM: 2.2, falloff: 1.2, intensity: 2.4 }

export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="performance" aoRadius={AO.radiusM} distanceFalloff={AO.falloff} intensity={AO.intensity} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  )
}
