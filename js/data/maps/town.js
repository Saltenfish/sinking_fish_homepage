/* ============================================================
   地圖：小鎮（目前用程式畫格子，之後可換成 Tiled 匯出的資料，格式維持 {id, legend, rows, spawn, landmarks, objects} 即可）
   legend：每種字元的性質。solid = 擋路；color = 佔位顏色（之後換成圖塊）
   objects：地圖上的互動物件。type 對應 js/world/types.js 裡註冊的類型
============================================================ */
const W = 40, H = 30;
const g = Array.from({ length: H }, () => Array(W).fill('.'));
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };

rect(0, 0, W - 1, H - 1, '#'); rect(1, 1, W - 2, H - 2, '.');   // 外圍樹牆
rect(11, 1, 28, 11, '#'); rect(12, 2, 27, 10, 's');              // 召喚卡殿（石地板）
rect(19, 11, 20, 11, 's');                                       // 卡殿大門
rect(31, 1, 32, 28, '~'); rect(31, 14, 32, 14, '=');             // 溪流與小橋
rect(33, 20, 38, 20, 'r');                                       // 蘆葦叢：看起來擋路，其實走得過去（秘密入口）
rect(35, 23, 37, 26, '~');                                       // 隱藏池塘
rect(3, 5, 8, 8, 'H'); rect(5, 8, 6, 8, 'd');                    // 成就小屋與門口

export const town = {
  id: 'town',
  legend: {
    '.': { solid: false, color: '#7fb069', name: '草地' },
    '#': { solid: true, color: '#2f5d3a', name: '樹牆' },
    's': { solid: false, color: '#b8b3c4', name: '石地板' },
    '~': { solid: true, color: '#4f8fc0', name: '水' },
    '=': { solid: false, color: '#a47148', name: '橋' },
    'r': { solid: false, color: '#3a6b45', name: '蘆葦' },
    'H': { solid: true, color: '#b5651d', name: '小屋' },
    'd': { solid: false, color: '#5d4037', name: '門口' },
  },
  rows: g.map((r) => r.join('')),
  spawn: { x: 20.5, y: 24.5 },
  /* 傳送地圖上的地點。secret 是要先達成的旗標（沒達成就不顯示） */
  landmarks: [
    { id: 'plaza', name: '中央草地', x: 20.5, y: 24.5 },
    { id: 'tree', name: '許願樹', x: 20, y: 18.5 },
    { id: 'hall', name: '召喚卡殿', x: 20, y: 8.5 },
    { id: 'hut', name: '成就小屋', x: 6, y: 9.5 },
    { id: 'farm', name: '農田', x: 6.5, y: 19.5 },
    { id: 'stream', name: '溪邊釣點', x: 30.5, y: 20.5 },
    { id: 'pond', name: '魚魚的池塘', x: 34.5, y: 25.5, secret: 'fishFound' },
  ],
  objects: [
    { id: 'board', type: 'board', x: 22, y: 23, solid: true,
      lines: ['【公告欄】', '歡迎來到沉魚的小鎮。', '北邊是召喚卡殿，中間是許願樹，西邊有田，西北有成就小屋。', '溪邊可以釣魚。聽說許願樹搖一搖會掉東西。', '天黑之後草地上會有蟲。按住 Shift 慢慢靠近才抓得到。', '按 M 可以打開地圖直接傳送。'] },
    { id: 'tree', type: 'tree', x: 19, y: 16, w: 2, h: 2, solid: true },
    { id: 'altar', type: 'altar', x: 19, y: 5, w: 2, h: 2, solid: true },

    { id: 'plot0', type: 'plot', x: 5, y: 20, index: 0 },
    { id: 'plot1', type: 'plot', x: 6, y: 20, index: 1 },
    { id: 'plot2', type: 'plot', x: 7, y: 20, index: 2 },
    { id: 'plot3', type: 'plot', x: 5, y: 21, index: 3 },
    { id: 'plot4', type: 'plot', x: 6, y: 21, index: 4 },
    { id: 'plot5', type: 'plot', x: 7, y: 21, index: 5 },

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
    { id: 'bug3', type: 'bugspot', x: 36, y: 12 },
    { id: 'bug4', type: 'bugspot', x: 15, y: 13 },

    { id: 'lantern1', type: 'lantern', x: 17, y: 13, solid: true },
    { id: 'lantern2', type: 'lantern', x: 22, y: 13, solid: true },
    { id: 'lantern3', type: 'lantern', x: 12, y: 19, solid: true },
    { id: 'lantern4', type: 'lantern', x: 28, y: 19, solid: true },
  ],
};
