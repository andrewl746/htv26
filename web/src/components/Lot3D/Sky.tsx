import { useEffect, useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { Vec3 } from './geometry'

// The sky behind the street. The canvas used to stay transparent above the ground, so tilting the
// camera up showed the base map (and its street names) through the scene. The classic look gets a
// plain backdrop in its fog colour.
//
// The drawn look gets a sunny day: a light haze at the horizon (the fog's colour, so the ground
// fades into it), clear blue a few degrees up and deeper blue overhead, and the sun where the
// shadow light comes from (sun.ts), with a halo and a broad warm glow over that side of the
// horizon. The camera never tilts up far enough to see the disc at the sun's 25°, so the glow is
// what reads as the orbit turns toward the sun. The glow fades out at the horizon line, where the
// sky meets the fog, so the distant ground never shows a seam against it.
const RADIUS_M = 900
/** Opaque, so drawn after everything else that is opaque: only the pixels the street leaves bare shade it. */
const DRAW_LAST = 1000

/** The sun in the drawn look's sky. */
export interface SkySun {
  /** Toward the sun (sun.ts). */
  direction: Vec3
  disc: Color
  glow: Color
}

/**
 * The drawn look's sky, in linear light that may run past 1: the composer's tone mapping turns pale
 * blues grey, so these are chosen for how they show after it (Scene.tsx).
 */
export interface SkyLook {
  horizon: Color
  blue: Color
  zenith: Color
  sun: SkySun
}

/** Where the haze has turned clear blue, and where the blue is the zenith's (sines of the angle above the horizon). */
const GRADIENT = { blueBy: 0.07, zenithBy: 0.45 }
/** Glow: its strength at the sun's bearing, how tight it hugs that bearing, and how high above the horizon it is full. */
const GLOW = { strength: 0.35, power: 10, fullAboveHorizon: 0.04 }
/** Disc: cosines of its edge (about 1.2° across, softened) and its brightness; then the halo round it. */
const DISC = { inner: 0.99985, outer: 0.99955, intensity: 5, halo: 0.6, haloPower: 400 }

export function Sky({ backdrop, look = null }: { backdrop: string; look?: SkyLook | null }) {
  const geometry = useMemo(() => new SphereGeometry(RADIUS_M, 32, 16), [])
  const material = useMemo(() => {
    // Without a look (the classic look) every colour is the backdrop and there is no sun.
    const plain = new Color(backdrop)
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: look?.horizon ?? plain },
        uBlue: { value: look?.blue ?? plain },
        uZenith: { value: look?.zenith ?? plain },
        uSunDirection: { value: new Vector3(...(look?.sun.direction ?? [0, 1, 0])).normalize() },
        uSunDisc: { value: look?.sun.disc ?? plain },
        uSunGlow: { value: look?.sun.glow ?? plain },
        uSunStrength: { value: look ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uBlue;
        uniform vec3 uZenith;
        uniform vec3 uSunDirection;
        uniform vec3 uSunDisc;
        uniform vec3 uSunGlow;
        uniform float uSunStrength;
        varying vec3 vDirection;
        void main() {
          vec3 direction = normalize(vDirection);
          float up = direction.y;
          vec3 colour = mix(uHorizon, uBlue, smoothstep(0.0, ${GRADIENT.blueBy.toFixed(3)}, up));
          colour = mix(colour, uZenith, smoothstep(${GRADIENT.blueBy.toFixed(3)}, ${GRADIENT.zenithBy.toFixed(3)}, up));
          float toSun = max(dot(direction, uSunDirection), 0.0);
          float glow = ${GLOW.strength.toFixed(3)} * pow(toSun, ${GLOW.power.toFixed(1)})
            * smoothstep(0.0, ${GLOW.fullAboveHorizon.toFixed(3)}, up);
          float disc = smoothstep(${DISC.outer.toFixed(5)}, ${DISC.inner.toFixed(5)}, toSun) * ${DISC.intensity.toFixed(1)}
            + ${DISC.halo.toFixed(2)} * pow(toSun, ${DISC.haloPower.toFixed(1)});
          colour += (uSunGlow * glow + uSunDisc * disc) * uSunStrength;
          gl_FragColor = vec4(colour, 1.0);
          #include <colorspace_fragment>
        }
      `,
    })
  }, [backdrop, look])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  // At the far plane, behind everything. The drawn look draws it last of the opaque things, so it
  // shades only the sky that shows; the classic look keeps drawing it first, as it always has.
  return <mesh geometry={geometry} material={material} renderOrder={look ? DRAW_LAST : -10} frustumCulled={false} />
}
