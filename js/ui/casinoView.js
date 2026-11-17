/* 小賭場：骰子比大小、拉霸。只用遊戲內金幣。規則與賠率在 systems/casino.js 與 data/casino.js。
   這裡只做「先扣款拿到結果 → 播動畫 → 顯示結果」。 */
import { h } from './dom.js';

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const PICKS = [['small', '小（2–6）'], ['seven', '七'], ['big', '大（8–12）']];

export function casinoView(game) {
  const { casino, wallet, ui } = game;
  if (!casino) return ui.say(['小賭場今天沒有營業。']);
  let bet = casino.bets()[0].bet, busy = false, alive = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); };
  const every = (fn, ms) => { const t = setInterval(() => { if (alive) fn(); }, ms); timers.add(t); return () => { clearInterval(t); timers.delete(t); }; };

  const coins = h('div', { class: 'coins' });
  const msg = h('div', { class: 'casino-msg', role: 'status', 'aria-live': 'polite', text: '選好押注金額，挑一個遊戲。' });
  const betRow = h('div', { class: 'row' });
  const dice = [h('span', { class: 'die', text: DIE[0] }), h('span', { class: 'die', text: DIE[5] })];
  const reels = [0, 1, 2].map(() => h('span', { class: 'reel', text: casino.symbols()[0].icon }));
  const pickBtns = PICKS.map(([id, label]) => h('button', { class: 'btn', type: 'button', text: label, onclick: () => playDice(id) }));
  const spinBtn = h('button', { class: 'btn big', type: 'button', text: '拉下拉桿', onclick: playSlot });
  const icon = (id) => casino.symbols().find((s) => s.id === id)?.icon ?? '？';

  function refresh() {
    coins.textContent = `🪙 ${wallet.coins()}`;
    betRow.replaceChildren(h('span', { text: '押注：' }), ...casino.bets().map(({ bet: b, affordable }) =>
      h('button', { class: `btn${b === bet ? ' on' : ''}`, type: 'button', text: String(b), disabled: busy || !affordable, 'aria-pressed': String(b === bet), onclick: () => { bet = b; refresh(); } })));
    const broke = !wallet.can(bet);
    for (const b of [...pickBtns, spinBtn]) b.disabled = busy || broke;
    if (broke && !busy) msg.textContent = wallet.coins() < casino.bets()[0].bet ? '金幣不夠了。去賣點東西再來吧。' : '這個押注金額付不起，換小一點的。';
  }
  const verdict = (r) => (r.payout > r.bet ? `贏了！拿回 ${r.payout} 金幣（+${r.net}）` : r.payout > 0 ? `拿回 ${r.payout} 金幣（${r.net}）` : `沒中，少了 ${r.bet} 金幣`);
  function fail(r) { msg.textContent = r.reason === 'coins' ? '金幣不夠。' : '現在不能玩。'; refresh(); }

  function playDice(pick) {
    if (busy) return;
    const r = casino.dice(bet, pick);          // 結果在這一刻就決定並結算，後面只是演出
    if (!r.ok) return fail(r);
    busy = true; msg.textContent = '骰子滾動中……'; refresh();
    const stop = every(() => dice.forEach((d) => { d.textContent = DIE[Math.floor(Math.random() * 6)]; }), 70);
    later(() => { stop(); dice.forEach((d, i) => { d.textContent = DIE[r.dice[i] - 1]; }); busy = false; msg.textContent = `${r.dice[0]} + ${r.dice[1]} = ${r.dice[0] + r.dice[1]}。${verdict(r)}`; refresh(); }, 800);
  }
  function playSlot() {
    if (busy) return;
    const r = casino.slot(bet);
    if (!r.ok) return fail(r);
    busy = true; msg.textContent = '轉動中……'; refresh();
    const syms = casino.symbols();
    reels.forEach((el, i) => {
      el.classList.add('spinning');
      const stop = every(() => { el.textContent = syms[Math.floor(Math.random() * syms.length)].icon; }, 60);
      later(() => { stop(); el.classList.remove('spinning'); el.textContent = icon(r.reels[i]); if (i === 2) { busy = false; msg.textContent = verdict(r); refresh(); } }, 600 + i * 350);
    });
  }

  refresh();
  const body = h('div', { class: 'casino' },
    h('div', { class: 'row shop-head' }, coins, h('span', { class: 'note', text: '這裡只使用小鎮裡的金幣，純屬遊戲。' })), betRow,
    h('div', { class: 'casino-games' },
      h('section', { class: 'casino-game' }, h('h4', { text: '骰子比大小' }), h('div', { class: 'dice' }, dice), h('div', { class: 'row' }, pickBtns),
        h('p', { class: 'note', text: '猜兩顆骰子的總和。猜大或小中了拿 2 倍，猜「七」中了拿 5 倍。' })),
      h('section', { class: 'casino-game' }, h('h4', { text: '拉霸' }), h('div', { class: 'reels' }, reels), h('div', { class: 'row' }, spinBtn),
        h('p', { class: 'note', text: `三個一樣：${casino.symbols().map((s) => `${s.icon}×${s.triple}`).join('　')}。兩個一樣拿回一半。` }))),
    msg);
  return ui.panel({ title: '小賭場', body, cls: 'wide', scene: 'casino', onClose: () => { alive = false; timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers.clear(); } }).closed;
}
