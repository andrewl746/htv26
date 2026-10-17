import { MeshDepthMaterial, type Material } from 'three'
import { sinkTexture } from './occlusion'

// Neighbouring houses stand about a metre from the lot, so as the camera orbits, the one next door
// covers the design. Rather than cutting a hole through it, which left houses half see-through, a
// neighbour standing between the camera and the design sinks, whole and solid, to a low stub
// until the camera has moved past (occlusion.ts decides which). Materials made with withCutaway()
// read each building's or tree's sink from one shared texture, so the merged street still sinks
// one building at a time in a handful of draw calls; cutawayDepthMaterial sinks the shadows too.
// The design, the lot and the house being replaced use plain materials and never sink.

/** Each vertex's slot in the sink texture: a vertex attribute on the street, per instance on trees. */
export const SLOT_ATTRIBUTE = 'aCutSlot'
/** A fully sunk neighbour keeps this share of its height, roof and all, like a squashed model. */
const STUB_SCALE = 0.12

/** Shared by every cutaway material: one texture update per frame moves the whole street. */
export const cutawayUniforms = {
  uCutSink: { value: sinkTexture },
}

const VERTEX_DECLARATIONS = /* glsl */ `
attribute float ${SLOT_ATTRIBUTE};
uniform sampler2D uCutSink;
`

// Squashed toward the ground in world space. Every model here only turns about the vertical, so
// world y = scale * y + lift, and scaling world y by k means y' = k * y + (k - 1) * lift / scale.
const VERTEX_BODY = /* glsl */ `
{
  float sink = texelFetch(uCutSink, ivec2(int(${SLOT_ATTRIBUTE} + 0.5), 0), 0).r;
  if (sink > 0.0) {
    mat4 cutModel = modelMatrix;
    #ifdef USE_INSTANCING
      cutModel = modelMatrix * instanceMatrix;
    #endif
    float k = mix(1.0, ${STUB_SCALE.toFixed(3)}, sink);
    transformed.y = k * transformed.y + (k - 1.0) * cutModel[3][1] / cutModel[1][1];
  }
}
`

export function withCutaway<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cutawayUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`)
  }
  // One program for every cutaway material of a kind, which WarmUp compiles ahead of time.
  material.customProgramCacheKey = () => 'suplex-cutaway'
  return material
}

/** The shadow pass's material for everything drawn withCutaway(), so a sunk neighbour's shadow sinks with it. */
export const cutawayDepthMaterial = withCutaway(new MeshDepthMaterial())
