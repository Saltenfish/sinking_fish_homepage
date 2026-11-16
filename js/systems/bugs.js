/* 捕蟲的判定（純函式）：靠太近又走太快，蟲就飛走。 */
export function bugReaction(dist, speed, { alertRadius, sneakSpeed }) {
  return dist <= alertRadius && speed > sneakSpeed ? 'flee' : 'stay';
}
