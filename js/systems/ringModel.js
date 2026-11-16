/* 卡環模型：只管「轉到哪裡」，不碰畫面。
   angle 以「張」為單位：angle = 3 代表第 3 張在正前方；可以是小數（轉動途中）。 */

const mod = (a, n) => ((a % n) + n) % n;

/* 地圖上的卡環分圈：n 張卡、每圈最多 perRing 張 → 各圈張數（盡量平均） */
export function splitRings(n, perRing) {
  if (!(n > 0)) return [];
  const rings = Math.ceil(n / perRing);
  const base = Math.floor(n / rings), extra = n % rings;
  return Array.from({ length: rings }, (_, i) => base + (i < extra ? 1 : 0));
}

export function createRing({ count, friction = 3.2, snapSpeed = 1.2, snapRate = 12, maxSpeed = 40 }) {
  const n = Math.max(0, Math.floor(count));
  let angle = 0, vel = 0, dragging = false, settled = true;
  let tween = null;        // {from, to, t, dur, onDone}
  let onSettle = null;

  const front = () => (n ? mod(Math.round(angle), n) : -1);
  function finish() {
    angle = n ? mod(Math.round(angle), n) : 0;   // 收斂回 0~n，避免數字越轉越大
    vel = 0; settled = true;
    const cb = onSettle; onSettle = null;
    cb?.(front());
  }

  return {
    get count() { return n; },
    get angle() { return angle; },
    get settled() { return settled; },
    get spinning() { return tween !== null; },
    frontIndex: front,

    /* 拖曳：deltaCards 是這次移動了幾張的距離 */
    dragStart() { if (tween || !n) return; dragging = true; settled = false; vel = 0; },
    dragMove(deltaCards) { if (dragging) angle += deltaCards; },
    dragEnd(velCards = 0) {
      if (!dragging) return;
      dragging = false;
      vel = Math.max(-maxSpeed, Math.min(maxSpeed, velCards));
    },

    /* 推一下（滾輪、方向鍵）：直接前進幾張 */
    nudge(steps) {
      if (tween || !n || dragging) return;
      const target = Math.round(angle) + steps;
      tween = { from: angle, to: target, t: 0, dur: 0.22, onDone: null };
      settled = false; vel = 0;
    },

    /* 命運輪盤：轉 turns 圈後停在 index，停下時呼叫 onDone(index) */
    spinTo(index, { turns = 2, dur = 2.6, onDone = null } = {}) {
      if (tween || !n || dragging) return false;
      const cur = angle;
      const delta = mod(index - mod(cur, n), n);          // 順向到目標的距離
      tween = { from: cur, to: cur + turns * n + delta, t: 0, dur, onDone };
      settled = false; vel = 0;
      return true;
    },

    step(dt) {
      if (!n || settled || dragging) return;
      if (tween) {
        tween.t = Math.min(tween.dur, tween.t + dt);
        const k = 1 - Math.pow(1 - tween.t / tween.dur, 3);  // 先快後慢
        angle = tween.from + (tween.to - tween.from) * k;
        if (tween.t >= tween.dur) {
          const cb = tween.onDone; angle = tween.to; tween = null;
          if (cb) onSettle = cb;
          finish();
        }
        return;
      }
      vel *= Math.exp(-friction * dt);
      angle += vel * dt;
      if (Math.abs(vel) < snapSpeed) {                      // 夠慢了：吸附到最近的一張
        const target = Math.round(angle);
        angle += (target - angle) * Math.min(1, dt * snapRate);
        if (Math.abs(target - angle) < 0.002) finish();
      }
    },

    /* 回傳正前方左右各 half 張：[{index, offset}]，offset 是與正前方的距離（可為小數）。
       卡片總數比視窗小時不會重複出現同一張 */
    visible(half) {
      if (!n) return [];
      const base = Math.round(angle);
      const frac = angle - base;
      const h = Math.min(half, Math.floor((n - 1) / 2));
      const out = [];
      for (let o = -h; o <= h; o++) out.push({ index: mod(base + o, n), offset: o - frac });
      if (n % 2 === 0 && h < half && n > 1) out.push({ index: mod(base + h + 1, n), offset: h + 1 - frac });
      return out;
    },
  };
}
