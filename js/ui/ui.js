/* 介面管理：視窗堆疊、對話框、選項、通知、互動提示、全螢幕畫面。
   只要有視窗開著，isBlocking() 就是 true，地圖會停止接收操作。
   panel() 開的是全螢幕畫面（有切入、切出動畫）；say() / choose() 是畫面下方的對話框。 */
import { h } from './dom.js';

export function createUI({ root, bus, assets = null, animMs = 220 }) {
  const layer = h('div', { class: 'ui-layer' });
  const toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  // 互動提示本身也是按鈕：點它等於按互動鍵（手機上最直覺）
  const prompt = h('button', { class: 'prompt', type: 'button', hidden: true, onclick: () => { if (!stack.length) bus.emit('input:action', { action: 'interact' }); } });
  // 觸控裝置：一開始就判斷（不等第一次觸碰），提示不顯示鍵盤按鍵，並在根元素加上 touch-ui 讓 CSS 隱藏鍵盤說明
  let touchUi = false;
  const setTouch = () => { if (!touchUi) { touchUi = true; root.classList.add('touch-ui'); prompt.textContent = ''; } };
  if (window.matchMedia?.('(pointer: coarse)').matches) setTouch();
  window.addEventListener('touchstart', setTouch, { once: true, passive: true });
  root.append(prompt, layer, toasts);

  const stack = [];          // 開著的視窗，最後一個在最上面

  /* 防止「幽靈點擊」：手指點了地圖或互動鍵 → 視窗立刻出現在手指底下 → 同一次觸碰產生的 click 落在新視窗上，
     對話框瞬間被關掉或按鈕被誤觸。做法：觸控時，視窗剛打開的短時間內，吞掉落在介面層上的 click。 */
  const GHOST_MS = 350;
  let lastOpenAt = -1e9, lastPointer = 'mouse';
  window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; }, true);
  layer.addEventListener('click', (e) => {
    if (lastPointer === 'touch' && performance.now() - lastOpenAt < GHOST_MS) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  const views = new Map();

  function close(modal) {
    const i = stack.indexOf(modal);
    if (i === -1) return;                       // 已經關過了
    stack.splice(i, 1);
    if (modal.animated && animMs > 0) {          // 全螢幕畫面：先播切出動畫再移除（邏輯上已經關閉）
      modal.el.classList.add('leaving');
      setTimeout(() => modal.el.remove(), animMs);
    } else modal.el.remove();
    try { modal.onClose?.(); } catch (e) { console.error('[ui] onClose 出錯', e); }
    if (!stack.length) bus.emit('ui:unblock', {});
  }
  function open(modal) {
    stack.push(modal);
    lastOpenAt = performance.now();
    layer.append(modal.el);
    prompt.hidden = true;
    bus.emit('ui:block', {});
    return () => close(modal);
  }

  const ui = {
    isBlocking: () => stack.length > 0,
    closeTop() { const top = stack[stack.length - 1]; if (top) close(top); },

    /* 鍵盤事件交給最上層視窗；視窗沒處理的 Esc 會關掉它 */
    handleKey(e) {
      const top = stack[stack.length - 1];
      if (!top) return;
      let used = false;
      try { used = top.onKey?.(e) === true; } catch (err) { console.error('[ui] onKey 出錯', err); }
      if (used) e.preventDefault();
      else if (e.code === 'Escape') { e.preventDefault(); close(top); }
    },

    setPrompt(text) {
      if (stack.length || !text) { prompt.hidden = true; return; }
      const s = touchUi ? `▶ 點這裡：${text}` : `F　${text}`;   // 手機上不出現按鍵名稱，避免以為要按鍵盤
      if (prompt.textContent !== s) prompt.textContent = s;
      prompt.hidden = false;
    },

    toast(text) {
      const el = h('div', { class: 'toast', text });
      toasts.append(el);
      while (toasts.children.length > 4) toasts.firstChild.remove();
      setTimeout(() => el.remove(), 2600);
    },

    /* 對話框：一句一句顯示，點擊或按 E / 空白 / Enter 下一句。全部看完才結束 */
    say(lines, { name } = {}) {
      const list = (Array.isArray(lines) ? lines : [lines]).filter((l) => l !== undefined && l !== null).map(String);
      if (!list.length) return Promise.resolve();
      return new Promise((resolve) => {
        let i = 0;
        const text = h('div', { class: 'dialog-text', text: list[0] });
        const next = () => { i += 1; if (i >= list.length) closeIt(); else text.textContent = list[i]; };
        const el = h('div', { class: 'dialog', onclick: next },
          name ? h('div', { class: 'dialog-name', text: name }) : null, text, h('div', { class: 'dialog-hint', text: '▼' }));
        const closeIt = open({
          el, onClose: resolve,
          onKey: (e) => { if (['KeyF', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) next(); return true; } return false; },
        });
      });
    },

    /* 選項：回傳選到第幾個（0 起算），按 Esc 取消則回傳 -1 */
    choose(title, options) {
      return new Promise((resolve) => {
        let result = -1;
        const pickIt = (i) => { result = i; closeIt(); };
        const el = h('div', { class: 'dialog choose' },
          h('div', { class: 'dialog-name', text: title }),
          options.map((o, i) => h('button', { class: 'btn choice', type: 'button', text: `${i + 1}. ${o}`, onclick: (e) => { e.stopPropagation(); pickIt(i); } })),
          h('div', { class: 'dialog-hint' }, h('span', { class: 'kbd', text: '數字鍵選擇・Esc 取消' }), h('span', { class: 'tap', text: '點選一個選項' })));
        const closeIt = open({
          el, onClose: () => resolve(result),
          onKey: (e) => {
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
            if (m && Number(m[1]) <= options.length) { pickIt(Number(m[1]) - 1); return true; }
            return false;
          },
        });
      });
    },

    /* 全螢幕畫面。回傳 {close, closed}，closed 是畫面關掉時完成的 Promise。
       scene：畫面名稱，會加上 class「scene-名稱」，並套用素材 scene.<名稱> 當背景（有的話）
       cls：  內容寬度 wide / xl / full（full = 內容也填滿，給釣魚、魚缸這類整面動畫用） */
    panel({ title, body, onKey, onClose, cls = '', scene = '' }) {
      let closeIt = () => {};
      const closed = new Promise((resolve) => {
        const el = h('div', { class: `panel ${cls}${scene ? ` scene-${scene}` : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('div', { class: 'panel-head' }, h('b', { text: title }),
            h('button', { class: 'btn', type: 'button', text: '✕ 離開', 'aria-label': '關閉', onclick: () => closeIt() })),
          h('div', { class: 'panel-body' }, body));
        const bg = scene ? assets?.url(`scene.${scene}`) : null;
        if (bg) { el.style.backgroundImage = `url("${bg}")`; el.classList.add('has-bg'); }
        closeIt = open({ el, onKey, animated: true, onClose: () => { try { onClose?.(); } finally { resolve(); } } });
      });
      return { close: () => closeIt(), closed };
    },

    /* 沒有標題列的全螢幕覆蓋層（召喚特效用）。回傳 {close, closed} */
    overlay({ el, onKey, onClose, dismissable = true }) {
      let closeIt = () => {};
      const closed = new Promise((resolve) => {
        closeIt = open({ el, animated: false, onClose: () => { try { onClose?.(); } finally { resolve(); } },
          onKey: (e) => { if (onKey?.(e) === true) return true; return e.code === 'Escape' && !dismissable; } });
      });
      return { close: () => closeIt(), closed };
    },

    /* 畫面註冊與開啟：地圖物件用 ui.show('名稱') 開畫面，不需要知道畫面怎麼做 */
    register(name, fn) { views.set(name, fn); },
    show(name, args) {
      const fn = views.get(name);
      if (!fn) { console.error(`[ui] 沒有這個畫面：${name}`); return Promise.resolve(); }
      return Promise.resolve().then(() => fn(args)).catch((e) => { console.error(`[ui] 畫面「${name}」出錯`, e); });
    },
  };
  return ui;
}
