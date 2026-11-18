/* 小賭場設定（只用遊戲內金幣）。四種遊戲：拉霸、21 點、骰子、幸運轉盤。開機時會檢查期望值必須小於 1。
   bets：可以押的金額
   dice：兩顆骰子。side = 猜大或猜小中了的倍率；seven = 猜「七」中了的倍率
   slot：拉霸。symbols 的 weight 越大越常出現；triple = 三個一樣的倍率；pair = 兩個一樣的倍率
         id 對應圖示 assets/ui/slot-<id>.png；name 是說明文字用的名稱；icon 是圖示載入失敗時顯示的文字 */
export const casino = {
  bets: [10, 50, 100],
  dice: { side: 2, seven: 5 },
  /* 幸運轉盤：每一格的機率相同，mult 是倍率（含本金；0 = 沒中）。所有 mult 的平均必須小於 1 */
  wheel: {
    segments: [
      { mult: 0 }, { mult: 2 }, { mult: 0 }, { mult: 1 }, { mult: 0 }, { mult: 3 },
      { mult: 0 }, { mult: 0.5 }, { mult: 0 }, { mult: 5 }, { mult: 0 }, { mult: 0 },
    ],
  },
  /* 21 點：win 贏的倍率、push 平手（退回本金）、natural 一開始就 21 點；hitSoft17 莊家拿到軟 17 要不要再補牌 */
  blackjack: { win: 2, push: 1, natural: 2, hitSoft17: true },
  slot: {
    pair: 0.5,
    symbols: [
      { id: 'fish', name: '魚', icon: '🐟', weight: 5, triple: 4 },
      { id: 'clover', name: '幸運草', icon: '🍀', weight: 4, triple: 8 },
      { id: 'star', name: '星星', icon: '⭐', weight: 3, triple: 15 },
      { id: 'bell', name: '鈴鐺', icon: '🔔', weight: 2, triple: 40 },
      { id: 'seven', name: '７', icon: '７', weight: 1, triple: 150 },
    ],
  },
};
