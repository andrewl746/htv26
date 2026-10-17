import { useFrame } from '@react-three/fiber'
import { cutawayUniforms } from './cutaway'
import type { Vec3 } from './geometry'

/** Points the street's cutaway at what the camera should always see: the design, or the lot. */
export function CutawayFocus({ focus }: { focus: { centre: Vec3; radius: number } | null }) {
  useFrame(({ camera }) => {
    cutawayUniforms.uCutEye.value.copy(camera.position)
    if (focus) cutawayUniforms.uCutFocus.value.set(...focus.centre)
    cutawayUniforms.uCutRadius.value = focus ? focus.radius : 0
  })
  return null
}
