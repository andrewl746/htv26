import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// A15: ambient occlusion (N8AO) grounds the buildings, the stairs and the guards; the composer then
// tone-maps with ACES, the same curve the renderer uses when the PerformanceMonitor drops this pass.
const AO = { radiusM: 2.2, falloff: 1.2, intensity: 2.4 }
const MULTISAMPLING = 4

export function Effects() {
  return (
    <EffectComposer multisampling={MULTISAMPLING}>
      <N8AO halfRes quality="performance" aoRadius={AO.radiusM} distanceFalloff={AO.falloff} intensity={AO.intensity} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
