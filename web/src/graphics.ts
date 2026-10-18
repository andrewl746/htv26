/**
 * Whether this browser can draw WebGL, which the base map, the 3D scene and the ward map all need
 * (MASTERSPEC 6.7). Without it the app runs on the plan view: search, the result panel and the
 * lot drawn from above, without the maps behind it.
 */
export const HAS_WEBGL: boolean = (() => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // Hand the test context back at once: browsers cap how many can be open.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  } catch {
    return false
  }
})()
