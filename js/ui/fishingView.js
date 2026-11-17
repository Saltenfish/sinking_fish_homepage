/* 釣魚畫面：全螢幕的水邊場景，有釣竿、釣線、漂浮的浮標、咬鉤的水花與釣起來的魚。
   規則全部在 systems/fishing.js，這裡只負責畫面與把「拉竿」傳過去。
   目前的景物是程式畫的佔位圖；有素材時：背景 scene.fishing、魚 fish.<物品id>。 */
import { h } from './dom.js';

const TEXT = {
  cast: '拋竿……',
  waiting: '浮標靜靜漂著……咬鉤時點畫面或按 E',
  bite: '！！　咬鉤了　！！',
  early: '太早拉了，魚被嚇跑了。',
  missed: '慢了一步，魚跑掉了。',
};
const CAST_MS = 550, CATCH_MS = 900;
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function fishingView(game) {
  const { fishing, clock, ui, assets } = game;
  const cv = h('canvas', { class: 'fish-canvas', 'aria-hidden': 'true' });
  const status = h('div', { class: 'fishing-status', role: 'status', 'aria-live': 'polite' });
  const pullBtn = h('button', { class: 'btn big', type: 'button', text: '拉竿' });
  const againBtn = h('button', { class: 'btn big', type: 'button', text: '再釣一次', hidden: true });
  const g = cv.getContext('2d');

  let alive = true, raf = null, t0 = performance.now();
  let phase = 'idle';            // cast → waiting → bite → result（畫面用的階段）
  let phaseAt = 0, result = null, splashAt = -1e9, baited = false;
  const say = (text, cls = '') => { if (status.textContent !== text) status.textContent = text; status.className = `fishing-status ${cls}`; };
  const setPhase = (p) => { phase = p; phaseAt = performance.now(); };

  function begin() {
    if (!fishing.start(clock.now())) return;
    baited = fishing.baited; result = null;
    pullBtn.hidden = false; againBtn.hidden = true;
    setPhase('cast'); say(baited ? `${TEXT.cast}（用了魚餌）` : TEXT.cast);
  }
  function finish(r) {
    result = r; setPhase('result'); splashAt = performance.now();
    say(r.state === 'caught' ? `釣到了：${r.item.name}！` : TEXT[r.state] || '', r.state === 'caught' ? 'caught' : '');
    pullBtn.hidden = true; againBtn.hidden = false;
  }
  function pull() {
    if (!fishing.active) { if (phase === 'result') begin(); return; }
    finish(fishing.pull(clock.now()));
  }
  pullBtn.addEventListener('click', pull);
  againBtn.addEventListener('click', begin);
  cv.addEventListener('pointerdown', pull);

  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
  }

  function draw(now) {
    const W = cv.width, H = cv.height, t = (now - t0) / 1000, sinceP = now - phaseAt;
    const tint = clock.tint(), night = tint.a / 0.42;
    const horizon = H * 0.42;
    // 天空與水面（顏色跟著現實時間變暗）
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, night > 0.5 ? '#141a3a' : '#9fd6ff'); sky.addColorStop(1, night > 0.5 ? '#2b3566' : '#e8f6ff');
    g.fillStyle = sky; g.fillRect(0, 0, W, horizon);
    g.fillStyle = night > 0.5 ? '#1f3a2c' : '#5f9e6e'; g.fillRect(0, horizon - H * 0.05, W, H * 0.05);
    const water = g.createLinearGradient(0, horizon, 0, H);
    water.addColorStop(0, night > 0.5 ? '#24456e' : '#5aa9d6'); water.addColorStop(1, night > 0.5 ? '#0e2038' : '#1f5f8f');
    g.fillStyle = water; g.fillRect(0, horizon, W, H - horizon);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(1, H / 400);
    for (let i = 0; i < 9; i++) {                         // 流動的波紋
      const y = horizon + (H - horizon) * ((i + 0.5) / 9), amp = 3 + i;
      g.beginPath();
      for (let x = 0; x <= W; x += 24) { const yy = y + Math.sin(x / (60 + i * 14) + t * (0.8 + i * 0.07) + i) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.stroke();
    }
    if (tint.a > 0) { g.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a * 0.5})`; g.fillRect(0, 0, W, H); }

    // 釣竿（微微晃動；咬鉤時被往下扯）
    const tug = phase === 'bite' ? Math.sin(now / 45) * H * 0.012 + H * 0.03 : 0;
    const base = { x: W * 0.06, y: H * 1.02 }, tip = { x: W * 0.32 + Math.sin(t * 1.3) * W * 0.004, y: H * 0.2 + Math.sin(t * 1.7) * H * 0.006 + tug };
    g.strokeStyle = '#6b4a34'; g.lineCap = 'round'; g.lineWidth = Math.max(3, H * 0.012);
    g.beginPath(); g.moveTo(base.x, base.y); g.quadraticCurveTo(W * 0.16, H * 0.5, tip.x, tip.y); g.stroke();

    // 浮標：拋竿時飛過去，之後隨水波起伏；咬鉤時下沉抖動
    const rest = { x: W * 0.64, y: horizon + (H - horizon) * 0.42 };
    let bob = { x: rest.x, y: rest.y + Math.sin(t * 2.1) * H * 0.008 }, showBob = phase !== 'idle';
    if (phase === 'cast') {
      const k = ease(sinceP / CAST_MS);
      bob = { x: tip.x + (rest.x - tip.x) * k, y: tip.y + (rest.y - tip.y) * k - Math.sin(k * Math.PI) * H * 0.22 };
      if (sinceP >= CAST_MS) { setPhase('waiting'); splashAt = now; say(TEXT.waiting); }
    } else if (phase === 'bite') bob = { x: rest.x + Math.sin(now / 30) * W * 0.004, y: rest.y + H * 0.03 + Math.sin(now / 50) * H * 0.006 };
    else if (phase === 'result' && result?.state === 'caught') showBob = false;

    const rings = (cx, cy, age, n) => {                    // 水花漣漪
      for (let i = 0; i < n; i++) {
        const k = age / 900 - i * 0.22;
        if (k <= 0 || k >= 1) continue;
        g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; g.lineWidth = Math.max(1, H / 300);
        g.beginPath(); g.ellipse(cx, cy, W * 0.012 + k * W * 0.06, (W * 0.012 + k * W * 0.06) * 0.32, 0, 0, Math.PI * 2); g.stroke();
      }
    };
    rings(rest.x, rest.y, now - splashAt, 3);
    if (phase === 'bite') rings(rest.x, rest.y, (now % 600) * 1.5, 2);

    if (showBob) {
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1, H / 500);       // 釣線（有點下垂）
      g.beginPath(); g.moveTo(tip.x, tip.y); g.quadraticCurveTo((tip.x + bob.x) / 2, Math.max(tip.y, bob.y) + (phase === 'bite' ? 0 : H * 0.05), bob.x, bob.y); g.stroke();
      const r = Math.max(5, H * 0.014);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bob.x, bob.y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e5484d'; g.beginPath(); g.arc(bob.x, bob.y, r, Math.PI, 0); g.fill();
      if (phase === 'bite') { g.fillStyle = '#f6c453'; g.font = `bold ${Math.round(H * 0.08)}px sans-serif`; g.textAlign = 'center'; g.fillText('！', bob.x, bob.y - H * 0.06 + Math.sin(now / 60) * 3); }
    }

    // 釣起來的魚：從水面沿弧線飛到畫面中央
    if (phase === 'result' && result?.state === 'caught') {
      const k = ease(sinceP / CATCH_MS);
      const fx = rest.x + (W * 0.5 - rest.x) * k, fy = rest.y + (H * 0.3 - rest.y) * k - Math.sin(k * Math.PI) * H * 0.18;
      const size = H * (0.06 + 0.06 * k);
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(fx, fy - size * 0.4); g.stroke();
      const key = assets?.has(`fish.${result.item.id}`) ? `fish.${result.item.id}` : `item.${result.item.id}`;
      const img = assets?.image(key);
      if (img) g.drawImage(img, fx - size, fy - size, size * 2, size * 2);
      else {
        g.save(); g.translate(fx, fy); g.rotate(Math.sin(now / 90) * 0.25 * (1 - k * 0.6));
        g.fillStyle = '#ffb36b'; g.beginPath(); g.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(-size * 0.9, 0); g.lineTo(-size * 1.5, -size * 0.45); g.lineTo(-size * 1.5, size * 0.45); g.closePath(); g.fill();
        g.fillStyle = '#1b2030'; g.beginPath(); g.arc(size * 0.55, -size * 0.12, size * 0.08, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    resize();
    if (fishing.active && phase !== 'cast') {             // 依釣魚系統的狀態切換畫面階段
      const r = fishing.update(clock.now());
      if (r.state === 'missed') finish(r);
      else if (r.state === 'bite' && phase !== 'bite') { setPhase('bite'); say(TEXT.bite, 'bite'); }
    } else if (fishing.active) { const r = fishing.update(clock.now()); if (r.state === 'missed') finish(r); }
    draw(now);
  }

  const p = ui.panel({
    title: '釣魚', scene: 'fishing', cls: 'full',
    body: h('div', { class: 'fishing' }, cv, h('div', { class: 'fishing-ui' }, status, h('div', { class: 'row' }, pullBtn, againBtn))),
    onClose: () => { alive = false; if (raf !== null) cancelAnimationFrame(raf); fishing.cancel(); },
    onKey: (e) => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) pull(); return true; } return false; },
  });
  begin();
  raf = requestAnimationFrame(frame);
  return p.closed;
}
