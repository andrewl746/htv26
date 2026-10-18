import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { OFF } from './debug'
import { GradeEffect } from './grade'

// A15: ambient occlusion (N8AO) grounds the buildings, the stairs and the guards; the composer then
// tone-maps with ACES. When the frame rate drops, only the AO pass is switched off: unmounting the
// composer would hand tone mapping back to the renderer, which recompiles every shader.
// Edges are smoothed by SMAA after tone mapping: multisampled half-float targets cost the Radeon
// 780M more than the whole rest of the frame (58 fps against 129 at 1080p with 400 buildings).
// After tone mapping, the grade and the vignette (grade.ts) merge into the same pass.
const AO = { radiusM: 2.2, falloff: 1.2, intensity: 2.4 }

export function Effects({ ao, rightInsetPx }: { ao: boolean; rightInsetPx: number }) {
  const grade = useMemo(() => new GradeEffect(), [])
  useEffect(() => () => grade.dispose(), [grade])
  // The vignette centres on the street left of the result panel, as the camera centres the lot.
  const width = useThree((s) => s.size.width)
  useEffect(() => grade.centreAt(width > rightInsetPx ? (width - rightInsetPx) / 2 / width : 0.5), [grade, width, rightInsetPx])
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        enabled={ao}
        halfRes
        quality="performance"
        aoRadius={AO.radiusM}
        distanceFalloff={AO.falloff}
        intensity={AO.intensity}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {!OFF.has('grade') && <primitive object={grade} dispose={null} />}
      <SMAA />
    </EffectComposer>
  )
}
