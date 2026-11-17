/* ============================================================
   進入點：把所有系統接起來。
   順序：資料檢查 → 存檔 → 各系統 → 介面 → 世界 → 主迴圈。
   所有系統都放在 game 這個物件裡互相取用；系統之間用 bus 事件通知。
============================================================ */
import { CONFIG } from './config.js';
import { createBus } from './core/events.js';
import { buildRegistry } from './core/registry.js';
import { createSave, safeStorage } from './core/save.js';
import { createAssets } from './core/assets.js';

import { characters } from './data/characters.js';
import { sites } from './data/sites.js';
import { items } from './data/items.js';
import { crops } from './data/crops.js';
import { fish as fishTable, loot } from './data/loot.js';
import { achievements } from './data/achievements.js';
import { offerings } from './data/offerings.js';
import { goods } from './data/market.js';
import { casino as casinoCfg } from './data/casino.js';
import { summonFx } from './data/summonFx.js';
import { assets as assetManifest, ASSET_BASE } from './data/assets.js';
import { town } from './data/maps/town.js';

import { createProgress } from './systems/progress.js';
import { createInventory } from './systems/inventory.js';
import { createCards } from './systems/cards.js';
import { createFarm } from './systems/farm.js';
import { createFishing } from './systems/fishing.js';
import { createAchievements } from './systems/achievements.js';
import { createClock } from './systems/clock.js';
import { createShop } from './systems/shop.js';
import { createWallet } from './systems/wallet.js';
import { createMarket } from './systems/market.js';
import { createCasino } from './systems/casino.js';
import { createTank } from './systems/tank.js';
import { createFish } from './fish/index.js';

import { createLoop } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { createCamera } from './engine/camera.js';
import { createView } from './engine/view.js';
import { createRenderer } from './engine/renderer.js';
import { createWorld } from './world/world.js';

import { h } from './ui/dom.js';
import { createUI } from './ui/ui.js';
import { ringView } from './ui/ringView.js';
import { cardView } from './ui/cardView.js';
import { plaquesView } from './ui/plaquesView.js';
import { bagView } from './ui/bagView.js';
import { fishChatView } from './ui/fishChatView.js';
import { fishingView } from './ui/fishingView.js';
import { listView } from './ui/listView.js';
import { menuView } from './ui/menuView.js';
import { hutView } from './ui/hutView.js';
import { offeringsView } from './ui/offeringsView.js';
import { mapView } from './ui/mapView.js';
import { createTouchControls } from './ui/touch.js';
import { marketView } from './ui/marketView.js';
import { casinoView } from './ui/casinoView.js';
import { tankView } from './ui/tankView.js';
import { summonFxView } from './ui/summonFxView.js';

