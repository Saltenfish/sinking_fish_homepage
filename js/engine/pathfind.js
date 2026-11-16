/* 點擊移動用的尋路（四方向 BFS）。
   目標格本身擋路時（例如點在樹或水上），改成走到它旁邊。找不到路回傳 null；已在目標回傳 []。 */
export function findPath(passable, w, h, sx, sy, tx, ty, maxNodes = 6000) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  if (!inside(sx, sy) || !inside(tx, ty)) return null;
  const goalBlocked = !passable(tx, ty);
  const isGoal = (x, y) => (goalBlocked ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  if (isGoal(sx, sy)) return [];

  const prev = new Int32Array(w * h).fill(-1);
  const start = sy * w + sx;
  prev[start] = start;
  const queue = [start];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let qi = 0; qi < queue.length && qi < maxNodes; qi++) {
    const cur = queue[qi], cx = cur % w, cy = (cur - cx) / w;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inside(nx, ny)) continue;
      const ni = ny * w + nx;
      if (prev[ni] !== -1 || !passable(nx, ny)) continue;
      prev[ni] = cur;
      if (isGoal(nx, ny)) {
        const path = [];
        for (let p = ni; p !== start; p = prev[p]) path.push({ x: p % w, y: Math.floor(p / w) });
        return path.reverse();
      }
      queue.push(ni);
    }
  }
  return null;
}
