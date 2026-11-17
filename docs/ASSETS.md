# 素材指南

這份文件說明三件事：**要準備哪些圖**、**去哪裡免費做或找像素圖**、**做好之後怎麼交給網站**。

網站沒有任何素材也能運作（全部用佔位色塊）。圖是一張一張接上去的，接一張換一張，不需要一次到位。

## 一、怎麼把圖接上網站

所有素材只有一個入口：`js/data/assets.js`。每一行是「素材鍵 → 圖檔位置」。

```js
export const assets = {
  'tile.grass': 'assets/tiles/grass.png',
  'player': { src: 'assets/sprites/player.png', frameW: 32, frameH: 32, frames: 4, fps: 8 },
  'tree.bg': 'assets/scenes/wish-tree.png',
};
```

圖檔位置有三種給法，擇一即可：

| 方式 | 怎麼做 | 適合 |
|---|---|---|
| **A. 放進這個 repo** | 把圖檔放到 `assets/` 底下對應的資料夾（GitHub 網頁上可以直接拖曳上傳），清單填相對路徑，例如 `assets/tiles/grass.png` | 最簡單，建議的做法 |
| **B. 另開一個素材 repo** | 素材放在另一個開了 GitHub Pages 的 repo，把 `assets.js` 最上面的 `ASSET_BASE` 設成 `https://saltenfish.github.io/那個repo/`，清單填該 repo 內的相對路徑 | 圖很多、想跟程式分開管理 |
| **C. 直接貼網址** | 清單直接填完整的 `https://…/xxx.png` | 臨時測試 |

規則：
- 只接受 `https` 網址，或不含 `..` 的相對路徑；副檔名限 `png`、`webp`、`gif`、`jpg`、`svg`。像素圖請用 **PNG**。
- 檔名只用英數字、`-`、`_`（不要中文與空白）。
- 沒填、路徑寫錯、圖檔不存在：該項目自動退回佔位色塊，並在瀏覽器主控台（F12）印出是哪一項。
- 方式 C 的網址必須是「圖檔本身」的直連。Google Drive、Imgur 相簿頁、Discord 附件這類分享頁或會過期的連結不能用。

**交給 AI 幫忙接的時候**，只要提供：圖檔（或它在 repo 裡的路徑）＋ 它是什麼（對照下面的素材鍵）＋ 如果是動畫，一格的寬高與格數。

資料夾慣例：

```
assets/tiles/     地圖圖塊          assets/sprites/   人物、地圖物件、魚
assets/cards/     卡背、卡面 Q 圖   assets/ui/        物品圖示、許願牌
assets/scenes/    全螢幕畫面背景    assets/fx/        召喚特效
```

## 二、素材清單與規格

地圖一格是 **32×32 像素**。用 16×16 畫也可以（會整數倍放大，維持銳利），但同一類請統一尺寸。
動畫一律是**橫向排列的連續影格**（一張圖由左到右是第 1、2、3… 格）。

圖塊也可以做成**變化款**：同樣橫向排幾格，清單加上 `variants: true`。地圖上每一格會固定挑其中一款（不播放），草地這種大面積的圖塊這樣做才不會整片一模一樣。

```js
'tile.grass': { src: 'assets/tiles/grass.png', frameW: 32, frameH: 32, frames: 8, variants: true },
```

### 地圖圖塊（`tile.<名稱>`，一格 32×32，要能無縫拼接）

| 鍵 | 內容 | 備註 |
|---|---|---|
| `tile.grass` | 草地 | 面積最大，優先做 |
| `tile.wall` | 外圍的樹牆 | 擋路 |
| `tile.hallwall` | 召喚卡殿的石牆 | 擋路 |
| `tile.stone` | 召喚卡殿的石地板 | |
| `tile.water` | 溪水、池塘 | 建議做 4 格動畫 |
| `tile.bridge` | 橋面 | |
| `tile.reed` | 蘆葦叢 | **要看起來像走不過去**（其實是隱藏入口） |
| `tile.hut` | 成就小屋的牆與屋頂 | |
| `tile.door` | 小屋門口的地面 | |

### 玩家（`player`）

一張圖，**4 列**，由上到下依序是：朝下、朝左、朝右、朝上；每列是該方向的行走影格。
建議每格 32×32、每列 4 格（整張 128×128）。站著不動時顯示每列的第 1 格。

```js
'player': { src: 'assets/sprites/player.png', frameW: 32, frameH: 32, frames: 4, fps: 8 },
```

### 地圖物件（`ent.<類型>`）

尺寸是「佔幾格 × 32」。圖會被縮放到剛好填滿物件所佔的格子。

