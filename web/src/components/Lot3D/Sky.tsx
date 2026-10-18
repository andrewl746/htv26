import { useEffect, useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry } from 'three'

// The sky behind the street. The canvas used to stay transparent above the ground, so tilting the
// camera up showed the base map (and its street names) through the scene. The drawn look gets a
// daytime sky, pale haze at the horizon (the fog's colour, so the ground fades into it) rising to
// blue; the classic look gets a plain backdrop in its fog colour.
const RADIUS_M = 900

export function Sky({ horizon, zenith }: { horizon: string; zenith: string | null }) {
  const geometry = useMemo(() => new SphereGeometry(RADIUS_M, 32, 16), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new Color(horizon) },
          uZenith: { value: new Color(zenith ?? horizon) },
        },
        vertexShader: /* glsl */ `
          varying float vUp;
          void main() {
            vUp = normalize(position).y;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uHorizon;
          uniform vec3 uZenith;
          varying float vUp;
          void main() {
            float t = smoothstep(0.0, 0.55, max(vUp, 0.0));
            gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [horizon, zenith],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  // Drawn first, at the far plane, everything else in front of it.
  return <mesh geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />
}
