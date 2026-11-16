# 沉魚的小鎮（sinking_fish_homepage）

Caveduck 角色卡與 GitHub 網站的入口。訪客操作小人在像素小鎮上走動：北邊的**召喚卡殿**翻角色卡、中央的**許願樹**掛著各網站的許願牌、西邊可以**種菜**、溪邊可以**釣魚**，另外有一個不在地圖上的地方。

> 目前是**底層邏輯骨架**：所有功能都能實際操作，但畫面全部是佔位色塊，美術之後再換。

## 怎麼跑

純靜態網站，不需要打包。因為使用 ES Modules，不能直接雙擊 `index.html`，要用本機伺服器開：

```
python -m http.server 8000     # 然後開 http://localhost:8000
npm test                       # 跑邏輯測試（需要 Node 20 以上，沒有任何相依套件）
```

部署：repo 的 Settings → Pages → 選 `main` 分支根目錄即可。

## 操作

| 按鍵 | 動作 |
|---|---|
| WASD／方向鍵、點擊地面 | 移動 |
| E／空白／Enter | 互動、對話下一句 |
| B | 背包（卡冊、物品、圖鑑、成就） |
| L | 快速目錄（不逛地圖也能找到所有連結） |
| Esc | 選單（存檔匯出／匯入／重置）、關閉視窗 |

## 平常要改的檔案（都在 `js/data/`）

| 想做的事 | 改哪裡 |
|---|---|
| 新增／修改角色卡 | `characters.js`（檔案開頭有欄位說明） |
| 新增／修改許願牌（網站） | `sites.js` |
| 新增物品 | `items.js` |
| 新增作物 | `crops.js`（種子與收成物要先在 `items.js` 建好） |
| 調整掉落（釣魚、搖樹、草叢、挖掘） | `loot.js` |
| 新增成就 | `achievements.js` |
| 改地圖、擺放物件 | `maps/town.js` |
| 魚魚的台詞 | `js/fish/words-home.js`（格式與 prompt_list 的 `fish-words.js` 相同） |
| 數值（速度、冷卻、生長倍率…） | `js/config.js` |

資料寫錯不會讓網站壞掉：開機時會逐筆檢查，不合格的項目被略過，原因印在瀏覽器主控台（F12）。

**注意**：角色與物品的 `id` 上線後不要改，訪客的存檔靠它對應。

## 架構

```
index.html            空殼：一個 canvas + 一層介面
css/base.css          骨架階段的最低限度樣式
js/
├── main.js           進入點：把所有系統接起來
├── config.js         全站數值
├── core/             不碰畫面的基礎
│   ├── events.js     事件匯流排
│   ├── save.js       存檔（版本、升級、檢查、延遲寫入、匯出匯入）
│   ├── registry.js   資料檢查
│   └── util.js
├── data/             所有內容資料
├── systems/          遊戲規則（全部不碰畫面，可單獨測試）
│   ├── progress.js   統計、旗標、冷卻
│   ├── inventory.js  背包
│   ├── cards.js      角色卡收集
│   ├── ringModel.js  卡環的轉動（慣性、吸附、輪盤、只取可見範圍）
│   ├── farm.js       農田（用時間戳計算，關掉網頁照樣長）
│   ├── fishing.js    釣魚狀態機
│   ├── achievements.js / clock.js / loot.js
├── fish/             魚魚（用到時才載入）
│   ├── index.js      對外窗口：狀態、熟悉度、跨網站連動
│   ├── brain.js      回覆引擎與語氣規則
│   └── words-home.js 詞庫
├── engine/           地圖引擎：loop / input / camera / tilemap / collision / pathfind / renderer
├── world/
│   ├── world.js      地圖、玩家、互動判定
│   └── types.js      互動物件類型（公告欄、許願樹、法陣、農田、釣點、池塘、草叢、挖掘點、石燈）
└── ui/               介面：ui.js（視窗堆疊、對話、選項、通知）＋ 各畫面
tests/                邏輯測試
```

### 串接規則

1. **資料與程式分離**：內容只放在 `js/data/`，程式不寫死任何角色或網站。
2. **系統之間用事件通知**：例如背包增加物品只發出 `inv:changed`，通知訊息、成就檢查各自監聽，互不呼叫。
3. **規則不碰畫面**：`systems/` 與 `fish/brain.js` 不使用 DOM，時間與亂數都由外部傳入，所以能用 `npm test` 驗證。
4. **地圖物件不知道畫面怎麼做**：物件只呼叫 `game.ui.show('ring')`、`game.ui.say([...])`，畫面由 `main.js` 註冊。
5. **存檔一律即時取值**：任何系統都用 `save.data.xxx`，不把子物件另存變數（匯入／重置時整份會換掉）。
6. **所有角色卡從一開始就能召喚**：收集玩法只影響紀錄與獎勵，不擋連結。

### 事件一覽

| 事件 | 內容 | 發出者 |
|---|---|---|
| `inv:changed` | `{id, delta, count, firstTime}` | inventory |
| `card:summoned` | `{id, first, card}` | cards |
| `stat:changed` / `flag:set` | `{key, value}` / `{key}` | progress |
| `ach:unlocked` | `{achievement}` | achievements |
| `farm:changed` | `{index, action, crop, qty?}` | farm |
| `fishing:end` | `{state, item?}` | fishing |
| `fish:opened` | `{}` | fish |
| `save:loaded` / `save:failed` | `{status}` / `{}` | save |
| `input:action` / `input:tap` | `{action}` / `{x, y}` | input |
| `ui:block` / `ui:unblock` | `{}` | ui |
| `world:loaded` | `{map}` | world |

### 新增一種互動物件

在 `js/world/types.js` 最下面加一段，再到 `maps/town.js` 的 `objects` 放一筆 `{ id, type, x, y }`：

```js
register('bench', (def, game) => ({
  prompt: () => '坐下',
  interact: () => game.ui.say(['你坐了一會兒。風很舒服。']),
}));
```

### 存檔格式升級

存檔有版本號（`SAVE_VERSION`）。之後格式有變時：把版本號加一，並在 `core/save.js` 的 `MIGRATIONS` 加一條舊版轉新版的函式。新增欄位若有預設值，只要改 `blankSave()` 與 `normalize()` 即可，不必升版。

## 魚魚（下班版）

- 與 `prompt_list` 是同一條魚：那邊上班講「您」，這邊在家講「你」。
- **語氣**：每次對話前兩句一定溫和；熟悉度（來訪、餵食、聊天次數）越高，之後才越可能偶爾嘴一句，機率上限四成；對方心情不好時一律認真安慰。規則在 `fish/brain.js`，有測試保證。
- **連動**：兩站在同一個 GitHub Pages 網域下，共用 localStorage。本站讀取 prompt_list 寫的 `pp_fish_visits`（魚魚會認出在那邊聊過的人）；訪客找到池塘後本站寫入 `sfh_pond_found = "1"`，prompt_list 之後可以讀它來加台詞。
- 魚魚看得到遊戲狀態：卡片進度、田裡熟了幾格、背包有沒有魚、是不是半夜、幾天沒來。

## 尚未製作

- 正式美術（地圖圖塊、人物、混色許願樹、卡背、卡面 Q 圖）
- 手機虛擬搖桿（目前手機可用點擊移動）
- 許願牌實際掛在樹上的呈現、卡片召喚特效
- 夜間捕蟲、祭壇兌換、擺設、全圖傳送
- prompt_list 那一側的連動台詞
