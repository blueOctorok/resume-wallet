/**
 * Flat-top hexagon (pointy left/right) in a CSS box:
 * bounding width : height = 2 : sqrt(3) — **wider than tall**, matching `clip-path` in CandidateHub.
 * Use this whenever hub hex W/H are chosen so copy has horizontal room.
 */
export function flatTopHexHeight(width: number): number {
  return Math.round((width * Math.sqrt(3)) / 2)
}