| 鍵 | 內容 | 佔格 | 像素 |
|---|---|---|---|
| `ent.board` | 公告欄 | 1×1 | 32×32 |
| `ent.tree` | 地圖上的許願樹（點進去才是大圖） | 2×2（圖是 3×3） | 96×96 |
| `ent.altar` | 召喚法陣 | 2×2 | 64×64 |
| `ent.plot.empty` / `ent.plot.growing` / `ent.plot.ripe` | 農田的三種狀態 | 1×1 | 32×32 |
| `ent.lantern.lit` | 點亮的石燈 | 1×1 | 32×32 |
| `ent.dig.used` | 挖過的坑 | 1×1 | 32×32 |
| `ent.pond.found` | 找到魚魚之後的池塘 | 1×1 | 32×32 |
| `ent.fishspot` | 釣魚點的標示 | 1×1 | 32×32 |
| `ent.pond` | 池塘邊的互動點 | 1×1 | 32×32 |
| `ent.bush` | 草叢 | 1×1 | 32×32 |
| `ent.dig` | 挖掘點 | 1×1 | 32×32 |
| `ent.lantern` | 石燈 | 1×1 | 32×32 |
| `ent.hut` | 小屋的門 | 2×1 | 64×32 |
| `ent.offering` | 供奉石 | 1×1 | 32×32 |
| `ent.bugspot` | 蟲 | 1×1 | 32×32，建議做動畫 |
| `ent.market` | 商店 | 2×2 | 64×64 |
| `ent.casino` | 小賭場 | 2×2 | 64×64 |
| `ent.tank` | 魚缸 | 2×1 | 64×32 |

### 大型佈景與超出佔地的圖

- **整棟建築**（`decor.<名稱>`）：一整張圖蓋在地圖上，位置寫在 `maps/town.js` 的 `decor`（`{ id, x, y, w, h, sprite }`，單位是格）。只是畫面，不影響能不能走；擋路與否仍由底下的圖塊決定。目前有 `decor.hut`（成就小屋，6×4 格，正中間下方兩格留空給門）。
- **圖比佔地大的物件**：地圖物件加 `art: { x, y, w, h }`，圖就會畫在這個範圍（相對於物件左上角）。例如許願樹佔 2×2 格，但 `art: { x: -0.5, y: -1, w: 3, h: 3 }` 讓 96×96 的樹冠往上伸出去；石柱佔 1 格、圖高 2 格。
- **前後遮擋**：除了貼地的物件（農田、法陣、挖掘點、掛旗），其他東西依腳底位置排序，人物走到樹後面會被樹冠擋住。

### 卡殿的裝飾

| 鍵 | 內容 | 規格 |
|---|---|---|
| `ent.pillar` | 石柱 | 32×64（佔 1 格，往上高 1 格） |
| `ent.banner` | 牆上的掛旗 | 32×64 |

### 暫用的像素圖

`tools/make_pixel_assets.py` 會用程式畫出目前所有地圖圖塊、成就小屋、地圖物件；`tools/make_pixel_scenes.py` 畫出四種卡背（漩渦中浮出一隻鴨子）、許願樹大圖（中間一整根實心的樹幹，往上分成粗枝向外擴散，葉子在枝條末端，背景透明）、各個全螢幕畫面的背景。兩支都輸出到 `assets/`，並已填進 `js/data/assets.js`。

`make_pixel_scenes.py` 執行完會印出許願牌的掛點座標，這組座標已經放進 `js/systems/treeLayout.js`；之後換了自己的樹，要依自己的枝條位置改這組座標。
這些是暫用的：換成自己的圖時，覆蓋同名檔案或在清單改路徑即可。**換過之後就不要再執行那支程式**，否則會被蓋回去。

### 許願樹畫面

| 鍵 | 內容 | 規格 |
|---|---|---|
| `tree.bg` | 整棵樹的大圖（含樹冠、枝條、背景） | 比例 **900:540**（5:3）。像素風建議畫 450×270 或 900×540 |
| `tree.plaque` | （可選）一塊空白的許願牌圖，文字由網站疊上去。沒填就用網站內建的淡色卡片樣式 | 比例 **72:100**，例如 36×50 |

許願牌會用繩子掛在固定的「掛點」上。目前 14 個掛點的座標在 `js/systems/treeLayout.js`（以 900×540 為基準，
`x, y` 是繩子綁在枝條上的位置，`len` 是繩長）。**換上自己的樹之後，把這張表改成對應你枝條位置的座標即可**，
其他程式不用動。畫樹的時候，請讓枝條下方留有掛牌子的空間。

### 卡片

| 鍵 | 內容 | 規格 |
|---|---|---|
| `card.back.default` | 預設卡背 | 比例 **84:124**，例如 84×124 或 42×62 |
| `card.back.sakura` / `card.back.tide` / `card.back.star` | 供奉石換到的三種卡背 | 同上 |
| （卡面 Q 圖） | 每個角色的圖 | 不走素材清單，直接填在 `js/data/characters.js` 該角色的 `image` 欄位。建議 WebP，寬約 400 像素 |

### 物品與魚

