/* 魚缸：養釣到的魚。魚在缸裡游來游去；餵過飼料的魚比較活潑、會冒泡泡。規則在 systems/tank.js。
   有素材時：背景 scene.tank、魚 fish.<物品id>（沒有就退回 item.<物品id>，再沒有就畫佔位的魚）。 */
import { h } from './dom.js';

const COLORS = ['#ffb36b', '#ff7a90', '#8fd3ff', '#b7f0a0', '#e0b3ff'];
const REASON = { full: '魚缸滿了', 'no-feed': '沒有飼料了。商店有賣。', empty: '缸裡還沒有魚', cooldown: '今天的禮物領過了，明天再來', unhappy: '魚還沒吃飽，先餵牠們吧' };

export function tankView(game) {
  const { tank, inv, ui, assets, reg } = game;
  const cv = h('canvas', { class: 'tank-canvas', 'aria-hidden': 'true' });
  const g = cv.getContext('2d');
  const info = h('div', { class: 'tank-info', role: 'status', 'aria-live': 'polite' });
  const bar = h('div', { class: 'row' });
  let alive = true, raf = null, swimmers = [], last = performance.now();

  /* 把系統裡的魚對應成畫面上游動的魚（位置用編號算出固定的起點，不用亂數） */
  function sync() {
    const list = tank.list();
    swimmers = list.map((f, i) => swimmers[i] && swimmers[i].id === f.item.id ? { ...swimmers[i], happy: f.happy }
      : { id: f.item.id, name: f.item.name, happy: f.happy, x: 0.15 + ((i * 37) % 70) / 100, y: 0.25 + ((i * 53) % 50) / 100, dir: i % 2 ? 1 : -1, phase: i * 1.7, color: COLORS[reg.items.findIndex((it) => it.id === f.item.id) % COLORS.length] });
    info.textContent = list.length ? `${list.length} / ${tank.capacity} 條，其中 ${tank.happyCount()} 條吃飽了。` : '魚缸是空的。把釣到的魚放進來養吧。';
    const btn = (text, fn, disabled) => h('button', { class: 'btn', type: 'button', text, disabled, onclick: fn });
    bar.replaceChildren(
      btn('放魚進去', putIn, !tank.candidates().length || list.length >= tank.capacity),
      btn(`餵飼料（有 ${inv.count('feed')}）`, () => act(tank.feed(), '魚群圍過來吃飼料'), !list.length),
      btn('領禮物', () => { const r = tank.collect(); act(r, r.ok ? `魚吐出了 ${r.coins} 枚金幣` : ''); }, !tank.giftReady()),
      btn('撈一條回背包', takeOut, !list.length));
  }
  const act = (r, okText) => { ui.toast(r.ok ? okText : REASON[r.reason] || '現在不行'); sync(); };
  async function putIn() {
    const c = tank.candidates();
    const i = await ui.choose('要放哪一條？', c.map((e) => `${e.item.name} ×${e.count}`));
    if (i >= 0) act(tank.add(c[i].item.id), `${c[i].item.name}游進了魚缸`);
  }
  async function takeOut() {
    const list = tank.list();
    const i = await ui.choose('要撈哪一條？', list.map((f) => `${f.item.name}${f.happy ? '（吃飽了）' : ''}`));
    if (i >= 0) act(tank.remove(list[i].index), '撈回背包了');
  }

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;

    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2f8fb8'); bg.addColorStop(1, '#0d3554');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9b27a'; g.fillRect(0, H * 0.92, W, H * 0.08);                         // 底砂
    g.strokeStyle = '#3fa66a'; g.lineWidth = Math.max(3, W / 200); g.lineCap = 'round';    // 水草
    for (let i = 0; i < 7; i++) { const x = W * (0.08 + i * 0.14); g.beginPath(); g.moveTo(x, H * 0.93); g.quadraticCurveTo(x + Math.sin(t * 1.2 + i) * W * 0.02, H * 0.8, x + Math.sin(t * 0.9 + i * 2) * W * 0.03, H * (0.66 + (i % 3) * 0.04)); g.stroke(); }

    const size = Math.min(W, H) * 0.075;
    for (const f of swimmers) {
      const speed = f.happy ? 0.11 : 0.045;                                                // 吃飽的魚游得快
      f.x += f.dir * speed * dt;
      if (f.x > 0.92) { f.x = 0.92; f.dir = -1; } else if (f.x < 0.08) { f.x = 0.08; f.dir = 1; }
      const px = f.x * W, py = (f.y + Math.sin(t * (f.happy ? 1.6 : 0.8) + f.phase) * 0.03) * H * 0.85 + H * 0.04;
      const key = assets?.has(`fish.${f.id}`) ? `fish.${f.id}` : `item.${f.id}`;
      const img = assets?.image(key);
      g.save(); g.translate(px, py); g.scale(f.dir, 1);
      if (img) g.drawImage(img, -size, -size, size * 2, size * 2);
      else {
        g.fillStyle = f.color; g.beginPath(); g.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2); g.fill();
        const wag = Math.sin(t * (f.happy ? 9 : 4) + f.phase) * size * 0.25;
        g.beginPath(); g.moveTo(-size * 0.9, 0); g.lineTo(-size * 1.5, -size * 0.45 + wag); g.lineTo(-size * 1.5, size * 0.45 + wag); g.closePath(); g.fill();
        g.fillStyle = '#10141c'; g.beginPath(); g.arc(size * 0.55, -size * 0.12, size * 0.08, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      if (f.happy) {                                                                       // 泡泡
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
        for (let b = 0; b < 2; b++) { const k = ((t * 0.5 + f.phase + b * 0.5) % 1); g.beginPath(); g.arc(px + f.dir * size, py - k * H * 0.25, 2 + k * 5, 0, Math.PI * 2); g.stroke(); }
      }
    }
  }

  sync();
  const p = ui.panel({ title: '魚缸', scene: 'tank', cls: 'full', body: h('div', { class: 'tank' }, cv, h('div', { class: 'tank-ui' }, info, bar)),
    onClose: () => { alive = false; if (raf !== null) cancelAnimationFrame(raf); } });
  raf = requestAnimationFrame(frame);
  return p.closed;
}
