# 給接手這個專案的 AI／開發者

這份文件是**交接說明**。動手之前請讀完「必守規則」與「架構」兩節；要加內容時查「常見工作」。
給人看的簡介在 `README.md`，素材規格在 `docs/ASSETS.md`。

## 這是什麼

`sinking_fish_homepage` 是一個**純靜態、無打包**的網站（GitHub Pages）。訪客操作小人在像素小鎮上走動，
目的有兩個：瀏覽站主在 Caveduck 上的**角色卡**（召喚卡殿），以及前往站主其他的 **GitHub 網站**（許願樹上的許願牌）。
其餘玩法（種田、釣魚、捕蟲、商店、小賭場、魚缸、成就）是為了讓逛的過程有趣。

- 技術：原生 JavaScript（ES Modules）＋ CSS，沒有框架、沒有相依套件、沒有建置步驟。
- 地圖用 Canvas 畫；所有介面（對話框、全螢幕畫面）用 DOM 疊在上面。
- 進度存在訪客自己的瀏覽器（localStorage），沒有伺服器、沒有帳號。
- 介面文字與程式註解一律使用**繁體中文**。

## 必守規則

1. **資料與程式分離。** 角色、網站、物品、價格、機率、時間、台詞全部放在 `js/data/` 或 `js/fish/words-home.js`。
   程式裡不可以寫死任何一個角色、網站或數值；可調數值放 `js/config.js`。
2. **`js/systems/`、`js/core/`、`js/fish/brain.js` 不可以碰 DOM、不可以直接呼叫 `Date.now()` 或 `Math.random()`。**
   時間（`now`）與亂數（`rng`）一律由外部傳入，這樣才能測試。畫面相關的東西只放在 `js/ui/` 與 `js/engine/renderer.js`。
3. **系統之間不直接互相呼叫畫面。** 用事件匯流排 `bus` 通知（事件一覽見下）。地圖物件要開畫面時呼叫 `game.ui.show('名稱')`。
4. **存檔一律即時取值：`save.data.xxx`。** 不要把 `save.data` 的子物件存成自己的變數（匯入、重置時整份會換掉）。
   改完存檔內容要呼叫 `save.commit()`。
5. **存檔要向後相容。** 新增欄位時在 `core/save.js` 的 `blankSave()` 給預設值、在 `normalize()` 加檢查即可，不用升版。
   只有「改變既有欄位的意義或結構」才把 `SAVE_VERSION` 加一並在 `MIGRATIONS` 補一條轉換函式。
   角色、物品、成就的 `id` 上線後**不可以改名**。
6. **所有角色卡從一開始就能召喚、所有網站連結隨時可達。** 收集玩法只影響紀錄與外觀，不可以把連結鎖在進度後面。
   「快速目錄」（L 鍵）必須永遠列出全部連結。
7. **壞資料不可以讓網站掛掉。** 資料由 `core/registry.js` 在開機時檢查，不合格的項目略過並在主控台說明原因。
   新增資料種類時，要一併在 registry 加檢查。
8. **安全。** 顯示文字只用 `textContent`（透過 `ui/dom.js` 的 `h()`），不使用 `innerHTML`。
   對外連結先經過 `safeUrl()`，並帶 `rel="noopener noreferrer"`。素材路徑經過 `resolveSrc()`。
9. **經濟不可以被套利。** 商店買價必須高於賣價；賭場每個玩法的期望值必須小於 1。這兩件事開機時會檢查，測試也會擋。
   賭場只使用遊戲內金幣，不可以接任何真實金流。
10. **效能。** 動畫只動 `transform` / `opacity`；Canvas 只畫鏡頭內的東西；長列表只建立看得到的元素（參考卡環）；
    需要時間推進的東西（作物、魚缸）用時間戳計算，不要開計時器輪詢。尊重 `prefers-reduced-motion`。
11. **每次修改都要：** 跑 `npm test` 全數通過 → 開分支 → 推上去 → 開 Pull Request。不要直接推 `main`。
    新增或修改規則時，同一個 PR 內要有對應的測試。

## 怎麼跑

```
python -m http.server 8000      # 開 http://localhost:8000 （不能直接雙擊 index.html）
npm test                        # node --test，需要 Node 20+，無相依套件
```

除錯：瀏覽器主控台輸入 `__sfh` 可取得 `game` 物件（所有系統）。網址加 `?hour=22` 可固定時間預覽（0–24，可含小數）。

## 架構

