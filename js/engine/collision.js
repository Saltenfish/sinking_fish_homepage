/* 碰撞：座標單位是「格」（可為小數）。solids 是擋路物件的矩形 [{x, y, w, h}]。 */
const EPS = 1e-6;

export function boxBlocked(map, solids, cx, cy, half) {
  const x0 = Math.floor(cx - half), x1 = Math.floor(cx + half - EPS);
  const y0 = Math.floor(cy - half), y1 = Math.floor(cy + half - EPS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (map.solid(tx, ty)) return true;
  for (const s of solids) {
    if (cx - half < s.x + s.w - EPS && cx + half > s.x + EPS && cy - half < s.y + s.h - EPS && cy + half > s.y + EPS) return true;
  }
  return false;
}

/* 兩軸分開移動：撞牆時還能沿著牆滑行 */
export function moveBox(map, solids, pos, dx, dy, half) {
  let { x, y } = pos;
  let hitX = false, hitY = false;
  if (dx) { if (boxBlocked(map, solids, x + dx, y, half)) hitX = true; else x += dx; }
  if (dy) { if (boxBlocked(map, solids, x, y + dy, half)) hitY = true; else y += dy; }
  return { x, y, hitX, hitY };
}

/* 點到矩形的最短距離（互動距離判定用） */
export function distToRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}
