/* 作物資料：seed 與 produce 要對應 items.js 的 id；growMs 是有澆水時的成熟時間（毫秒）；yield 是 [最少, 最多] 收成數 */
const MIN = 60 * 1000;
export const crops = [
  { id: 'turnip', name: '蕪菁', seed: 'seed_turnip', produce: 'crop_turnip', growMs: 5 * MIN, yield: [1, 2] },
  { id: 'star', name: '星星果', seed: 'seed_star', produce: 'crop_star', growMs: 60 * MIN, yield: [1, 1] },
];
