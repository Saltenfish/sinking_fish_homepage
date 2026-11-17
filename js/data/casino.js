/* 小賭場設定（只用遊戲內金幣）。開機時會檢查期望值必須小於 1。
   bets：可以押的金額
   dice：兩顆骰子。side = 猜大或猜小中了的倍率；seven = 猜「七」中了的倍率
   slot：拉霸。symbols 的 weight 越大越常出現；triple = 三個一樣的倍率；pair = 兩個一樣的倍率 */
export const casino = {
  bets: [10, 50, 100],
  dice: { side: 2, seven: 5 },
  slot: {
    pair: 0.5,
    symbols: [
      { id: 'fish', icon: '🐟', weight: 5, triple: 4 },
      { id: 'clover', icon: '🍀', weight: 4, triple: 8 },
      { id: 'star', icon: '⭐', weight: 3, triple: 15 },
      { id: 'bell', icon: '🔔', weight: 2, triple: 40 },
      { id: 'seven', icon: '７', weight: 1, triple: 150 },
    ],
  },
};
