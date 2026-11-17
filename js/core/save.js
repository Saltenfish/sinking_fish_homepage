/* 存檔系統：版本號、舊版升級、內容檢查、延遲寫入、匯出匯入。
   重要：其他系統一律用 save.data.xxx 即時取值，不要把 save.data 的子物件存成自己的變數，
   因為匯入或重置時 save.data 會整個換掉。 */
import { isObj, isNum, safeKey } from './util.js';

export const SAVE_VERSION = 1;
const PREFIX = 'SFH.';

export function blankSave(now) {
  return {
    v: SAVE_VERSION,
    createdAt: now, updatedAt: now,
    player: null,                 // {map, x, y}
    cards: {},                    // {角色id: {at: 首次召喚時間, count: 召喚次數}}
    inv: {},                      // {物品id: 數量}
    seen: {},                     // {物品id: true} 圖鑑用，拿過就算
    farm: { plots: [] },          // 每格 null 或 {crop, progress, last, wetUntil}
    flags: {},                    // {旗標: true}
    cooldowns: {},                // {鍵: 上次觸發時間}
    stats: {},                    // {統計項: 數值}
    achievements: {},             // {成就id: 解鎖時間}
    fish: { visits: 0, feeds: 0, msgs: 0, lastAt: 0 },
    wishes: [],                   // 訪客自己掛的願望
    coins: 0,                     // 金幣
    tank: [],                     // 魚缸裡的魚 [{item, at, fedAt}]
    settings: { cardBack: 'default' },   // 外觀設定
    upgrades: {},                 // 永久升級 {升級id: 等級}
  };
}

/* 版本升級表：之後存檔格式有變，就在這裡加一條「舊版號: (d) => 新資料」。
   例：1: (d) => { d.newField = {}; d.v = 2; return d; } */
const MIGRATIONS = {};

export function migrate(d) {
  if (!isObj(d) || !Number.isInteger(d.v) || d.v < 1) throw new Error('存檔格式無法辨識');
  if (d.v > SAVE_VERSION) throw new Error('存檔來自較新的版本');
  while (d.v < SAVE_VERSION) {
    const step = MIGRATIONS[d.v];
    if (!step) throw new Error(`缺少 v${d.v} 的升級步驟`);
    const before = d.v;
    d = step(d);
    if (!isObj(d) || d.v <= before) throw new Error(`v${before} 的升級步驟沒有提升版本號`);
  }
  return d;
}

const nonNeg = (v) => isNum(v) && v >= 0;
function numMap(src, test = nonNeg) {
  const out = {};
  if (isObj(src)) for (const k of Object.keys(src)) if (safeKey(k) && test(src[k])) out[k] = src[k];
  return out;
}
function boolMap(src) {
  const out = {};
  if (isObj(src)) for (const k of Object.keys(src)) if (safeKey(k) && src[k] === true) out[k] = true;
  return out;
}

