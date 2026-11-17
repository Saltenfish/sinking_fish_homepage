/* 素材載入器：依 data/assets.js 的清單提供圖檔。
   ・用到才載入（第一次要某張圖時開始下載，載好之前先用佔位色塊）
   ・沒填、路徑不合法、下載失敗 → 一律回傳 null，呼叫端畫佔位色塊
   ・不碰畫面；實際建立 <img> 的函式由外部傳入，所以可以測試 */
import { isObj } from './util.js';

const EXT = /\.(png|webp|gif|jpe?g|svg)$/i;

/* 檢查並組出最終網址；不合法回傳 null。只接受 https 網址，或不含 .. 的相對路徑 */
export function resolveSrc(src, base = '') {
  if (typeof src !== 'string' || !src || src.length > 500) return null;
  if (/^https:\/\//i.test(src)) {
    try { const u = new URL(src); return u.protocol === 'https:' && EXT.test(u.pathname) ? u.href : null; } catch { return null; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/') || src.includes('..') || src.includes('\\') || !/^[\w\-./%]+$/.test(src) || !EXT.test(src)) return null;
  if (!base) return src;
  if (!/^https:\/\//i.test(base)) return null;
  return base.replace(/\/+$/, '') + '/' + src;
}

const posInt = (v) => Number.isInteger(v) && v > 0;

export function createAssets({ manifest, base = '', loadImage, onLoad }) {
  const entries = new Map();   // key → {src, frameW, frameH, frames, fps}
  const errors = [];
  for (const key of Object.keys(isObj(manifest) ? manifest : {})) {
    const raw = manifest[key];
    if (raw === null || raw === undefined) continue;
    const obj = typeof raw === 'string' ? { src: raw } : raw;
    const src = isObj(obj) ? resolveSrc(obj.src, base) : null;
    if (!src) { errors.push(`素材「${key}」的路徑不合法：${JSON.stringify(raw)}`); continue; }
    const meta = { src, frames: 1, fps: 0, frameW: 0, frameH: 0 };
    if (obj.frames !== undefined) {
      if (!posInt(obj.frames) || !posInt(obj.frameW) || !posInt(obj.frameH)) { errors.push(`素材「${key}」的動畫設定不完整（需要 frameW、frameH、frames）`); continue; }
      Object.assign(meta, { frames: obj.frames, frameW: obj.frameW, frameH: obj.frameH, fps: obj.fps > 0 ? obj.fps : 6 });
    }
    entries.set(key, meta);
  }

  const state = new Map();     // key → 'loading' | 'failed' | 圖片物件

  return {
    errors,
    has(key) { return entries.has(key); },
    keys() { return [...entries.keys()]; },
    /* 網址（給 <img> 或 CSS 用）；沒有這個素材回傳 null */
    url(key) { return entries.get(key)?.src ?? null; },
    meta(key) { return entries.get(key) ?? null; },

    /* 畫布用：回傳已載入的圖片；還沒載好或沒有這個素材回傳 null */
    image(key) {
      const meta = entries.get(key);
      if (!meta) return null;
      const cur = state.get(key);
      if (cur === undefined) {
        state.set(key, 'loading');
        loadImage(meta.src).then(
          (img) => { state.set(key, img); onLoad?.(key); },
          () => { state.set(key, 'failed'); console.warn(`[素材] 載入失敗，改用佔位圖：${key} → ${meta.src}`); },
        );
        return null;
      }
      return cur === 'loading' || cur === 'failed' ? null : cur;
    },
    status(key) { const s = state.get(key); return s === undefined ? 'idle' : typeof s === 'string' ? s : 'ready'; },
  };
}

/* 計算動畫目前該畫哪一格（純函式） */
export function frameAt(meta, time) {
  if (!meta || meta.frames <= 1 || !(meta.fps > 0)) return 0;
  return Math.floor(Math.max(0, time) * meta.fps) % meta.frames;
}
