/* 全站可調參數。改數值只需動這個檔。 */
export const CONFIG = Object.freeze({
  SAVE_KEY: 'sfh_save',          // 本站存檔在 localStorage 的鍵名（不要改，改了舊存檔會讀不到）
  SAVE_DELAY_MS: 400,            // 存檔延遲合併時間
  TILE: 32,                      // 一格的像素大小
  VIEW_MIN_W: 640, VIEW_MIN_H: 400, // 畫面至少要看得到這麼大的範圍（邏輯像素）；視窗越大自動放大倍率
  VIEW_SCALES: Object.freeze([4, 3, 2, 1.5, 1]), // 可用的放大倍率，由大到小挑第一個放得下的
  PLAYER_SPEED: 4.5,             // 每秒走幾格
  SNEAK_RATE: 0.4,               // 潛行（按住 Shift 或輕推搖桿）時的速度倍率
  PLAYER_HALF: 0.3,              // 玩家碰撞箱半徑（格）
  INTERACT_RANGE: 0.9,           // 互動距離（格）
  FARM_PLOTS: 6,                 // 農田格數
  FARM_WET_MS: 10 * 60 * 1000,   // 澆一次水維持多久
  FARM_DRY_RATE: 0.5,            // 沒澆水時的生長速度倍率
  FISH_WAIT_MS: [1500, 5000],    // 釣魚等待咬鉤的時間範圍
  FISH_BITE_MS: 800,             // 咬鉤後可以拉竿的時間
  TREE_SHAKE_CD_MS: 60 * 1000,   // 搖樹冷卻
  DAILY_CD_MS: 6 * 60 * 60 * 1000, // 草叢、挖掘點的冷卻
  BUG_ALERT_RADIUS: 2.2,         // 蟲在幾格內會注意到你
  BUG_SNEAK_SPEED: 2.2,          // 靠近時速度超過這個值（格/秒）蟲就飛走
  BUG_FLEE_CD_MS: 60 * 1000,     // 蟲被嚇跑後多久回來
  BUG_CATCH_CD_MS: 30 * 60 * 1000, // 抓到後多久再出現
  RING_WINDOW: 5,                // 卡環正前方左右各畫幾張（總共 2n+1 張）
  RING_PER_RING: 30,             // 地圖上一圈最多幾張，超過就分圈
  ITEM_CAP: 999,                 // 單一物品持有上限
  CROSS_SITE: Object.freeze({    // 與 prompt_list 連動用的鍵名
    PROMPT_VISITS: 'pp_fish_visits', // prompt_list 的魚魚記錄的來訪次數（只讀）
    POND_FOUND: 'sfh_pond_found',    // 本站寫入：訪客找到池塘了（給 prompt_list 讀）
  }),
});
