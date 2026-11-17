/* 許願樹上的掛點。座標對應 plaquesView 裡那棵樹的畫布（900 × 540）。
   x, y 是繩子綁在枝條上的位置，len 是繩長。換樹的美術時，只要調整這張表。 */
export const TREE_W = 900, TREE_H = 540, PLAQUE_W = 72, PLAQUE_H = 100;

export const ANCHORS = Object.freeze([
  { x: 140, y: 250, len: 48 },   // 左側低枝
  { x: 420, y: 62, len: 14 },    // 正中高枝
  { x: 800, y: 112, len: 40 },   // 右側高枝
  { x: 285, y: 96, len: 34 },
  { x: 628, y: 108, len: 60 },
  { x: 230, y: 268, len: 118 },
  { x: 846, y: 188, len: 150 },
  { x: 560, y: 215, len: 150 },
  { x: 668, y: 36, len: 20 },
  { x: 720, y: 240, len: 60 },
  { x: 340, y: 170, len: 110 },
  { x: 470, y: 120, len: 190 },
  { x: 520, y: 60, len: 6 },
  { x: 770, y: 300, len: 120 },
]);

/* 第 i 塊牌掛在哪裡。掛點用完後會往旁邊錯開、繩子稍微加長，再繞一輪 */
export function plaqueSpot(i) {
  const a = ANCHORS[i % ANCHORS.length];
  const lap = Math.floor(i / ANCHORS.length);
  const x = Math.min(TREE_W - PLAQUE_W / 2, Math.max(PLAQUE_W / 2, a.x + lap * 26));
  const len = Math.min(a.len + lap * 16, TREE_H - PLAQUE_H - a.y);
  return { x, y: a.y, len: Math.max(0, len) };
}
