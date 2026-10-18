// Which look the 3D scene draws. The default is the realistic one: the City's designs as drawn on
// their elevation sheets (A16) in an offline studio environment with ambient occlusion (A15).
// `?look=classic` keeps the scene as it was before: box floors in the homes' colours, plain lights.
// It is the fallback if the realistic look misbehaves on the demo laptop (MASTERSPEC T23).

export type Look = 'drawn' | 'classic'

export const LOOK: Look = new URLSearchParams(window.location.search).get('look') === 'classic' ? 'classic' : 'drawn'
