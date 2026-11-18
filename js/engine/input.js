/* 輸入：鍵盤、點擊、觸控搖桿。
   ・有視窗開著時（ui.isBlocking()），按鍵全部交給視窗處理，不會同時觸發地圖上的動作
   ・在文字輸入框裡打字時，只有 Esc 會被處理
   ・F／空白／Enter 互動，E（或 B）開背包
   ・axis() 回傳 {x, y, mag}：x, y 是方向（單位向量），mag 是速度倍率（1 正常、SNEAK 潛行、0 沒動） */
const MOVE = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
const ACTIONS = { KeyF: 'interact', Space: 'interact', Enter: 'interact', KeyE: 'bag', KeyB: 'bag', KeyL: 'list', KeyM: 'map', Escape: 'menu' };
const DEADZONE = 0.22, STICK_RUN = 0.62;

/* 純函式：搖桿向量 → {x, y, mag} */
export function stickToAxis(sx, sy, sneak) {
  const len = Math.hypot(sx, sy);
  if (!(len > DEADZONE)) return { x: 0, y: 0, mag: 0 };
  return { x: sx / len, y: sy / len, mag: len < STICK_RUN ? sneak : 1 };
}

export function createInput({ target = window, canvas, ui, bus, camera, sneak = 0.4 }) {
  const held = new Set();
  let shift = false;
  const stick = { x: 0, y: 0 };
  const typing = (e) => { const t = e.target; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };

  target.addEventListener('keydown', (e) => {
    shift = e.shiftKey;
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
  target.addEventListener('keyup', (e) => { shift = e.shiftKey; held.delete(e.code); });
  const release = () => { held.clear(); shift = false; stick.x = 0; stick.y = 0; };
  target.addEventListener('blur', release);
  bus.on('ui:block', release);      // 視窗打開時放開所有方向，關掉後不會自己走

  canvas?.addEventListener('pointerdown', (e) => {
    if (ui.isBlocking() || e.button > 0) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    bus.emit('input:tap', { x: (e.clientX - r.left) * (camera.viewW / r.width), y: (e.clientY - r.top) * (camera.viewH / r.height) });
  });

  return {
    axis() {
      let x = 0, y = 0;
      for (const code of held) { x += MOVE[code][0]; y += MOVE[code][1]; }
      x = Math.sign(x); y = Math.sign(y);
      if (x || y) { const len = Math.hypot(x, y); return { x: x / len, y: y / len, mag: shift ? sneak : 1 }; }
      return stickToAxis(stick.x, stick.y, sneak);
    },
    /* 觸控搖桿回報目前的推動量（各軸 -1 ~ 1） */
    setStick(x, y) { stick.x = Number.isFinite(x) ? x : 0; stick.y = Number.isFinite(y) ? y : 0; },
    clear: release,
  };
}
