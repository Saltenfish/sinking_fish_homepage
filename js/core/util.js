/* 共用小工具（不碰 DOM）。 */
export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const safeKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 64 && !BAD_KEYS.has(k);
export const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* rng 一律是「回傳 0~1 的函式」，方便測試時注入固定值 */
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

/* 權重抽選：table = [{weight, ...}]；全部權重 <= 0 時回傳 null */
export function weighted(rng, table) {
  let total = 0;
  for (const t of table) total += Math.max(0, t.weight || 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const t of table) {
    const w = Math.max(0, t.weight || 0);
    if (r < w) return t;
    r -= w;
  }
  return table[table.length - 1];
}

/* 只允許 http / https 連結，其餘（javascript: 等）一律拒絕 */
export function safeUrl(u) {
  if (typeof u !== 'string') return null;
  try {
    const url = new URL(u);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}
