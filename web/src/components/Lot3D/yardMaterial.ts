import { MeshStandardMaterial, type IUniform } from 'three'
import { DISTANCE_ATTRIBUTE } from './yardKit'

// The material every garden piece is drawn with (Garden.tsx, Yards.tsx): vertex colours, and growth
// by distance. Each vertex carries its house's distance from the lot, and the vertex shader raises
// it out of the ground on that house's step of the ripple, so the yards need no mesh of their own
// while they grow. With uRippleStart far in the past (the new building's garden) everything stands
// at full height; far in the future, every vertex sits at the origin and nothing shows.

export type YardUniforms = Record<'uYardTime' | 'uRippleStart' | 'uDelayPerM' | 'uMaxDelay' | 'uGrowS', IUniform<number>>

export function yardUniforms(grown: boolean): YardUniforms {
  return {
    uYardTime: { value: 0 },
    uRippleStart: { value: grown ? -1e6 : 1e6 },
    uDelayPerM: { value: 0 },
    uMaxDelay: { value: 0 },
    uGrowS: { value: 1 },
  }
}

/** The uniforms ride on the material's userData, so a frame callback can reach them through its mesh. */
export function yardMaterial(grown: boolean): MeshStandardMaterial {
  const uniforms = yardUniforms(grown)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
  material.userData.uniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float ${DISTANCE_ATTRIBUTE};
uniform float uYardTime;
uniform float uRippleStart;
uniform float uDelayPerM;
uniform float uMaxDelay;
uniform float uGrowS;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  float yardStart = uRippleStart + max(0.0, min(${DISTANCE_ATTRIBUTE} * uDelayPerM, uMaxDelay));
  float yardP = clamp((uYardTime - yardStart) / max(uGrowS, 1e-3), 0.0, 1.0);
  float yardQ = yardP - 1.0;
  // ease.outBack: a slight overshoot, like the houses.
  float yardK = 1.0 + 2.2 * yardQ * yardQ * yardQ + 1.2 * yardQ * yardQ;
  transformed = yardP <= 0.0 ? vec3(0.0) : vec3(transformed.x, transformed.y * yardK, transformed.z);
}`,
      )
  }
  material.customProgramCacheKey = () => 'suplex-yard'
  return material
}
