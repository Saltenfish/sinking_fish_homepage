/* ============================================================
   地圖：小鎮（目前用程式畫格子，之後可換成 Tiled 匯出的資料，格式維持 {id, legend, rows, spawn, landmarks, objects} 即可）
   legend：每種字元的性質。key = 圖塊名稱（對應素材 tile.<key>）；solid = 擋路；color = 沒有圖塊時的佔位顏色
   objects：地圖上的互動物件。type 對應 js/world/types.js 裡註冊的類型
============================================================ */
const W = 40, H = 30;
const g = Array.from({ length: H }, () => Array(W).fill('.'));
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };

rect(0, 0, W - 1, H - 1, '#'); rect(1, 1, W - 2, H - 2, '.');   // 外圍樹牆
// 召喚神殿：白色大理石的圓形神殿，外圍是不對稱的弧形矮牆，南邊有入口。
// 形狀由 templeK() 決定（和 tools/make_pixel_temple.py 用同一個公式，改了要兩邊一起改）：
// k < floor 的格子是地板；地板外圍緊貼的一圈是外牆（擋路）；入口那兩格不擋。
// 外觀是一整張佈景圖 decor.temple 蓋在上面，所以外牆格子底下畫成草地就好。
export const TEMPLE = { cx: 20, cy: 6.6, rx: 8.4, ry: 5.2, floor: 0.86, gate: [19, 20] };
export function templeK(x, y, T = TEMPLE) {
  const dx = (x - T.cx) / T.rx, dy = (y - T.cy) / T.ry, a = Math.atan2(dy, dx);
  const m = 1 + 0.11 * Math.sin(a + 0.6) + 0.08 * Math.sin(2 * a + 1.9) + 0.045 * Math.cos(3 * a - 0.4);
  return Math.hypot(dx, dy) / m;
}
const isFloor = (x, y) => templeK(x + 0.5, y + 0.5) < TEMPLE.floor;
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  if (isFloor(x, y)) { g[y][x] = 'm'; continue; }
  const nearFloor = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isFloor(x + dx, y + dy)));
  if (nearFloor && g[y][x] === '.') g[y][x] = TEMPLE.gate.includes(x) && y > TEMPLE.cy ? 'm' : 'R';   // 入口兩格不擋
}
rect(31, 1, 32, 28, '~'); rect(31, 14, 32, 14, '=');             // 溪流與小橋
rect(33, 20, 38, 20, 'r');                                       // 蘆葦叢：看起來擋路，其實走得過去（秘密入口）
rect(35, 23, 37, 26, '~');                                       // 隱藏池塘
rect(3, 5, 8, 8, 'H'); rect(5, 8, 6, 8, 'd');                    // 成就小屋與門口

