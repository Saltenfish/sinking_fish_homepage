/* 主迴圈：邏輯固定每秒 60 次更新，畫面跟著螢幕更新率。分頁切到背景時自動暫停。 */
export function createLoop({ update, render, raf = (f) => requestAnimationFrame(f), caf = (id) => cancelAnimationFrame(id), doc = globalThis.document }) {
  const STEP = 1 / 60, MAX_STEPS = 5;
  let id = null, last = 0, acc = 0, running = false, wanted = false;

  function frame(t) {
    if (!running) return;
    id = raf(frame);
    const dt = Math.min(0.25, (t - last) / 1000);   // 卡頓或切回分頁時，最多補 0.25 秒
    last = t;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      try { update(STEP); } catch (e) { console.error('[loop] update 出錯', e); }
      acc -= STEP; steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    try { render(); } catch (e) { console.error('[loop] render 出錯', e); }
  }

  const api = {
    get running() { return running; },
    start() { wanted = true; resume(); },
    stop() { wanted = false; pause(); },
  };
  function resume() {
    if (running) return;
    running = true; acc = 0;
    id = raf((t) => { last = t; frame(t); });
  }
  function pause() { running = false; if (id !== null) caf(id); id = null; }
  // 分頁在背景時暫停；回來時只有「本來就在跑」才恢復
  doc?.addEventListener('visibilitychange', () => { if (doc.hidden) pause(); else if (wanted) resume(); });
  return api;
}
