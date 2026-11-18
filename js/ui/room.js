/* ============================================================
   可以走進去的房間（賭場、成就小屋…）
   ・整個畫面是一張 480 × 270 的像素房間圖，等比例放大；房間裡的東西用同樣的座標擺上去
   ・可以點的東西（hotspot）：滑鼠移過去會微微發光並顯示名字，點下去做事（通常是切到另一個畫面）
   ・切畫面時整個房間淡出淡入，不會跳出任何對話框
   ・按 Esc：在子畫面時回上一層，在最外層時離開房間
   用法：const room = openRoom(game, { title, scene, onClose });
         room.show({ bg: '素材鍵', back: () => 回上一層的函式 或 null, build: (stage) => { ...在 stage 上放東西... } });
============================================================ */
import { h } from './dom.js';

export const ROOM_W = 480, ROOM_H = 270;

/* 純函式：房間要放大幾倍。直向手機上，房間至少放大到 minPortrait 倍，左右可以捲動 */
export function roomScale(viewW, viewH, { minPortrait = 1.6 } = {}) {
  const fit = Math.min(viewW / ROOM_W, viewH / ROOM_H);
  if (viewH > viewW && fit * ROOM_W >= viewW - 1) return Math.max(fit, Math.min(viewH / ROOM_H, minPortrait));
  return fit;
}

/* 放一個元素到房間座標上（單位是房間像素） */
export function place(el, x, y, w, h) {
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, ...(w !== undefined ? { width: `${w}px` } : {}), ...(h !== undefined ? { height: `${h}px` } : {}) });
  return el;
}

export function openRoom(game, { title, scene = '', onClose, onKey } = {}) {
  const { ui, assets } = game;
  const stage = h('div', { class: 'room-stage' });
  const holder = h('div', { class: 'room-holder' }, stage);
  const viewport = h('div', { class: 'room-viewport' }, holder);
  // 直拿手機時房間比畫面寬：下面空出來的地方放「左右滑動」的提示
  const frame = h('div', { class: 'room-frame' }, viewport, h('div', { class: 'room-swipe', 'aria-hidden': 'true', text: '← 左右滑動看看房間 →' }));
  let back = null, alive = true, cleanup = [];

  function layout() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    if (!vw || !vh) return;
    const s = roomScale(vw, vh);
    stage.style.transform = `scale(${s})`;
    holder.style.width = `${Math.floor(ROOM_W * s)}px`;
    holder.style.height = `${Math.floor(ROOM_H * s)}px`;
    const over = Math.max(0, ROOM_W - vw / s);                 // 有多少房間像素露在畫面外（直向手機才會有）
    stage.style.setProperty('--over', `${over}px`);
    scale = s;
    frame.classList.toggle('scrolls', holder.offsetWidth > vw + 1);
    focusScroll();
    pin();
  }
  /* 「返回」和金幣一直貼在看得到的左上／右上角，不會被捲出畫面 */
  let scale = 1, focusX = ROOM_W / 2;
  /* 直向手機：把畫面捲到這個畫面最重要的地方（預設房間中間） */
  function focusScroll() { const vw = viewport.clientWidth; if (holder.offsetWidth > vw) viewport.scrollLeft = Math.max(0, focusX * scale - vw / 2); }
  function pin() { stage.style.setProperty('--sx', `${viewport.scrollLeft / scale}px`); }
  viewport.addEventListener('scroll', pin, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null;

  const room = {
    stage,
    get alive() { return alive; },
    /* 換畫面：清空房間、換背景、呼叫 build 擺東西。淡出淡入 */
    show({ bg, back: b = null, build, focus = ROOM_W / 2 }) {
      back = b; focusX = focus;
      for (const fn of cleanup.splice(0)) { try { fn(); } catch (e) { console.error('[room] 清理出錯', e); } }
      stage.classList.add('fading');
      const swap = () => {
        if (!alive) return;
        stage.replaceChildren();
        const url = bg ? assets?.url(bg) : null;
        stage.style.backgroundImage = url ? `url("${url}")` : '';
        if (b) stage.append(place(h('button', { class: 'btn room-back', type: 'button', text: '← 返回', onclick: () => b() }), 8, 8));
        try { build(stage); } catch (e) { console.error('[room] 畫面建立失敗', e); }
        focusScroll(); pin();
        requestAnimationFrame(() => stage.classList.remove('fading'));
      };
      if (stage.childElementCount) setTimeout(swap, 110); else swap();
    },
    /* 子畫面裡登記「離開這個畫面時要做的事」（停計時器、結算等） */
    onLeave(fn) { cleanup.push(fn); },
    /* 房間裡可以點的東西：滑鼠移過去發光、顯示名字 */
    hotspot({ x, y, w, h: hh, sprite, label, onClick, cls = '' }) {
      const url = sprite ? assets?.url(sprite) : null;
      const el = h('button', { class: `hot ${cls}`, type: 'button', 'aria-label': label || '' },
        url ? h('img', { src: url, alt: '', draggable: false }) : null,
        label ? h('span', { class: 'hot-label', text: label }) : null);
      el.addEventListener('click', (e) => { e.stopPropagation(); onClick?.(); });
      stage.append(place(el, x, y, w, hh));
      return el;
    },
    img(key, x, y, w, hh, cls = '') {
      const url = assets?.url(key);
      const el = h('img', { class: `room-img ${cls}`, alt: '', draggable: false, src: url || '' });
      if (!url) el.hidden = true;
      stage.append(place(el, x, y, w, hh));
      return el;
    },
    add(el, x, y, w, hh) { stage.append(place(el, x, y, w, hh)); return el; },
    close: () => panel.close(),
  };

  const panel = ui.panel({
    title, scene, cls: 'full room', body: frame,
    onKey: (e) => {
      if (onKey?.(e) === true) return true;
      if (e.code === 'Escape' && back) { back(); return true; }
      return false;
    },
    onClose: () => {
      alive = false;
      ro?.disconnect();
      for (const fn of cleanup.splice(0)) { try { fn(); } catch (err) { console.error('[room] 清理出錯', err); } }
      onClose?.();
    },
  });
  ro?.observe(viewport);
  requestAnimationFrame(layout);
  room.closed = panel.closed;
  return room;
}