| 鍵 | 內容 | 規格 |
|---|---|---|
| `item.<物品id>` | 背包與商店裡的小圖示。物品 id 見 `js/data/items.js`（例：`item.feed`、`item.seed_turnip`、`item.fish_koi`） | 正方形，16×16 或 32×32 |
| `fish.<物品id>` | 魚缸與釣魚畫面裡的魚（側面、**頭朝右**）。沒填會退回 `item.<物品id>` | 正方形，32×32 或 64×64 |

### 全螢幕畫面背景（`scene.<畫面>`）

背景會以「填滿、置中、裁切多餘部分」的方式顯示，請把重點放在畫面中央。建議 16:9（例如 480×270，會放大顯示）。

`scene.ring`（召喚卡殿）`scene.card`（單張卡片）`scene.tree`（許願樹外框）`scene.fishing`（釣魚，目前由程式畫水面）
`scene.market`（商店）`scene.casino`（小賭場）`scene.tank`（魚缸）`scene.hut`（成就小屋）`scene.offerings`（供奉石）
`scene.bag`（背包）`scene.map`（地圖）`scene.list`（快速目錄）`scene.menu`（選單）`scene.fishchat`（魚魚）

### 召喚特效（`fx.summon.<階段>`）

召喚時依序播放：`charge`（蓄力）→ `beam`（光柱）→ `flash`（只有 SSR）→ `flip`（翻面）→ `reveal`（亮相）。
每個階段可以各配一張置中顯示的圖（靜態或動畫皆可）。各階段的長度、各稀有度的差異在 `js/data/summonFx.js`。
更細緻的效果（縮放、位移、發光）寫在 `css/base.css` 的 `.sfx[data-step=…]`，每個階段的進度會以 CSS 變數 `--p`（0→1）提供。

## 三、免費的像素圖工具

| 工具 | 類型 | 特點 |
|---|---|---|
| [Piskel](https://www.piskelapp.com) | 瀏覽器，免安裝 | 免費開源，專門做動畫角色與圖塊，有即時預覽。最容易上手 |
| [Pixilart](https://www.pixilart.com) | 瀏覽器，免安裝 | 免費（有廣告），附社群與教學，適合練習 |
| [Pixelorama](https://pixelorama.org) | 桌面版與瀏覽器版 | 免費開源，功能最完整：圖層、洋蔥皮動畫、圖塊模式、調色盤 |
| [LibreSprite](https://libresprite.github.io) | 桌面版 | 免費開源，從 Aseprite 舊版分支出來，操作幾乎相同 |
| GraphicsGale | Windows 桌面版 | 老牌工具，現在免費 |
| [Tiled](https://www.mapeditor.org) | 桌面版 | 免費的**地圖編輯器**（不是畫圖工具）。之後想用拖拉的方式排地圖時使用 |
| [Lospec](https://lospec.com) | 網站 | 現成的調色盤（先選一組色，整體風格才會一致），以及像素圖軟體總覽 |

建議的起步方式：用 Piskel 或 Pixelorama，先到 Lospec 挑一組 16–32 色的調色盤，全部素材都只用這組顏色。

## 四、免費的現成素材

| 來源 | 授權 | 說明 |
|---|---|---|
| [Kenney](https://kenney.nl/assets) | **CC0**（公眾領域，不需標示出處、可任意修改） | 數量最多、風格一致，最省事。有俯視角 RPG 用的圖塊包 |
| [itch.io 的 CC0 素材區](https://itch.io/game-assets/assets-cc0) | CC0 | 許多作者釋出的完整素材包，可用 tileset、top-down 等標籤篩選 |
| [OpenGameArt](https://opengameart.org) | 各不相同（CC0、CC-BY、CC-BY-SA、GPL…） | 量很大，**下載前一定要看該頁的授權**；搜尋時可用授權篩選 |
| [Game-icons.net](https://game-icons.net) | CC BY 3.0（**必須標示出處**） | 大量單色圖示，可當物品圖示的底稿 |

使用現成素材的注意事項：
- **CC0** 最單純，可以直接用、可以改。
- **CC-BY** 要標示作者；**CC-BY-SA** 除了標示作者，改作後也要用相同授權釋出。用了這類素材，請在 `README.md` 加一段「素材出處」。
- 標示「免費」但沒有寫明授權的素材包，請先看作者頁面的使用條款（有些禁止再散布，放在公開 repo 裡就算再散布）。
- 授權條款可能更新，以各素材頁面當下的標示為準。
- 混用不同來源的素材時，尺寸（16 或 32）、視角（俯視）與調色盤要盡量一致，否則會很雜。

## 五、建議的製作順序

1. `tile.grass`、`tile.wall`、`tile.water`、`tile.stone`：地圖馬上不一樣。
2. `player`：四方向行走圖。
3. `card.back.default` 與角色卡面 Q 圖：網站的主角。
4. `tree.bg`（可再加 `tree.plaque`），並調整掛點座標。
5. 地圖物件（`ent.*`）。
6. 物品圖示、魚、場景背景、召喚特效。