/* 把任何來源的資料整理成一份欄位齊全、型別正確的存檔；不合格的部分直接丟掉 */
export function normalize(raw, now) {
  const out = blankSave(now);
  if (!isObj(raw)) return out;
  if (nonNeg(raw.createdAt)) out.createdAt = raw.createdAt;
  if (nonNeg(raw.updatedAt)) out.updatedAt = raw.updatedAt;

  const p = raw.player;
  if (isObj(p) && safeKey(p.map) && isNum(p.x) && isNum(p.y)) out.player = { map: p.map, x: p.x, y: p.y };

  if (isObj(raw.cards)) {
    for (const k of Object.keys(raw.cards)) {
      const c = raw.cards[k];
      if (safeKey(k) && isObj(c) && nonNeg(c.at)) {
        out.cards[k] = { at: c.at, count: Number.isInteger(c.count) && c.count >= 1 ? c.count : 1 };
      }
    }
  }
  out.inv = numMap(raw.inv, (v) => Number.isInteger(v) && v > 0);
  out.seen = boolMap(raw.seen);
  out.flags = boolMap(raw.flags);
  out.cooldowns = numMap(raw.cooldowns);
  out.stats = numMap(raw.stats);
  out.achievements = numMap(raw.achievements);

  if (isObj(raw.farm) && Array.isArray(raw.farm.plots)) {
    out.farm.plots = raw.farm.plots.slice(0, 64).map((pl) => {
      if (!isObj(pl) || !safeKey(pl.crop) || !nonNeg(pl.progress) || !nonNeg(pl.last)) return null;
      return { crop: pl.crop, progress: pl.progress, last: pl.last, wetUntil: nonNeg(pl.wetUntil) ? pl.wetUntil : 0, fert: pl.fert === true };
    });
  }
  if (isObj(raw.fish)) {
    for (const k of ['visits', 'feeds', 'msgs', 'lastAt']) if (nonNeg(raw.fish[k])) out.fish[k] = raw.fish[k];
  }
  if (Number.isInteger(raw.coins) && raw.coins >= 0) out.coins = Math.min(raw.coins, 999999);
  if (Array.isArray(raw.tank)) {
    out.tank = raw.tank.filter((f) => isObj(f) && safeKey(f.item) && nonNeg(f.at)).slice(0, 64)
      .map((f) => ({ item: f.item, at: f.at, fedAt: nonNeg(f.fedAt) ? f.fedAt : 0 }));
  }
  out.upgrades = numMap(raw.upgrades, (v) => Number.isInteger(v) && v >= 0 && v <= 99);
  if (isObj(raw.settings) && safeKey(raw.settings.cardBack)) out.settings.cardBack = raw.settings.cardBack;
  if (Array.isArray(raw.wishes)) {
    out.wishes = raw.wishes.filter((w) => typeof w === 'string' && w.trim()).slice(0, 10).map((w) => w.trim().slice(0, 30));
  }
  return out;
}

/* localStorage 包裝：任何讀寫失敗都不會讓程式壞掉，改用記憶體暫存 */
export function safeStorage(ls) {
  const mem = new Map();
  let persistent = !!ls;
  return {
    get persistent() { return persistent; },
    get(k) {
      try { if (ls) { const v = ls.getItem(k); if (v !== null) return v; } } catch { persistent = false; }
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      mem.set(k, v);
      try { if (ls) { ls.setItem(k, v); return true; } } catch { persistent = false; }
      return false;
    },
    remove(k) { mem.delete(k); try { ls?.removeItem(k); } catch { /* 略 */ } },
  };
}

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createSave({ storage, key, bus, now = Date.now, delay = 400 }) {
  let data = blankSave(now());
  let dirty = false;
  let timer = null;

  const api = {
    get data() { return data; },

    /* 讀檔。壞掉的存檔會另外備份到 key.broken，然後從空白開始 */
    load() {
      const raw = storage.get(key);
      let status = 'new';
      if (raw !== null) {
        try {
          data = normalize(migrate(JSON.parse(raw)), now());
          status = 'loaded';
        } catch (e) {
          console.warn('[save] 存檔讀取失敗，已備份並重新開始：', e.message);
          storage.set(`${key}.broken`, raw);
          data = blankSave(now());
          status = 'recovered';
        }
      }
      bus?.emit('save:loaded', { status });
      return status;
    },

    /* 標記「有變動」，稍後合併成一次寫入 */
    commit() {
      dirty = true;
      if (timer === null) timer = setTimeout(api.flush, delay);
    },

    /* 立刻寫入（離開頁面前呼叫） */
    flush() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (!dirty) return true;
      dirty = false;
      data.updatedAt = now();
      const ok = storage.set(key, JSON.stringify(data));
      if (!ok) bus?.emit('save:failed', {});
      return ok;
    },

    exportCode() {
      data.updatedAt = now();
      return PREFIX + toB64(JSON.stringify(data));
    },

    /* 匯入存檔碼。成功後 save.data 會整個換新，呼叫端應重新載入頁面 */
    importCode(code) {
      try {
        if (typeof code !== 'string') throw new Error('不是文字');
        const text = code.trim();
        if (!text.startsWith(PREFIX)) throw new Error('不是本站的存檔碼');
        if (text.length > 2_000_000) throw new Error('存檔碼過長');
        data = normalize(migrate(JSON.parse(fromB64(text.slice(PREFIX.length)))), now());
        dirty = true;
        api.flush();
        bus?.emit('save:loaded', { status: 'imported' });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message || '存檔碼無法讀取' };
      }
    },

    reset() {
      data = blankSave(now());
      dirty = true;
      api.flush();
      bus?.emit('save:loaded', { status: 'reset' });
    },
  };
  return api;
}