export const town = {
  id: 'town',
  legend: {
    '.': { key: 'grass', solid: false, color: '#7fb069', name: '草地' },
    '#': { key: 'wall', solid: true, color: '#2f5d3a', name: '樹牆' },
    'm': { key: 'marble', solid: false, color: '#ece8f2', name: '大理石地板' },
    'R': { key: 'grass', solid: true, color: '#7fb069', name: '神殿外牆' },   // 外觀由 decor.temple 畫
    '~': { key: 'water', solid: true, color: '#4f8fc0', name: '水' },
    '=': { key: 'bridge', solid: false, color: '#a47148', name: '橋' },
    'r': { key: 'reed', solid: false, color: '#3a6b45', name: '蘆葦' },
    'H': { key: 'hut', solid: true, color: '#b5651d', name: '小屋' },
    'd': { key: 'door', solid: false, color: '#5d4037', name: '門口' },
  },
  rows: g.map((r) => r.join('')),
  spawn: { x: 20.5, y: 24.5 },
  /* 大型佈景：蓋在圖塊上的整張圖（建築外觀等），只是裝飾、不影響碰撞。sprite 對應素材鍵 */
  decor: [
    { id: 'hut', x: 3, y: 5, w: 6, h: 4, sprite: 'decor.hut' },
    { id: 'temple', x: 9, y: 0, w: 22, h: 14, sprite: 'decor.temple' },   // 召喚神殿的地板與弧形外牆
  ],
  /* 傳送地圖上的地點。secret 是要先達成的旗標（沒達成就不顯示） */
  landmarks: [
    { id: 'plaza', name: '中央草地', x: 20.5, y: 24.5 },
    { id: 'tree', name: '許願樹', x: 20, y: 20.5 },
    { id: 'hall', name: '召喚卡殿', x: 20, y: 8.5 },
    { id: 'hut', name: '成就小屋', x: 6, y: 9.5 },
    { id: 'farm', name: '農田', x: 6, y: 23.5 },
    { id: 'stream', name: '溪邊釣點', x: 30.5, y: 20.5 },
    { id: 'market', name: '商店與小賭場', x: 35.5, y: 6.6 },
    { id: 'pond', name: '魚魚的池塘', x: 34.5, y: 25.5, secret: 'fishFound' },
  ],
  objects: [
    { id: 'board', type: 'board', x: 22, y: 23, solid: true,
      lines: ['【公告欄】', '歡迎來到沉魚的小鎮。', '北邊是召喚卡殿，中間是許願樹，西邊有田，西北有成就小屋。', '溪邊可以釣魚。聽說許願樹搖一搖會掉東西。', '天黑之後草地上會有蟲。要慢慢靠近才抓得到（鍵盤按住 Shift，手機輕推搖桿）。', '過了橋往北有商店和小賭場；小屋旁邊有魚缸。', '右上角的「地圖」可以直接傳送。'] },
    { id: 'tree', type: 'tree', x: 19, y: 18, w: 2, h: 2, solid: true, art: { x: -2, y: -4, w: 6, h: 6 } },   // 圖是 6×6 格，樹冠往上、往兩邊伸出去
    { id: 'altar', type: 'altar', x: 19, y: 5, w: 2, h: 2, solid: true, art: { x: -0.5, y: -0.5, w: 3, h: 3 } },   // 圖是 3×3 格的大理石圓台
    // 卡殿裡的裝飾：石柱（佔 1 格、圖往上高 1 格）與牆上的掛旗
    // 白色大理石柱：沿著外牆內側、間隔不規則地排一圈（有一根是斷掉的）
    { id: 'col1', type: 'deco', sprite: 'ent.column', x: 13, y: 7, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col2', type: 'deco', sprite: 'ent.column', x: 16, y: 3, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col3', type: 'deco', sprite: 'ent.column', x: 22, y: 3, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col4', type: 'deco', sprite: 'ent.column.broken', x: 25, y: 4, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col5', type: 'deco', sprite: 'ent.column', x: 27, y: 6, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col6', type: 'deco', sprite: 'ent.column', x: 25, y: 9, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },
    { id: 'col7', type: 'deco', sprite: 'ent.column', x: 15, y: 9, solid: true, art: { x: 0, y: -2, w: 1, h: 3 } },

    // 農田：6 × 3 共 18 塊，一開始只開放前 6 塊，其餘要在商店「擴建農地」才會出現
    ...Array.from({ length: 18 }, (_, i) => ({ id: `plot${i}`, type: 'plot', x: 3 + (i % 6), y: 19 + Math.floor(i / 6), index: i })),

    { id: 'fishspot', type: 'fishspot', x: 30, y: 19 },
    { id: 'pond', type: 'pond', x: 34, y: 24 },

    { id: 'bush1', type: 'bush', x: 8, y: 14 },
    { id: 'bush2', type: 'bush', x: 14, y: 25 },
    { id: 'bush3', type: 'bush', x: 26, y: 22 },
    { id: 'bush4', type: 'bush', x: 35, y: 8 },

    { id: 'dig1', type: 'dig', x: 4, y: 26 },
    { id: 'dig2', type: 'dig', x: 25, y: 14 },
    { id: 'dig3', type: 'dig', x: 36, y: 16 },

    { id: 'hut', type: 'hut', x: 5, y: 8, w: 2, h: 1, solid: true },
    { id: 'offering', type: 'offering', x: 14, y: 4, solid: true },

    { id: 'bug1', type: 'bugspot', x: 10, y: 16 },
    { id: 'bug2', type: 'bugspot', x: 24, y: 26 },
    { id: 'bug3', type: 'bugspot', x: 37, y: 13 },
    { id: 'bug4', type: 'bugspot', x: 15, y: 13 },

    { id: 'market', type: 'market', x: 33, y: 4, w: 2, h: 2, solid: true },
    { id: 'casino', type: 'casino', x: 36, y: 4, w: 2, h: 2, solid: true },
    { id: 'tank', type: 'tank', x: 9, y: 7, w: 2, h: 1, solid: true },

    { id: 'lantern1', type: 'lantern', x: 15, y: 14, solid: true },
    { id: 'lantern2', type: 'lantern', x: 24, y: 12, solid: true },
    { id: 'lantern3', type: 'lantern', x: 12, y: 19, solid: true },
    { id: 'lantern4', type: 'lantern', x: 28, y: 19, solid: true },
  ],
};
