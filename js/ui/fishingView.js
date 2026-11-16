/* 釣魚畫面：只顯示狀態並把「拉竿」傳給釣魚系統。 */
import { h } from './dom.js';

const TEXT = {
  waiting: '浮標靜靜漂著……（咬鉤時按 E 或點「拉竿」）',
  bite: '！！　咬鉤了　！！',
  early: '太早拉了，魚被嚇跑了。',
  missed: '慢了一步，魚跑掉了。',
};

export function fishingView(game) {
  const { fishing, clock, ui } = game;
  const status = h('div', { class: 'fishing-status' });
  const pullBtn = h('button', { class: 'btn big', type: 'button', text: '拉竿', onclick: () => pull() });
  const againBtn = h('button', { class: 'btn', type: 'button', text: '再釣一次', hidden: true, onclick: () => begin() });
  let timer = null;

  function stopTimer() { if (timer !== null) { clearInterval(timer); timer = null; } }
  function finish(r) {
    stopTimer();
    status.textContent = r.state === 'caught' ? `釣到了：${r.item.name}！` : TEXT[r.state] || '';
    status.className = 'fishing-status';
    pullBtn.hidden = true; againBtn.hidden = false;
  }
  function tick() {
    const r = fishing.update(clock.now());
    if (r.state === 'missed') { finish(r); return; }
    status.textContent = TEXT[r.state] || '';
    status.className = `fishing-status ${r.state}`;
  }
  function begin() {
    if (!fishing.start(clock.now())) return;
    pullBtn.hidden = false; againBtn.hidden = true;
    tick();
    stopTimer();
    timer = setInterval(tick, 50);
  }
  function pull() { if (fishing.active) finish(fishing.pull(clock.now())); }

  const p = ui.panel({
    title: '釣魚', body: h('div', { class: 'fishing' }, status, h('div', { class: 'row' }, pullBtn, againBtn)),
    onClose: () => { stopTimer(); fishing.cancel(); },
    onKey: (e) => {
      if (['KeyE', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) { if (fishing.active) pull(); else begin(); } return true; }
      return false;
    },
  });
  begin();
  return p.closed;
}
