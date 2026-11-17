/* 召喚模式：環形轉盤。卡片預設背面朝外。
   不管總共幾張卡，畫面上只有正前方附近的十幾個元素，轉動時重複利用。 */
import { h } from './dom.js';
import { CONFIG } from '../config.js';
import { createRing } from '../systems/ringModel.js';
import { cssUrl } from './icon.js';

const GAP = 92;   // 相鄰兩張卡的水平距離（像素）

export function ringView(game) {
  const { reg, cards, ui } = game;
  const n = reg.characters.length;
  if (!n) return ui.say(['卡環上還沒有任何卡片。']);

  const model = createRing({ count: n });
  const half = CONFIG.RING_WINDOW;
  let showFaces = false, rafId = null, lastT = 0, alive = true, summoning = false;

  const stage = h('div', { class: `ring-stage back-${game.shop.back()}` });   // 卡背花色由供奉石決定
  const backImg = game.assets?.url(`card.back.${game.shop.back()}`);            // 有卡背圖檔就用圖檔
  if (backImg) { stage.style.setProperty('--back-img', cssUrl(backImg)); stage.classList.add('has-back-img'); }
  const slots = Array.from({ length: half * 2 + 2 }, () => {
    const el = h('div', { class: 'rcard', hidden: true });
    stage.append(el);
    return { el, key: '' };
  });
  const counter = h('div', { class: 'ring-count' });
  const title = h('div', { class: 'ring-title' });

  function paint() {
    const vis = model.visible(half);
    slots.forEach((slot, i) => {
      const v = vis[i];
      if (!v) { if (!slot.el.hidden) slot.el.hidden = true; return; }
      const c = reg.characters[v.index];
      const owned = cards.has(c.id);
      const face = showFaces && owned;
      const key = `${v.index}|${owned}|${face}`;
      if (slot.key !== key) {                    // 內容有變才動 DOM
        slot.key = key;
        slot.el.className = `rcard r-${c.rarity || 'N'}${owned ? ' owned' : ''}${face ? ' face' : ''}`;
        slot.el.textContent = face ? c.name : owned ? '✦' : '';
        slot.el.dataset.index = String(v.index);
      }
      const o = v.offset, a = Math.abs(o);
      slot.el.style.transform = `translate3d(${(o * GAP).toFixed(1)}px,0,${(-a * 70).toFixed(1)}px) rotateY(${(-o * 14).toFixed(1)}deg)`;
      slot.el.style.opacity = String(Math.max(0, 1 - a / (half + 0.5)));
      slot.el.style.zIndex = String(100 - Math.round(a * 10));
      if (slot.el.hidden) slot.el.hidden = false;
    });
    counter.textContent = `已召喚 ${cards.ownedCount()} / ${n}`;
    const f = reg.characters[model.frontIndex()];
    title.textContent = model.settled && f && cards.has(f.id) ? f.name : model.settled ? '？？？' : '';
  }

  function frame(t) {
    if (!alive) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    model.step(dt);
    paint();
  }

  async function summonFront() {
    if (summoning || !model.settled || model.spinning) return;
    const c = reg.characters[model.frontIndex()];
    if (!c) return;
    summoning = true;
    try {
      const r = cards.summon(c.id);
      await ui.show('summonFx', { id: c.id, first: !!r?.first });   // 召喚特效（可跳過）
      await ui.show('card', { id: c.id });
    }
    finally { summoning = false; }
  }
  function randomSpin() {
    if (summoning) return;
    const idx = cards.randomIndex();
    if (idx >= 0) model.spinTo(idx, { onDone: () => { summonFront(); } });
  }

  /* 拖曳與點擊 */
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (model.spinning || summoning) return;
    drag = { x: e.clientX, startX: e.clientX, t: performance.now(), v: 0, moved: false };
    try { stage.setPointerCapture(e.pointerId); } catch { /* 略 */ }
    model.dragStart();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now(), dx = e.clientX - drag.x, dt = Math.max(1, now - drag.t);
    if (Math.abs(e.clientX - drag.startX) > 6) drag.moved = true;
    model.dragMove(-dx / GAP);
    drag.v = 0.6 * drag.v + 0.4 * ((-dx / GAP) / (dt / 1000));
    drag.x = e.clientX; drag.t = now;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    const stale = performance.now() - d.t > 80;      // 停住一下才放手：不甩出去
    model.dragEnd(d.moved && !stale ? d.v : 0);
    if (d.moved || e.type === 'pointercancel') return;
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.rcard');
    if (!hit) return;
    const idx = Number(hit.dataset.index), front = model.frontIndex();
    if (idx === front) summonFront();
    else { let steps = idx - front; if (steps > n / 2) steps -= n; if (steps < -n / 2) steps += n; model.nudge(steps); }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); model.nudge(Math.sign(e.deltaY || e.deltaX)); }, { passive: false });

  const btn = (text, fn) => h('button', { class: 'btn', type: 'button', text, onclick: fn });
  const faceBtn = btn('顯示已收集', () => { showFaces = !showFaces; faceBtn.textContent = showFaces ? '全部蓋回' : '顯示已收集'; });
  const body = h('div', { class: 'ring' }, counter, stage, title,
    h('div', { class: 'row' }, btn('◀', () => model.nudge(-1)), btn('召喚這張', summonFront), btn('▶', () => model.nudge(1))),
    h('div', { class: 'row' }, btn('命運輪盤', randomSpin), faceBtn),
    h('div', { class: 'hint kbd', text: '拖曳／滾輪／← → 轉動・Enter 召喚・R 隨機' }),
    h('div', { class: 'hint tap', text: '左右滑動轉動卡環・點正中央的卡召喚' }));

  const p = ui.panel({
    title: '召喚卡環', body, cls: 'xl', scene: 'ring',
    onClose: () => { alive = false; if (rafId !== null) cancelAnimationFrame(rafId); },
    onKey: (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { model.nudge(-1); return true; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { model.nudge(1); return true; }
      if (['Enter', 'KeyE', 'Space'].includes(e.code)) { if (!e.repeat) summonFront(); return true; }
      if (e.code === 'KeyR') { if (!e.repeat) randomSpin(); return true; }
      return false;
    },
  });
  paint();
  rafId = requestAnimationFrame((t) => { lastT = t; frame(t); });
  return p.closed;
}
