import { BlendFunction, Effect } from 'postprocessing'
import { Uniform, Vector2, Vector3 } from 'three'

// The drawn look's last touch, after tone mapping: a gentle grade and a soft vignette, in one
// effect that the composer merges into the pass it already draws (Effects.tsx), so it costs a few
// sums per pixel and no extra pass.
//
// The grade works on roughly perceptual values (the square root of linear light): a touch less
// saturation, so the lawn stops shouting; a little more contrast; and late-afternoon toning, warm
// in the light and cool in the shade. It is gentle enough that the fit green, the red hatched fail
// slab and the green borderline stripes keep their hues and stay apart.
//
// postprocessing's own Vignette is centred on the canvas, but the canvas runs under the result
// panel; this one is centred on the part of the street the panel leaves visible, where the camera
// centres the lot (Camera.tsx).

export const GRADE = {
  saturation: 0.95,
  contrast: 1.06,
  /** Multipliers on the perceptual colour: the light gets warmer, the shade cooler. */
  warm: [1.025, 1.0, 0.96] as const,
  cool: [0.975, 0.995, 1.035] as const,
  /** How much the corners darken (perceptual), and over which distances from the centre, in canvas heights. */
  vignette: 0.1,
  vignetteFrom: 0.45,
  vignetteTo: 1.15,
}

const FRAGMENT = /* glsl */ `
uniform vec2 centre;
uniform float saturation;
uniform float contrast;
uniform vec3 warm;
uniform vec3 cool;
uniform float vignette;
uniform vec2 vignetteRange;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 p = sqrt(max(inputColor.rgb, 0.0));
  float l = dot(p, vec3(0.2126, 0.7152, 0.0722));
  p = mix(vec3(l), p, saturation);
  p = (p - 0.5) * contrast + 0.5;
  p *= mix(cool, warm, smoothstep(0.2, 0.8, l));
  vec2 offset = (uv - centre) * vec2(aspect, 1.0);
  p *= 1.0 - vignette * smoothstep(vignetteRange.x, vignetteRange.y, length(offset));
  p = clamp(p, 0.0, 1.0);
  outputColor = vec4(p * p, inputColor.a);
}
`

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['centre', new Uniform(new Vector2(0.5, 0.5))],
        ['saturation', new Uniform(GRADE.saturation)],
        ['contrast', new Uniform(GRADE.contrast)],
        ['warm', new Uniform(new Vector3(...GRADE.warm))],
        ['cool', new Uniform(new Vector3(...GRADE.cool))],
        ['vignette', new Uniform(GRADE.vignette)],
        ['vignetteRange', new Uniform(new Vector2(GRADE.vignetteFrom, GRADE.vignetteTo))],
      ]),
    })
  }

  /** Centres the vignette across this share of the canvas width (0.5: the middle). */
  centreAt(x: number): void {
    const centre = this.uniforms.get('centre')?.value as Vector2 | undefined
    centre?.set(x, 0.5)
  }
}