```
index.html              空殼：一個 <canvas id="game"> 加一層介面
css/base.css            所有樣式（骨架階段，視覺是佔位）
js/main.js              進入點：建立所有系統並接線。新系統、新畫面都要在這裡註冊
js/config.js            可調數值
js/core/
  events.js             事件匯流排 createBus()
  save.js               存檔：版本、升級、normalize、延遲寫入、匯出匯入
  registry.js           開機資料檢查，產生 reg（所有資料的查詢入口）
  assets.js             素材載入器（用到才載入，失敗回傳 null）
  util.js               safeUrl、weighted、randInt、pick…
js/data/                ★ 內容都在這裡 ★
  characters.js         角色卡            sites.js        許願牌（網站）
  items.js              物品（含賣價）    crops.js        作物
  loot.js               掉落表（釣魚、搖樹、草叢、挖掘、捕蟲）
  achievements.js       成就              offerings.js    供奉石可換的卡背
  market.js             商店商品          casino.js       賭場賠率
  time.js               時段與天色        summonFx.js     召喚特效時間軸
  assets.js             素材清單          maps/town.js    地圖、物件、傳送地點
js/systems/             遊戲規則（純邏輯）
  progress.js           統計 stat / 旗標 flag / 冷卻 cooldown
  inventory.js          背包              cards.js        卡片收集
  ringModel.js          卡環轉動          farm.js         農田（時間戳）
  fishing.js            釣魚狀態機        bugs.js         捕蟲判定
  shop.js               供奉石與卡背      wallet.js       金幣
  market.js             商店買賣          casino.js       賭場（含期望值計算）
  tank.js               魚缸              summonFx.js     召喚特效時間軸
  achievements.js       成就判定          clock.js        時段與天色
  loot.js               掉落抽選          treeLayout.js   許願樹掛點
js/fish/                魚魚（隱藏角色，用到才動態載入）
  index.js              對外窗口          brain.js        回覆引擎與語氣規則
  words-home.js         詞庫
js/engine/              地圖引擎
  loop.js input.js view.js camera.js tilemap.js collision.js pathfind.js renderer.js
js/world/
  world.js              地圖、玩家、互動判定、點擊移動、傳送
  types.js              ★ 地圖物件類型註冊處 ★
js/ui/
  ui.js                 視窗堆疊、say / choose / panel（全螢幕畫面）/ overlay / toast
  dom.js icon.js touch.js
  *View.js              各個畫面，一個檔一個畫面
tests/                  node --test。helpers.js 的 makeGame() 可組出一套不需瀏覽器的系統
docs/ASSETS.md          素材規格、免費素材來源、提供素材的方式
```

### `game` 物件

`main.js` 把所有系統放進一個物件，畫面與地圖物件都從這裡取用：

`bus` `reg` `save` `storage` `assets` `rng` `clock` `progress` `inv` `cards` `farm` `fishing` `ach`
`shop`（供奉石）`wallet` `market`（商店）`casino`（設定有誤時為 `null`）`tank` `fish` `ui` `world` `view`

### 事件一覽

| 事件 | 內容 | 發出者 |
|---|---|---|
| `inv:changed` | `{id, delta, count, firstTime}` | inventory |
| `coins:changed` | `{coins, delta, reason}` | wallet |
| `card:summoned` | `{id, first, card}` | cards |
| `summonfx:step` | `{id, step}` | summonFxView |
| `stat:changed` / `flag:set` | `{key, value}` / `{key}` | progress |
| `ach:unlocked` | `{achievement}` | achievements |
| `farm:changed` | `{index, action, crop, qty?}`（action：plant / water / fertilize / harvest） | farm |
| `fishing:end` | `{state, item?}` | fishing |
| `market:trade` | `{kind, itemId, qty, coins}` | market |
| `casino:played` | `{game, bet, mult, payout, net, …}` | casino |
| `tank:changed` | `{action, …}` | tank |
| `shop:bought` / `shop:back` | `{offering}` / `{id}` | shop |
| `fish:opened` | `{}` | fish |
| `asset:loaded` | `{key}` | assets |
| `save:loaded` / `save:failed` | `{status}` / `{}` | save |
| `input:action` / `input:tap` | `{action}` / `{x, y}` | input |
| `ui:block` / `ui:unblock` | `{}` | ui |
| `world:loaded` | `{map}` | world |

### 存檔結構（`save.data`，版本 1）

```
v, createdAt, updatedAt
player      {map, x, y} | null
cards       {角色id: {at, count}}
inv         {物品id: 數量}            seen   {物品id: true}（圖鑑）
coins       整數
farm        {plots: [null | {crop, progress, last, wetUntil, fert}]}
tank        [{item, at, fedAt}]
flags       {旗標: true}              例：fishFound、lanternsAll、lit:<石燈id>、own:<供奉id>、starter、starterCoins
cooldowns   {鍵: 上次時間}            例：tree、bush:<id>、dig:<id>、bug:<id>、bugflee:<id>、tankGift
stats       {統計: 數值}              例：cardsSummoned、harvests、catches、bugsCaught、digs、offerings、sold、bought、
                                          casinoPlays、casinoWins、tankAdded、coinsEarned、treeShakes
achievements {成就id: 解鎖時間}
fish        {visits, feeds, msgs, lastAt}
wishes      [文字]                    settings {cardBack}
```

localStorage 鍵：本站存檔 `sfh_save`；與 `prompt_list` 連動用 `pp_fish_visits`（只讀）與 `sfh_pond_found`（本站寫入）。

## 常見工作