function boot() {
  const root = document.getElementById('app');
  const canvas = document.getElementById('game');

  /* 1. 資料 */
  const reg = buildRegistry({ characters, sites, items, crops, fish: fishTable, loot, achievements, offerings, goods, casino: casinoCfg, summonFx });
  if (reg.errors.length) console.warn(`[資料檢查] 有 ${reg.errors.length} 筆資料被略過：\n- ${reg.errors.join('\n- ')}`);

  /* 2. 存檔與素材 */
  const bus = createBus();
  const assets = createAssets({
    manifest: assetManifest, base: ASSET_BASE,
    loadImage: (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }),
    onLoad: (key) => bus.emit('asset:loaded', { key }),
  });
  if (assets.errors.length) console.warn(`[素材檢查] 有 ${assets.errors.length} 筆素材被略過：\n- ${assets.errors.join('\n- ')}`);
  let ls = null;
  try { ls = window.localStorage; } catch { /* 被瀏覽器封鎖時改用記憶體 */ }
  const storage = safeStorage(ls);
  const save = createSave({ storage, key: CONFIG.SAVE_KEY, bus, delay: CONFIG.SAVE_DELAY_MS });
  const loadStatus = save.load();

  /* 3. 系統 */
  const rng = Math.random;
  const clock = createClock();
  // 預覽用：網址加 ?hour=22 可以固定時間（例如看夜晚的樣子），不影響存檔
  const debugHour = new URLSearchParams(location.search).get('hour');
  if (debugHour !== null && debugHour !== '' && Number.isFinite(Number(debugHour))) clock.setDebugHour(Number(debugHour));
  const progress = createProgress({ save, bus });
  const inv = createInventory({ save, reg, bus, cap: CONFIG.ITEM_CAP });
  const cards = createCards({ save, reg, bus, progress, rng });
  const farm = createFarm({ save, reg, bus, inv, progress, rng, plots: CONFIG.FARM_PLOTS, wetMs: CONFIG.FARM_WET_MS, dryRate: CONFIG.FARM_DRY_RATE, fertRate: CONFIG.FERTILIZER_RATE });
  const fishing = createFishing({ reg, inv, progress, clock, bus, rng, waitMs: CONFIG.FISH_WAIT_MS, biteMs: CONFIG.FISH_BITE_MS, baitRate: CONFIG.BAIT_WAIT_RATE });
  const ach = createAchievements({ save, reg, bus, inv, progress });
  const shop = createShop({ save, reg, inv, progress, bus });
  const wallet = createWallet({ save, bus, progress, cap: CONFIG.COIN_CAP });
  const market = createMarket({ reg, inv, wallet, progress, bus, cap: CONFIG.ITEM_CAP });
  const casino = reg.casino ? createCasino({ cfg: reg.casino, wallet, progress, bus, rng }) : null;   // 設定有問題時停用
  const tank = createTank({ save, reg, inv, wallet, progress, bus, capacity: CONFIG.TANK_CAPACITY, happyMs: CONFIG.TANK_HAPPY_MS, giftCdMs: CONFIG.TANK_GIFT_CD_MS, giftPerFish: CONFIG.TANK_GIFT_PER_FISH });
  const fish = createFish({ save, reg, cards, farm, inv, clock, progress, bus, crossStorage: storage, rng });

  /* 4. 介面 */
  const ui = createUI({ root, bus, assets, animMs: CONFIG.SCENE_ANIM_MS });
  const game = { bus, reg, save, storage, assets, rng, clock, progress, inv, cards, farm, fishing, ach, shop, wallet, market, casino, tank, fish, ui, world: null };
  ui.register('ring', () => ringView(game));
  ui.register('card', (args) => cardView(game, args));
  ui.register('plaques', () => plaquesView(game));
  ui.register('bag', () => bagView(game));
  ui.register('fishChat', (args) => fishChatView(game, args));
  ui.register('fishing', () => fishingView(game));
  ui.register('list', () => listView(game));
  ui.register('menu', () => menuView(game));
  ui.register('hut', () => hutView(game));
  ui.register('offerings', () => offeringsView(game));
  ui.register('map', () => mapView(game));
  ui.register('market', () => marketView(game));
  ui.register('casino', () => casinoView(game));
  ui.register('tank', () => tankView(game));
  ui.register('summonFx', (args) => summonFxView(game, args));

  const open = (name) => { if (!ui.isBlocking()) ui.show(name); };
  const clockEl = h('div', { class: 'hud-clock', title: '小鎮的時間跟你那邊的現實時間一樣' });
  const tickClock = () => { const p = clock.phaseInfo(); const t = `${p.icon || ''} ${clock.label()}`; if (clockEl.textContent !== t) { clockEl.textContent = t; clockEl.title = `${p.name || p.id}・小鎮的時間跟你那邊的現實時間一樣`; } };
  const coinEl = h('div', { class: 'hud-clock hud-coins', title: '金幣' });
  const tickCoins = () => { coinEl.textContent = `🪙 ${wallet.coins()}`; };
  bus.on('coins:changed', tickCoins);
  tickClock(); setInterval(tickClock, 5000);
  root.append(h('div', { class: 'hud' }, clockEl, coinEl,
    h('button', { class: 'btn', type: 'button', text: '🎒 背包', title: '背包（B）', onclick: () => open('bag') }),
    h('button', { class: 'btn', type: 'button', text: '🗺 地圖', title: '地圖（M）', onclick: () => open('map') }),
    h('button', { class: 'btn', type: 'button', text: '📋 目錄', title: '快速目錄（L）', onclick: () => open('list') }),
    h('button', { class: 'btn', type: 'button', text: '⚙ 選單', title: '選單（Esc）', onclick: () => open('menu') })));

  /* 5. 世界 */
  const camera = createCamera(CONFIG.VIEW_MIN_W, CONFIG.VIEW_MIN_H);
  const view = createView({ canvas, camera, config: CONFIG });      // 畫布填滿視窗，視窗變大小時自動調整
  const input = createInput({ canvas, ui, bus, camera, sneak: CONFIG.SNEAK_RATE });
  createTouchControls({ root, input, bus, ui });
  const world = createWorld({ game, maps: { town }, input, camera });
  game.world = world;
  const saved = save.data.player;
  try { world.load(saved && saved.map === 'town' ? saved.map : 'town', saved && saved.map === 'town' ? saved : null); }
  catch (e) { console.error(e); ui.say(['地圖載入失敗，請看主控台的錯誤訊息。']); return; }

  /* 6. 事件 → 通知 */
  bus.on('input:action', ({ action }) => { if (action === 'bag' || action === 'list' || action === 'menu' || action === 'map') open(action); });
  bus.on('inv:changed', ({ id, delta }) => { if (delta > 0) ui.toast(`獲得 ${reg.itemById.get(id)?.name ?? id} ×${delta}`); });
  bus.on('ach:unlocked', ({ achievement }) => ui.toast(`成就解鎖：${achievement.name}`));
  bus.on('card:summoned', ({ first, card }) => { if (first) ui.toast(`新卡片：${card.name}`); });
  bus.on('save:failed', () => ui.toast('進度無法保存到這個瀏覽器'));
  bus.on('coins:changed', ({ delta, reason }) => { if (delta > 0 && reason !== 'casino') ui.toast(`+${delta} 金幣`); });

  /* 7. 新手禮（只發一次） */
  if (progress.setFlag('starter')) { inv.add('seed_turnip', 2); inv.add('feed', 1); }
  if (progress.setFlag('starterCoins')) wallet.add(CONFIG.START_COINS, 'starter');   // 舊存檔也會補發一次
  tickCoins();
  ach.check();
  if (loadStatus === 'recovered') ui.toast('舊存檔讀取失敗，已重新開始');

  /* 8. 主迴圈 */
  const renderer = createRenderer({ canvas, tile: CONFIG.TILE, assets });
  bus.on('asset:loaded', ({ key }) => { if (key.startsWith('tile.')) renderer.invalidateGround(); });
  const loop = createLoop({
    update: (dt) => world.update(dt),
    render: () => {
      world.followCamera();
      renderer.draw({ map: world.map, entities: world.entities, player: world.player, camera, tint: clock.tint(), time: world.time });
    },
  });
  loop.start();

  /* 9. 離開頁面前把進度寫進去 */
  const persist = () => { world.savePosition(); save.flush(); };
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  game.view = view;
  window.__sfh = game;   // 開發用：在主控台輸入 __sfh 可以查看所有系統
}

try { boot(); }
catch (e) {
  console.error('[啟動失敗]', e);
  const app = document.getElementById('app');
  if (app) app.append(h('p', { class: 'warn', text: '網站啟動失敗，請重新整理。若持續發生，請看瀏覽器主控台的錯誤訊息。' }));
}
