/* 時鐘：依訪客的本地時間決定時段與天色。時段與天色的設定在 data/time.js。
   測試或預覽用：網址加上 ?hour=22 可以固定在晚上十點（見 main.js）。 */
import { PHASES, SKY } from '../data/time.js';

const wrap = (h) => ((h % 24) + 24) % 24;
const inPhase = (p, h) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to);

/* 檢查時段設定：每個整點都要剛好屬於一個時段。回傳錯誤訊息陣列（空 = 沒問題） */
export function checkPhases(phases) {
  const errors = [];
  if (!Array.isArray(phases) || !phases.length) return ['PHASES 必須是非空陣列'];
  const ids = new Set();
  for (const p of phases) {
    if (!p || typeof p.id !== 'string' || !Number.isInteger(p.from) || !Number.isInteger(p.to) || p.from < 0 || p.from > 23 || p.to < 0 || p.to > 24 || p.from === p.to) errors.push(`時段設定不合法：${JSON.stringify(p)}`);
    else if (ids.has(p.id)) errors.push(`時段 id 重複：${p.id}`);
    else ids.add(p.id);
  }
  if (errors.length) return errors;
  for (let h = 0; h < 24; h++) {
    const hit = phases.filter((p) => inPhase(p, h));
    if (hit.length !== 1) errors.push(`${h} 點屬於 ${hit.length} 個時段（應該剛好 1 個）`);
  }
  return errors;
}

/* 小時（可含小數）→ 時段 id */
export function phaseOfHour(hour, phases = PHASES) {
  const h = wrap(hour);
  const p = phases.find((x) => inPhase(x, h));
  return p ? p.id : phases[0].id;
}

/* 純函式：小時（可含小數）→ 疊在畫面上的顏色 {r, g, b, a} */
export function skyTint(hour, sky = SKY) {
  const h = wrap(hour);
  for (let i = 1; i < sky.length; i++) {
    const a = sky[i - 1], b = sky[i];
    if (h <= b[0]) {
      const k = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
      const mix = (j) => a[j] + (b[j] - a[j]) * k;
      return { r: Math.round(mix(1)), g: Math.round(mix(2)), b: Math.round(mix(3)), a: +mix(4).toFixed(3) };
    }
  }
  const z = sky[sky.length - 1];
  return { r: z[1], g: z[2], b: z[3], a: z[4] };
}

export function createClock(now = Date.now, { phases = PHASES, sky = SKY } = {}) {
  let debugHour = null;
  const hourFloat = () => {
    if (debugHour !== null) return debugHour;
    const d = new Date(now());
    return d.getHours() + d.getMinutes() / 60;
  };
  const info = () => { const id = phaseOfHour(hourFloat(), phases); return phases.find((p) => p.id === id); };
  return {
    now,
    setDebugHour(h) { debugHour = Number.isFinite(h) ? wrap(h) : null; },
    hourFloat,
    hour() { return Math.floor(hourFloat()); },
    phase() { return phaseOfHour(hourFloat(), phases); },
    phaseInfo: info,                 // {id, name, icon, from, to}
    tint() { return skyTint(hourFloat(), sky); },
    /* 顯示用的時間文字 HH:MM */
    label() { const h = hourFloat(); const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 + 1e-6); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
  };
}