/* 出幣口：遊戲贏的金幣掉進這裡，點一下收進錢包。
   from：金幣從哪裡掉下來（房間座標）。回傳 {drop(金額), refresh()} */
export function coinTray(game, room, { x, y, w, h: hh, from }) {
  const { casino, ui, assets } = game;
  const coinUrl = assets?.url('ui.coin') || 'assets/ui/coin.png';
  const label = h('span', { class: 'tray-label' });
  const el = room.add(h('button', { class: 'tray', type: 'button', 'aria-label': '出幣口' }, label), x, y, w, hh);
  const pile = [];
  function refresh() {
    const n = casino.tray();
    label.textContent = n > 0 ? `點一下拾取 ${n}` : '出幣口';
    el.classList.toggle('has-coins', n > 0);
    while (pile.length > Math.min(14, Math.ceil(n / 10))) pile.pop().remove();
    while (pile.length < Math.min(14, Math.ceil(n / 10))) {          // 出幣口裡堆著的金幣
      const i = pile.length;
      const c = h('img', { class: 'tray-coin', src: coinUrl, alt: '' });
      room.add(c, x + 6 + (i * 11) % (w - 18), y + hh - 14 - Math.floor(i / Math.floor((w - 18) / 11)) * 4, 12, 12);
      pile.push(c);
    }
  }
  /* 金幣一枚一枚從 from 掉進出幣口 */
  function drop(amount) {
    const n = Math.min(12, Math.max(1, Math.ceil(amount / 10)));
    for (let i = 0; i < n; i++) {
      const c = h('img', { class: 'falling-coin', src: coinUrl, alt: '' });
      c.style.setProperty('--dx', `${x + 10 + Math.random() * (w - 30) - from.x}px`);
      c.style.setProperty('--dy', `${y + hh - 16 - from.y}px`);
      c.style.animationDelay = `${i * 70}ms`;
      room.add(c, from.x, from.y, 12, 12);
      setTimeout(() => c.remove(), 900 + i * 70);
    }
    setTimeout(refresh, 600 + n * 70);
  }
  el.addEventListener('click', () => {
    const got = casino.pickup();
    if (got > 0) {
      for (const c of pile.splice(0)) { c.classList.add('picked'); setTimeout(() => c.remove(), 400); }
      ui.toast(`拾取 ${got} 金幣`);
    }
    refresh();
  });
  refresh();
  return { drop, refresh, el };
}

/* 中獎特效：畫面閃一下、灑出星星、跳出大字 */
export function winBurst(room, { x, y, text, big = false }) {
  const flash = room.add(h('div', { class: `win-flash${big ? ' big' : ''}` }), 0, 0, 480, 270);
  const banner = room.add(h('div', { class: `win-banner${big ? ' big' : ''}`, text }), x - 100, y - 14, 200);
  const stars = [];
  for (let i = 0; i < (big ? 22 : 12); i++) {
    const s = h('i', { class: 'win-star' });
    s.style.setProperty('--a', `${(i * 360) / (big ? 22 : 12)}deg`);
    s.style.setProperty('--d', `${40 + (i * 37) % 50}px`);
    stars.push(room.add(s, x, y, 6, 6));
  }
  setTimeout(() => { flash.remove(); banner.remove(); stars.forEach((s) => s.remove()); }, big ? 2200 : 1500);
}
