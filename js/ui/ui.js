/* 介面管理：視窗堆疊、對話框、選項、通知、互動提示。
   只要有視窗開著，isBlocking() 就是 true，地圖會停止接收操作。 */
import { h } from './dom.js';

export function createUI({ root, bus }) {
  const layer = h('div', { class: 'ui-layer' });
  const toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  const prompt = h('div', { class: 'prompt', hidden: true });
  root.append(prompt, layer, toasts);

  const stack = [];          // 開著的視窗，最後一個在最上面
  const views = new Map();

  function close(modal) {
    const i = stack.indexOf(modal);
    if (i === -1) return;                       // 已經關過了
    stack.splice(i, 1);
    modal.el.remove();
    try { modal.onClose?.(); } catch (e) { console.error('[ui] onClose 出錯', e); }
    if (!stack.length) bus.emit('ui:unblock', {});
  }
  function open(modal) {
    stack.push(modal);
    layer.append(modal.el);
    prompt.hidden = true;
    bus.emit('ui:block', {});
    return () => close(modal);
  }

  const ui = {
    isBlocking: () => stack.length > 0,

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
      const s = `E　${text}`;
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
          onKey: (e) => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) next(); return true; } return false; },
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
          h('div', { class: 'dialog-hint', text: '數字鍵選擇・Esc 取消' }));
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

    /* 一般視窗。回傳 {close, closed}，closed 是視窗關掉時完成的 Promise */
    panel({ title, body, onKey, onClose, cls = '' }) {
      let closeIt = () => {};
      const closed = new Promise((resolve) => {
        const el = h('div', { class: `panel ${cls}`, role: 'dialog', 'aria-label': title },
          h('div', { class: 'panel-head' }, h('b', { text: title }),
            h('button', { class: 'btn', type: 'button', text: '✕', 'aria-label': '關閉', onclick: () => closeIt() })),
          h('div', { class: 'panel-body' }, body));
        closeIt = open({ el, onKey, onClose: () => { try { onClose?.(); } finally { resolve(); } } });
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
