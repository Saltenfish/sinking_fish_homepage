/* ============================================================
   素材清單 —— 把圖檔接進網站的唯一入口（詳細規格見 docs/ASSETS.md）

   用法：把圖檔放進 assets/ 資料夾，然後在下面對應的鍵填上路徑。
         沒填（或圖檔載入失敗）的項目會自動用佔位色塊，網站不會壞。

   值可以是：
     'assets/tiles/grass.png'                          一張靜態圖
     'https://.../grass.png'                           外部網址（必須是 https）
     { src: '...', frameW: 32, frameH: 32, frames: 4, fps: 6 }   動畫（橫向排列的連續影格）

   鍵的命名規則：
     tile.<名稱>        地圖圖塊。名稱是 maps/town.js 的 legend 裡的 key（grass / wall / stone / water / bridge / reed / hut / door）
     ent.<類型>         地圖物件。類型見 js/world/types.js（board / tree / altar / plot / fishspot / pond / bush / dig / lantern / hut / offering / bugspot / market / casino / tank）
     player             玩家行走圖。四列依序是 下、左、右、上，每列 frames 格
     tree.bg            許願樹畫面的整張底圖（比例 900:540）
     tree.plaque        許願牌的圖
     card.back.<花色>   卡背。花色：default / sakura / tide / star
     item.<物品id>      物品小圖示（背包、商店用）
     fish.<物品id>      魚缸與釣魚畫面裡的魚（沒填會退回 item.<物品id>）
     scene.<畫面>       全螢幕畫面的背景：ring / tree / fishing / market / casino / tank / hut / offerings / bag / map
     fx.summon.<階段>   召喚特效的圖：charge / beam / flash / flip / reveal
============================================================ */

/* 所有相對路徑前面會加上這個前綴。留空 = 相對於網站根目錄。
   如果素材放在別的地方（例如另一個 repo 的 GitHub Pages），填 'https://saltenfish.github.io/某個repo/' */
export const ASSET_BASE = '';

export const assets = {
  // 範例（把前面的 // 拿掉並放入圖檔即可生效）：
  // 'tile.grass': 'assets/tiles/grass.png',
  // 'tile.water': { src: 'assets/tiles/water.png', frameW: 32, frameH: 32, frames: 4, fps: 4 },
  // 'player': { src: 'assets/sprites/player.png', frameW: 32, frameH: 32, frames: 4, fps: 8 },
  // 'tree.bg': 'assets/scenes/wish-tree.png',
  // 'card.back.default': 'assets/cards/back-default.png',
};
