/* 時鐘：依訪客的本地時間決定時段與天色。
   測試或預覽用：網址加上 ?hour=22 可以固定在晚上十點（見 main.js）。 */
export function phaseOfHour(h) {
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

/* 天色關鍵影格：[小時, r, g, b, 透明度]，中間自動漸變 */
const SKY = [
  [0, 20, 24, 70, 0.42], [5, 20, 24, 70, 0.42], [6, 255, 170, 130, 0.18], [7.5, 255, 220, 180, 0],
  [16.5, 255, 200, 150, 0], [18, 255, 130, 80, 0.2], [19.5, 20, 24, 70, 0.42], [24, 20, 24, 70, 0.42],
];
/* 純函式：小時（可含小數）→ 疊在畫面上的顏色 {r, g, b, a} */
export function skyTint(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < SKY.length; i++) {
    const a = SKY[i - 1], b = SKY[i];
    if (h <= b[0]) {
      const k = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
      const mix = (j) => a[j] + (b[j] - a[j]) * k;
      return { r: Math.round(mix(1)), g: Math.round(mix(2)), b: Math.round(mix(3)), a: +mix(4).toFixed(3) };
    }
  }
  const z = SKY[SKY.length - 1];
  return { r: z[1], g: z[2], b: z[3], a: z[4] };
}

export function createClock(now = Date.now) {
  let debugHour = null;
  const hourFloat = () => {
    if (debugHour !== null) return debugHour;
    const d = new Date(now());
    return d.getHours() + d.getMinutes() / 60;
  };
  return {
    now,
    setDebugHour(h) { debugHour = Number.isFinite(h) ? ((h % 24) + 24) % 24 : null; },
    hourFloat,
    hour() { return Math.floor(hourFloat()); },
    phase() { return phaseOfHour(Math.floor(hourFloat())); },
    tint() { return skyTint(hourFloat()); },
    /* 顯示用的時間文字 HH:MM */
    label() { const h = hourFloat(); const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 + 1e-6); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
  };
}
