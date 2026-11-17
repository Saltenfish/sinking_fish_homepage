/* 許願樹上的掛點。座標對應 plaquesView 裡那棵樹的畫布（900 × 540）。
   x, y 是繩子綁在枝條上的位置，len 是繩長。換樹的美術時，只要調整這張表。 */
export const TREE_W = 900, TREE_H = 540, PLAQUE_W = 72, PLAQUE_H = 100;

export const ANCHORS = Object.freeze([
  // 由 tools/make_pixel_scenes.py 依許願樹大圖的枝條下緣算出來；換了樹的圖要重新調整
  { x: 270, y: 188, len: 10 },
  { x: 856, y: 64, len: 22 },
  { x: 638, y: 366, len: 34 },
  { x: 600, y: 106, len: 10 },
  { x: 102, y: 14, len: 22 },
  { x: 62, y: 280, len: 34 },
  { x: 850, y: 286, len: 10 },
  { x: 398, y: 28, len: 22 },
  { x: 466, y: 260, len: 34 },
  { x: 324, y: 348, len: 10 },
  { x: 720, y: 202, len: 22 },
  { x: 196, y: 306, len: 34 },
  { x: 436, y: 140, len: 10 },
  { x: 182, y: 98, len: 22 },
]);

/* 第 i 塊牌掛在哪裡。掛點用完後會往旁邊錯開、繩子稍微加長，再繞一輪 */
export function plaqueSpot(i) {
  const a = ANCHORS[i % ANCHORS.length];
  const lap = Math.floor(i / ANCHORS.length);
  const x = Math.min(TREE_W - PLAQUE_W / 2, Math.max(PLAQUE_W / 2, a.x + lap * 26));
  const len = Math.min(a.len + lap * 16, TREE_H - PLAQUE_H - a.y);
  return { x, y: a.y, len: Math.max(0, len) };
}
