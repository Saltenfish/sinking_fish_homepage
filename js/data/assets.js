/* ============================================================
   素材清單 —— 把圖檔接進網站的唯一入口（詳細規格見 docs/ASSETS.md）

   用法：把圖檔放進 assets/ 資料夾，然後在下面對應的鍵填上路徑。
         沒填（或圖檔載入失敗）的項目會自動用佔位色塊，網站不會壞。

   值可以是：
     'assets/tiles/grass.png'                          一張靜態圖
     'https://.../grass.png'                           外部網址（必須是 https）
     { src: '...', frameW: 32, frameH: 32, frames: 4, fps: 6 }   動畫（橫向排列的連續影格）
     { src: '...', frameW: 32, frameH: 32, frames: 6, variants: true }   變化款：每一格地圖固定挑一款，不播放

   鍵的命名規則：
     tile.<名稱>        地圖圖塊。名稱是 maps/town.js 的 legend 裡的 key（grass / wall / hallwall / stone / water / bridge / reed / hut / door）
     decor.<名稱>       大型佈景（整棟建築外觀），位置寫在 maps/town.js 的 decor
     ent.<類型>         地圖物件。類型見 js/world/types.js（board / tree / altar / plot / fishspot / pond / bush / dig / lantern / hut / offering / bugspot / market / casino / tank）
                        有狀態的物件另有：ent.plot.empty|growing|ripe、ent.lantern.lit、ent.dig.used、ent.pond.found
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
  /* ── 以下由 tools/make_pixel_assets.py 產生的暫用像素圖（重新執行該程式會覆蓋這些檔案）──
     換成自己的圖：把路徑改成你的檔案即可。variants: true 代表橫排的是「變化款」而不是動畫 */
  'tile.grass': { src: 'assets/tiles/grass.png', frameW: 32, frameH: 32, frames: 6, variants: true },
  'tile.wall': { src: 'assets/tiles/forest.png', frameW: 32, frameH: 32, frames: 3, variants: true },
  'tile.stone': { src: 'assets/tiles/stone.png', frameW: 32, frameH: 32, frames: 3, variants: true },
  'tile.hallwall': { src: 'assets/tiles/hallwall.png', frameW: 32, frameH: 32, frames: 2, variants: true },
  'tile.water': { src: 'assets/tiles/water.png', frameW: 32, frameH: 32, frames: 4, fps: 3 },
  'tile.bridge': 'assets/tiles/bridge.png',
  'tile.reed': { src: 'assets/tiles/reed.png', frameW: 32, frameH: 32, frames: 2, variants: true },
  'tile.hut': 'assets/tiles/roof.png',
  'tile.door': 'assets/tiles/door.png',
  'decor.hut': 'assets/decor/hut.png',
  'ent.hut': 'assets/sprites/hut-door.png',
  'ent.tree': 'assets/sprites/wish-tree.png',
  'ent.altar': 'assets/sprites/altar.png',
  'ent.pillar': 'assets/sprites/pillar.png',
  'ent.banner': 'assets/sprites/banner.png',
  'ent.market': 'assets/sprites/market.png',
  'ent.casino': 'assets/sprites/casino.png',
  'ent.tank': 'assets/sprites/tank.png',
  'ent.board': 'assets/sprites/board.png',
  'ent.bush': 'assets/sprites/bush.png',
  'ent.dig': 'assets/sprites/dig.png',
  'ent.dig.used': 'assets/sprites/dig-used.png',
  'ent.lantern': 'assets/sprites/lantern.png',
  'ent.lantern.lit': 'assets/sprites/lantern-lit.png',
  'ent.plot.empty': 'assets/sprites/plot-empty.png',
  'ent.plot.growing': 'assets/sprites/plot-growing.png',
  'ent.plot.ripe': 'assets/sprites/plot-ripe.png',
  'ent.fishspot': 'assets/sprites/fishspot.png',
  'ent.pond': 'assets/sprites/pond.png',
  'ent.pond.found': 'assets/sprites/pond-found.png',
  'ent.offering': 'assets/sprites/offering.png',
  'ent.bugspot': { src: 'assets/sprites/bug.png', frameW: 32, frameH: 32, frames: 4, fps: 5 },

  /* ── 以下由 tools/make_pixel_scenes.py 產生 ── */
  'card.back.default': 'assets/cards/back-default.png',
  'card.back.sakura': 'assets/cards/back-sakura.png',
  'card.back.tide': 'assets/cards/back-tide.png',
  'card.back.star': 'assets/cards/back-star.png',
  'tree.bg': 'assets/scenes/wish-tree.png',
  'tree.plaque': 'assets/ui/plaque.png',
  'scene.ring': 'assets/scenes/ring.png',
  'scene.card': 'assets/scenes/card.png',
  'scene.tree': 'assets/scenes/tree.png',
  'scene.market': 'assets/scenes/market.png',
  'scene.casino': 'assets/scenes/casino.png',
  'scene.hut': 'assets/scenes/hut.png',
  'scene.offerings': 'assets/scenes/offerings.png',
  'scene.bag': 'assets/scenes/bag.png',
  'scene.map': 'assets/scenes/map.png',
  'scene.list': 'assets/scenes/list.png',
  'scene.menu': 'assets/scenes/menu.png',
  'scene.fishchat': 'assets/scenes/fishchat.png',

  // 範例（把前面的 // 拿掉並放入圖檔即可生效）：
  // 'tile.grass': 'assets/tiles/grass.png',
  // 'tile.water': { src: 'assets/tiles/water.png', frameW: 32, frameH: 32, frames: 4, fps: 4 },
  // 'player': { src: 'assets/sprites/player.png', frameW: 32, frameH: 32, frames: 4, fps: 8 },
  // 'tree.bg': 'assets/scenes/wish-tree.png',
  // 'card.back.default': 'assets/cards/back-default.png',
};
