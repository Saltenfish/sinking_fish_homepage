/* ============================================================
   可以走進去的房間：背景圖、房間裡可以點的東西放在哪裡
   座標都以 480 × 270 的房間圖為準（像素），網頁會整張等比例放大。
   圖檔的素材鍵在 data/assets.js（room.* 與 trophy.*），由 tools/make_pixel_rooms.py 產生。
============================================================ */

/* 賭場大廳：四種遊戲。x, y, w, h 是那張家具圖在房間裡的位置與大小 */
export const CASINO_HALL = {
  bg: 'room.casino',
  spots: [
    { id: 'slot', name: '拉霸機', sprite: 'room.casino.slots', x: 18, y: 30, w: 150, h: 110 },
    { id: 'wheel', name: '幸運轉盤', sprite: 'room.casino.wheel', x: 366, y: 26, w: 96, h: 120 },
    { id: 'blackjack', name: '21 點', sprite: 'room.casino.bj', x: 60, y: 150, w: 170, h: 100 },
    { id: 'dice', name: '骰子', sprite: 'room.casino.dice', x: 300, y: 160, w: 130, h: 80 },
  ],
};

/* 各遊戲的近景裡，東西放在哪裡 */
export const SLOT = {
  bg: 'room.slot', reels: { x: 166, y: 82, w: 46, h: 66, gap: 4 }, sign: { x: 176, y: 24, w: 128, h: 30 },
  buttons: { x: 166, y: 172, w: 24, h: 14, step: 40 }, lever: { x: 345, y: 20, w: 30, h: 110 },
  tray: { x: 166, y: 214, w: 148, h: 34 },
};
export const BLACKJACK = {
  bg: 'room.bj', shoe: { x: 46, y: 122 }, dealerRow: { x: 186, y: 120 }, playerRow: { x: 186, y: 178 }, card: { w: 30, h: 42, step: 34 },
  bubble: { x: 280, y: 22 }, chips: { x: 40, y: 212 }, actions: { x: 312, y: 206 }, tray: { x: 392, y: 212, w: 66, h: 34 },
};
export const DICE = {
  bg: 'room.dice', cup: { x: 192, y: 40, w: 96, h: 100 }, dice: [{ x: 210, y: 92 }, { x: 242, y: 100 }],
  zones: [{ pick: 'small', x: 40, y: 168, w: 130, h: 78 }, { pick: 'seven', x: 190, y: 168, w: 100, h: 78 }, { pick: 'big', x: 310, y: 168, w: 130, h: 78 }],
  chips: { x: 32, y: 32 }, tray: { x: 380, y: 32, w: 66, h: 34 },
};
export const WHEEL = {
  bg: 'room.wheel', disc: { x: 130, y: 12, w: 220, h: 220 }, pointer: { x: 225, y: 0, w: 30, h: 34 },
  spin: { x: 206, y: 236, w: 68, h: 24 }, chips: { x: 24, y: 200 }, tray: { x: 392, y: 212, w: 66, h: 34 },
};

/* 成就小屋：兩座書架（和 tools/make_pixel_rooms.py 的 CASES、SHELF_TOPS 一致） */
export const HUT = {
  bg: 'room.hut',
  size: { w: 480, h: 270 },
  // perShelf：每層放幾個（成就、收藏）
  cases: [{ x0: 18, y0: 26, x1: 206, y1: 252, title: '成就', shelves: [80, 132, 184, 236], perShelf: 6 },
    { x0: 274, y0: 26, x1: 462, y1: 252, title: '收藏', shelves: [80, 132, 184, 236], perShelf: 7 }],
  shelfTops: [80, 132, 184, 236],
  notebook: { x: 222, y: 182, w: 36, h: 18 },
  noteBox: { w: 170, y: 96 },
  trophyKinds: ['cup', 'medal', 'star', 'scroll'],
  collectCats: ['treasure', 'fish', 'bug', 'crop'],
};

/* 手機直拿用的成就小屋：兩座書架上下疊，整間一頁看完（圖：assets/rooms/hut-room-tall.png） */
export const HUT_TALL = {
  ...HUT,
  bg: 'room.hut.tall',
  size: { w: 270, h: 480 },
  cases: [{ x0: 14, y0: 30, x1: 256, y1: 216, title: '成就', shelves: [76, 122, 168, 210], perShelf: 7 },
    { x0: 14, y0: 246, x1: 256, y1: 424, title: '收藏', shelves: [290, 334, 378, 418], perShelf: 8 }],
  notebook: { x: 117, y: 434, w: 36, h: 18 },
  noteBox: { w: 200, y: 150 },
};
