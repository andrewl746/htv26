import { Vector3, type Material } from 'three'

// Neighbouring houses stand about a metre from the lot, so as the camera orbits, the one next door
// covers the design. Materials made with withCutaway() drop the fragments that sit inside a cone
// from the camera to the design, with a dithered edge, so the design always shows. The cut is
// opaque (no sorting trouble), works on the merged street, and leaves the shadows on the ground.
// The design, the lot and the house being replaced use plain materials and are never cut.

/** Shared by every cutaway material: one update per frame moves the cut for the whole street. */
export const cutawayUniforms = {
  uCutEye: { value: new Vector3() },
  uCutFocus: { value: new Vector3() },
  /** Cone radius at the focus; 0 turns the cut off. */
  uCutRadius: { value: 0 },
}

const VERTEX_DECLARATIONS = /* glsl */ `
varying vec3 vCutWorld;
`

const VERTEX_BODY = /* glsl */ `
vec4 cutWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cutWorld = instanceMatrix * cutWorld;
#endif
vCutWorld = (modelMatrix * cutWorld).xyz;
`

const FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec3 vCutWorld;
uniform vec3 uCutEye;
uniform vec3 uCutFocus;
uniform float uCutRadius;

// A 4 x 4 ordered dither, so the edge of the cut fades instead of slicing.
float cutThreshold(vec2 pixel) {
  int i = int(mod(pixel.x, 4.0)) + int(mod(pixel.y, 4.0)) * 4;
  float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (bayer[i] + 0.5) / 16.0;
}
`

const FRAGMENT_BODY = /* glsl */ `
if (uCutRadius > 0.0) {
  vec3 sight = uCutFocus - uCutEye;
  float sightLength = length(sight);
  vec3 toFocus = sight / sightLength;
  vec3 fromEye = vCutWorld - uCutEye;
  float along = dot(fromEye, toFocus);
  if (along > 0.0) {
    float allowed = uCutRadius * along / sightLength;
    float radial = length(fromEye - toFocus * along);
    float inCone = 1.0 - smoothstep(allowed * 0.75, allowed, radial);
    float beforeFocus = 1.0 - smoothstep(sightLength - 1.0, sightLength + 1.0, along);
    if (inCone * beforeFocus > cutThreshold(gl_FragCoord.xy)) discard;
  }
}
`

export function withCutaway<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cutawayUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAGMENT_BODY}`)
  }
  // One program for every cutaway material of a kind, which WarmUp compiles ahead of time.
  material.customProgramCacheKey = () => 'suplex-cutaway'
  return material
}