| 要做的事 | 做法 |
|---|---|
| 新增角色卡 | `data/characters.js` 加一筆。卡環會自動容納任意張數 |
| 新增網站（許願牌） | `data/sites.js` 加一筆。掛點由 `systems/treeLayout.js` 依序分配 |
| 新增物品 | `data/items.js`。要能賣就加 `sell` |
| 新增作物 | 先在 items 建種子與收成物，再到 `data/crops.js` |
| 調整掉落 | `data/loot.js`。`phases` 用 `data/time.js` 的時段 id |
| 新增成就 | `data/achievements.js`。條件三種：`{stat, gte}`、`{flag}`、`{seenAll}`。新的統計項用 `progress.inc('名稱')` 累加即可 |
| 商店上架 | `data/market.js`（買價要高於賣價） |
| 改賭場賠率 | `data/casino.js`（期望值要小於 1） |
| 改時段、天色 | `data/time.js`。四個時段要剛好涵蓋 24 小時 |
| 改召喚特效節奏 | `data/summonFx.js`；視覺在 `css/base.css` 的 `.sfx[data-step=…]` |
| 接上圖檔 | `data/assets.js`，規格見 `docs/ASSETS.md` |
| 改地圖 | `data/maps/town.js`：`rect()` 畫格子、`objects` 放物件、`landmarks` 是傳送點 |
| 魚魚的台詞 | `fish/words-home.js`。語氣機率規則在 `fish/brain.js`（先溫和、熟了才偶爾嘴人、安慰一律真心），有測試保護 |

### 新增一種地圖物件

1. `js/world/types.js` 最下面：

```js
register('bench', (def, game) => ({
  color: () => '#a1887f', label: () => '椅',     // 沒有素材時的佔位樣子
  prompt: () => '坐下',                           // 回傳 null = 目前不能互動
  interact: () => game.ui.say(['你坐了一會兒。風很舒服。']),
  // 可選：update(dt)、visible()、glow()、draw(ctx, px, py, tile, time)、sprite()
}));
```

2. `data/maps/town.js` 的 `objects` 加 `{ id: 'bench1', type: 'bench', x: 12, y: 22, solid: true }`。
   物件不可以放在擋路的格子上，而且從出生點要走得到（測試會檢查）。
3. 素材鍵自動是 `ent.bench`。

### 新增一個全螢幕畫面

1. 新檔 `js/ui/fooView.js`，匯出 `fooView(game, args)`，回傳 `ui.panel({...}).closed`：

```js
export function fooView(game) {
  const body = h('div', null, h('p', { text: '內容' }));
  return game.ui.panel({ title: '標題', body, scene: 'foo', cls: 'wide',   // cls：''｜wide｜xl｜full
    onKey: (e) => false,          // 回傳 true 表示這個按鍵已處理
    onClose: () => { /* 停止動畫、清計時器 */ } }).closed;
}
```

2. `main.js`：`ui.register('foo', () => fooView(game));`
3. 從物件開啟：`game.ui.show('foo')`。背景素材鍵是 `scene.foo`。
4. 有動畫（rAF、setInterval）的畫面一定要在 `onClose` 停掉。

### 新增一個系統

1. `js/systems/foo.js` 匯出 `createFoo({ save, reg, bus, …, now = Date.now, rng = Math.random })`。
2. 需要存檔就在 `core/save.js` 的 `blankSave()` 與 `normalize()` 加欄位。
3. 需要資料就新增 `js/data/foo.js` 並在 `core/registry.js` 加檢查。
4. 在 `main.js` 建立並放進 `game`；在 `tests/helpers.js` 的 `makeGame()` 也加上。
5. 寫測試（`tests/*.test.js`）：正常流程、不合法輸入、存檔後重新讀取、資料被刪除時的行為。

## 測試

- `npm test`：全部是純邏輯測試，不需要瀏覽器。目前 63 項。
- 重要的保護：存檔 normalize 與匯出匯入、資料檢查、地圖可達性（每個物件與傳送點都走得到、隱藏池塘只能穿過蘆葦）、
  卡環一定停在整數張、魚魚的語氣比例、商店不可套利、賭場期望值、時段涵蓋 24 小時、素材路徑安全性。
- 畫面的實測目前是用 Playwright 在外部跑的（不在 repo 裡）。改到畫面時，至少手動確認：
  桌機全螢幕、手機直向（虛擬搖桿與互動鍵）、主控台沒有錯誤。

## 目前狀態與待辦

已完成（邏輯與可操作的佔位畫面）：行走與點擊移動、全螢幕與手機操作、召喚卡環與召喚特效時間軸、許願樹、
背包、農田（含肥料）、釣魚場景（含魚餌）、捕蟲、供奉石、商店、小賭場、魚缸、成就小屋、傳送地圖、
依現實時間的時段與天色、存檔匯出匯入、魚魚（含與 prompt_list 的連動讀取）、素材接入管線。

待辦：
- 正式美術全部未做（地圖圖塊、人物、物件、許願樹、卡背、卡面、場景背景、召喚特效）。接法見 `docs/ASSETS.md`
- `data/characters.js` 目前是範例與測試假卡，待站主填入真實角色
- `data/sites.js` 的說明文字待補、網址待站主確認
- `prompt_list` 那一側的連動台詞（讀 `sfh_pond_found`）
- 自由擺設、音效
