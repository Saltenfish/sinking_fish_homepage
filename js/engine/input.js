/* 輸入：鍵盤與點擊。
   ・有視窗開著時（ui.isBlocking()），按鍵全部交給視窗處理，不會同時觸發地圖上的動作
   ・在文字輸入框裡打字時，只有 Esc 會被處理 */
const MOVE = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const ACTIONS = { KeyE: 'interact', Space: 'interact', Enter: 'interact', KeyB: 'bag', KeyL: 'list', Escape: 'menu' };

export function createInput({ target = window, canvas, ui, bus, viewW, viewH }) {
  const held = new Set();
  const typing = (e) => { const t = e.target; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };

  target.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ui.isBlocking()) {
      if (typing(e) && e.code !== 'Escape') return;
      ui.handleKey(e);
      return;
    }
    if (typing(e)) return;
    if (MOVE[e.code]) { held.add(e.code); e.preventDefault(); return; }
    const action = ACTIONS[e.code];
    if (action) { e.preventDefault(); if (!e.repeat) bus.emit('input:action', { action }); }
  });
  target.addEventListener('keyup', (e) => { held.delete(e.code); });
  target.addEventListener('blur', () => held.clear());
  bus.on('ui:block', () => held.clear());      // 視窗打開時放開所有方向鍵，關掉後不會自己走

  canvas?.addEventListener('pointerdown', (e) => {
    if (ui.isBlocking() || e.button > 0) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    bus.emit('input:tap', { x: (e.clientX - r.left) * (viewW / r.width), y: (e.clientY - r.top) * (viewH / r.height) });
  });

  return {
    /* 目前的移動方向（-1/0/1） */
    axis() {
      let x = 0, y = 0;
      for (const code of held) { x += MOVE[code][0]; y += MOVE[code][1]; }
      return { x: Math.sign(x), y: Math.sign(y) };
    },
    clear() { held.clear(); },
  };
}
