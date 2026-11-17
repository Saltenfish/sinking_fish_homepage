/* 地圖格子：讀取並檢查地圖資料，提供「這格能不能走」的查詢。 */
export function createTilemap(map) {
  const fail = (msg) => { throw new Error(`地圖「${map?.id ?? '?'}」有問題：${msg}`); };
  if (!map || !Array.isArray(map.rows) || !map.rows.length) fail('缺少 rows');
  const h = map.rows.length, w = map.rows[0].length;
  if (!w) fail('第一列是空的');
  map.rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== w) fail(`第 ${y} 列長度不是 ${w}`);
    for (const ch of row) if (!map.legend?.[ch]) fail(`第 ${y} 列出現 legend 沒定義的字元「${ch}」`);
  });
  const inside = (tx, ty) => tx >= 0 && ty >= 0 && tx < w && ty < h;
  // 大型佈景：{id, x, y, w, h, sprite}，只是畫面裝飾，不影響碰撞。格式不對的略過
  const decor = (Array.isArray(map.decor) ? map.decor : []).filter((d) => d && typeof d.sprite === 'string' && [d.x, d.y, d.w, d.h].every(Number.isFinite) && d.w > 0 && d.h > 0);
  const api = {
    id: map.id, w, h, legend: map.legend, decor,
    inside,
    char(tx, ty) { return inside(tx, ty) ? map.rows[ty][tx] : null; },
    tile(tx, ty) { return inside(tx, ty) ? map.legend[map.rows[ty][tx]] : null; },
    solid(tx, ty) { return !inside(tx, ty) || map.legend[map.rows[ty][tx]].solid === true; },   // 地圖外一律擋住
  };
  const s = map.spawn;
  if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y) || api.solid(Math.floor(s.x), Math.floor(s.y))) fail('spawn 不在可走的格子上');
  return api;
}
