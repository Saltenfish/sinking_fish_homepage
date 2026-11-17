/* 許願樹上的掛點。座標對應 plaquesView 裡那棵樹的畫布（900 × 540）。
   x, y 是繩子綁在枝條上的位置，len 是繩長。換樹的美術時，只要調整這張表。 */
export const TREE_W = 900, TREE_H = 540, PLAQUE_W = 72, PLAQUE_H = 100;

export const ANCHORS = Object.freeze([
  // 由 tools/make_pixel_scenes.py 依許願樹大圖的枝條下緣算出來；換了樹的圖要重新調整
  { x: 320, y: 234, len: 58 },
  { x: 580, y: 112, len: 188 },
  { x: 200, y: 158, len: 128 },
  { x: 700, y: 200, len: 96 },
  { x: 450, y: 236, len: 68 },
  { x: 80, y: 252, len: 38 },
  { x: 820, y: 258, len: 40 },
  { x: 140, y: 278, len: 142 },
  { x: 260, y: 196, len: 232 },
  { x: 380, y: 272, len: 144 },
  { x: 520, y: 160, len: 264 },
  { x: 640, y: 248, len: 170 },
  { x: 760, y: 284, len: 142 },
  { x: 40, y: 246, len: 176 },
]);

/* 第 i 塊牌掛在哪裡。掛點用完後會往旁邊錯開、繩子稍微加長，再繞一輪 */
export function plaqueSpot(i) {
  const a = ANCHORS[i % ANCHORS.length];
  const lap = Math.floor(i / ANCHORS.length);
  const x = Math.min(TREE_W - PLAQUE_W / 2, Math.max(PLAQUE_W / 2, a.x + lap * 26));
  const len = Math.min(a.len + lap * 16, TREE_H - PLAQUE_H - a.y);
  return { x, y: a.y, len: Math.max(0, len) };
}
