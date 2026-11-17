/* 觸控操作：左下角虛擬搖桿（輕推 = 潛行，推到底 = 正常走），右下角互動鍵。
   只在觸控裝置上顯示；有視窗開著時自動隱藏。 */
import { h } from './dom.js';

const RADIUS = 48;   // 搖桿可推動的半徑（像素）

export function createTouchControls({ root, input, bus, ui, win = window }) {
  const knob = h('div', { class: 'stick-knob' });
  const base = h('div', { class: 'stick', 'aria-hidden': 'true' }, knob);
  const act = h('button', { class: 'touch-act', type: 'button', text: '互動', 'aria-label': '互動' });
  const wrap = h('div', { class: 'touch', hidden: true }, base, act);
  root.append(wrap);

  let pid = null, cx = 0, cy = 0;
  const set = (x, y) => { knob.style.transform = `translate(${x * RADIUS}px,${y * RADIUS}px)`; input.setStick(x, y); };
  const move = (e) => {
    let dx = (e.clientX - cx) / RADIUS, dy = (e.clientY - cy) / RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    set(dx, dy);
  };
  base.addEventListener('pointerdown', (e) => {
    if (pid !== null || ui.isBlocking()) return;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; pid = e.pointerId;
    try { base.setPointerCapture(pid); } catch { /* 略 */ }
    e.preventDefault(); move(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; set(0, 0); };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  base.addEventListener('lostpointercapture', end);
  // 用 pointerdown 觸發：另一隻手指還按著搖桿時，瀏覽器不一定會送出 click
  let handledAt = -1e9;
  const fire = () => { if (!ui.isBlocking()) bus.emit('input:action', { action: 'interact' }); };
  act.addEventListener('pointerdown', (e) => { e.preventDefault(); handledAt = performance.now(); fire(); });
  act.addEventListener('click', () => { if (performance.now() - handledAt > 700) fire(); });   // 鍵盤或輔助工具觸發的 click

  bus.on('ui:block', () => { pid = null; set(0, 0); wrap.classList.add('covered'); });
  bus.on('ui:unblock', () => wrap.classList.remove('covered'));

  const show = () => { wrap.hidden = false; };
  if (win.matchMedia?.('(pointer: coarse)').matches) show();
  win.addEventListener('touchstart', show, { once: true, passive: true });   // 觸控螢幕筆電：第一次碰螢幕時才出現
  return { show, el: wrap };
}
