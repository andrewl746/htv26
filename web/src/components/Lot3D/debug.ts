// Dev-only views for checking the drawn designs against the City's sheets. Never in a build.

/** `?elevation`: the camera stands square to the design's front, as the A200 front elevation does. */
export const ELEVATION_VIEW = import.meta.env.DEV && new URLSearchParams(window.location.search).has('elevation')
