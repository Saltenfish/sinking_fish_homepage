/* ============================================================
   小賭場：走進去是大廳，四種遊戲擺在房間裡。滑鼠移過去會發光，點下去就切到那個遊戲的近景。
   ・拉霸機：三個轉輪、旁邊的拉桿（點或往下拖）；中獎有特效，金幣掉進下面的出幣口，點一下拾取
   ・21 點：坐在牌桌前，對面是看不清臉的荷官；押注 → 發牌 → 要牌／停牌
   ・骰子：點下注區放籌碼，點骰盅搖骰子
   ・幸運轉盤：押注後點「轉！」
   規則與賠率全部在 systems/casino.js 與 data/casino.js；這裡只負責畫面與動畫。只用遊戲內金幣。
============================================================ */
import { h } from './dom.js';
import { openRoom, coinTray, winBurst, place } from './room.js';
import { CASINO_HALL, SLOT, BLACKJACK, DICE, WHEEL } from '../data/rooms.js';

const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const PICK_TEXT = { small: '小（2–6）', seven: '七', big: '大（8–12）' };

export function casinoView(game) {
  const { casino, wallet, ui, assets, shop } = game;
  if (!casino) return ui.say(['小賭場今天沒有營業。']);
  let bet = casino.bets()[0].bet;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (room.alive) fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  let keyHandler = null;   // 目前畫面的快捷鍵

  const room = openRoom(game, {
    title: '小賭場', scene: 'casino-room',
    onKey: (e) => keyHandler?.(e) === true,
    onClose: () => {
      clearTimers();
      if (casino.handActive) casino.bjStand();          // 21 點打到一半就離開：直接停牌結算
      const got = casino.pickup();                        // 出幣口裡沒收的金幣自動收走
      if (got > 0) ui.toast(`離開前收走了出幣口的 ${got} 金幣`);
    },
  });

  /* ── 共用的小元件 ── */
  const coinsTag = () => room.add(h('div', { class: 'room-coins coins', text: String(wallet.coins()) }), 392, 8, 80);
  const refreshCoins = () => { const el = room.stage.querySelector('.room-coins'); if (el) el.textContent = String(wallet.coins()); };
  const offCoins = game.bus.on('coins:changed', refreshCoins);
  /* 籌碼：選押注金額 */
  function chips(x, y, onChange) {
    const els = casino.bets().map(({ bet: b }, i) => {
      const el = h('button', { class: `chip chip-${i}`, type: 'button', text: String(b), 'aria-pressed': String(b === bet) });
      el.addEventListener('click', () => { bet = b; sync(); onChange?.(); });
      return room.add(el, x + i * 34, y, 30, 30);
    });
    function sync() {
      els.forEach((el, i) => { const b = casino.bets()[i].bet; el.classList.toggle('on', b === bet); el.setAttribute('aria-pressed', String(b === bet)); el.disabled = !wallet.can(b); });
    }
    sync();
    return { sync };
  }
  const sign = (x, y, w, text, cls = '') => room.add(h('div', { class: `room-sign ${cls}`, text }), x, y, w);
  const noMoney = () => (wallet.coins() < casino.bets()[0].bet ? '金幣不夠了，去商店賣點東西再來吧。' : '這個押注付不起，選小一點的籌碼。');

  /* ═════════ 大廳 ═════════ */
  function hall() {
    keyHandler = null;
    room.show({
      bg: CASINO_HALL.bg, back: null,
      build: () => {
        for (const s of CASINO_HALL.spots) room.hotspot({ ...s, label: s.name, onClick: () => GAMES[s.id]() });
        coinsTag();
        sign(150, 246, 180, '點一下想玩的遊戲', 'hint-sign');
      },
    });
  }

  /* ═════════ 拉霸機 ═════════ */
  function slot() {
    const L = SLOT, syms = casino.symbols();
    let spinning = false;
    room.show({
      bg: L.bg, back: hall, focus: 262,
      build: () => {
        coinsTag();
        const msg = sign(L.sign.x, L.sign.y, L.sign.w, '拉下拉桿開始！', 'marquee');
        const reels = [0, 1, 2].map((k) => {
          const strip = h('div', { class: 'reel-strip' }, [...syms, ...syms].map((s) => h('div', { class: 'reel-cell', 'data-v': s.id })));
          const el = room.add(h('div', { class: 'reel-window' }, strip), L.reels.x + k * (L.reels.w + L.reels.gap + 4), L.reels.y, L.reels.w, L.reels.h);
          strip.style.setProperty('--loop', `${-syms.length * L.reels.h}px`);   // 轉動時捲過一整輪
          strip.style.setProperty('--cell', `${L.reels.h}px`);
          return { el, strip };
        });
        const setReel = (r, id) => { const i = Math.max(0, syms.findIndex((s) => s.id === id)); r.strip.style.transform = `translateY(${-i * L.reels.h}px)`; };
        reels.forEach((r) => setReel(r, syms[0].id));
        // 機台上的按鈕：前三個選押注、第四個也是開始
        const btns = casino.bets().map(({ bet: b }, i) => {
          const el = h('button', { class: 'machine-btn', type: 'button', text: String(b) });
          el.addEventListener('click', () => { if (!spinning) { bet = b; sync(); } });
          return room.add(el, L.buttons.x + i * L.buttons.step, L.buttons.y, L.buttons.w, L.buttons.h);
        });
        const go = room.add(h('button', { class: 'machine-btn go', type: 'button', text: '轉' }), L.buttons.x + 3 * L.buttons.step, L.buttons.y, L.buttons.w, L.buttons.h);
        go.addEventListener('click', () => pull());
        function sync() { btns.forEach((el, i) => el.classList.toggle('on', casino.bets()[i].bet === bet)); if (!spinning) msg.textContent = `押注 ${bet}・拉下拉桿！`; }
        sync();
        const lever = room.add(h('button', { class: 'lever', type: 'button', 'aria-label': '拉桿' },
          h('img', { class: 'lever-up', src: assets.url('room.slot.lever') || '', alt: '' }),
          h('img', { class: 'lever-down', src: assets.url('room.slot.lever.down') || '', alt: '' })), L.lever.x, L.lever.y, L.lever.w, L.lever.h);
        const hint = room.add(h('div', { class: 'lever-hint', text: '拉我！' }), L.lever.x - 6, L.lever.y + 114, 44);
        // 拉桿：點一下或往下拖
        let dragY = null;
        lever.addEventListener('pointerdown', (e) => { dragY = e.clientY; try { lever.setPointerCapture(e.pointerId); } catch { /* 略 */ } });
        lever.addEventListener('pointerup', () => { if (dragY !== null) { dragY = null; pull(); } });
        lever.addEventListener('pointercancel', () => { dragY = null; });
        const tray = coinTray(game, room, { ...L.tray, from: { x: 234, y: 160 } });

        function pull() {
          if (spinning) return;
          const r = casino.slot(bet);
          if (!r.ok) { msg.textContent = r.reason === 'coins' ? noMoney() : '現在不能玩'; return; }
          spinning = true; hint.hidden = true;
          lever.classList.add('pulled'); later(() => lever.classList.remove('pulled'), 350);
          msg.textContent = '轉動中……';
          reels.forEach((reel, k) => {
            reel.strip.classList.add('spinning');
            later(() => {
              reel.strip.classList.remove('spinning');
              setReel(reel, r.reels[k]);
              reel.el.classList.add('stopped'); later(() => reel.el.classList.remove('stopped'), 200);
              if (k === 2) {
                spinning = false;
                if (r.payout > r.bet) { msg.textContent = `中獎！拿回 ${r.payout}`; winBurst(room, { x: 240, y: 115, text: r.mult >= 15 ? `大獎 ×${r.mult}` : `中獎 ×${r.mult}`, big: r.mult >= 15 }); tray.drop(r.payout); }
                else if (r.payout > 0) { msg.textContent = `兩個一樣，退回 ${r.payout}`; tray.drop(r.payout); }
                else msg.textContent = '沒中，再拉一次？';
                sync(); refreshCoins();
              }
            }, 650 + k * 380);
          });
        }
        keyHandler = (e) => { if (['KeyF', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) pull(); return true; } return false; };
      },
    });
  }

  /* ═════════ 21 點 ═════════ */
  function blackjack() {
    const L = BLACKJACK;
    room.show({
      bg: L.bg, back: hall,
      build: () => {
        coinsTag();
        const bubble = room.add(h('div', { class: 'speech', text: '要來一局嗎？選好籌碼，按「發牌」。' }), L.bubble.x, L.bubble.y, 170);
        const say = (t) => { bubble.textContent = t; };
        const chipBar = chips(L.chips.x, L.chips.y);
        const dealBtn = room.add(h('button', { class: 'btn table-btn', type: 'button', text: '發牌' }), 202, 236, 76, 24);
        const hitBtn = room.add(h('button', { class: 'btn table-btn', type: 'button', text: '要牌' }), L.actions.x, L.actions.y, 66, 24);
        const standBtn = room.add(h('button', { class: 'btn table-btn', type: 'button', text: '停牌' }), L.actions.x, L.actions.y + 30, 66, 24);
        const tray = coinTray(game, room, { ...L.tray, from: { x: 240, y: 200 } });
        const backUrl = assets.url(`card.back.${shop?.back?.() || 'default'}`) || assets.url('card.back.default');
        let cards = [];

        const card = (c, row, i, hidden = false) => {
          const el = h('div', { class: `pcard${hidden ? ' back' : ''}${c && (c.s === 'H' || c.s === 'D') ? ' red' : ''}` },
            hidden ? null : h('span', { class: 'rank', text: RANK[c.r] }), hidden ? null : h('i', { class: `suit suit-${c.s}` }));
          if (hidden && backUrl) el.style.backgroundImage = `url("${backUrl}")`;
          room.add(el, L.shoe.x, L.shoe.y, L.card.w, L.card.h);
          el.classList.add('dealing');
          requestAnimationFrame(() => requestAnimationFrame(() => { place(el, row.x + i * L.card.step, row.y); el.classList.remove('dealing'); }));
          cards.push(el);
          return el;
        };
        const clearCards = () => { cards.forEach((c) => c.remove()); cards = []; };
        const setMode = (playing) => { dealBtn.hidden = playing; hitBtn.hidden = !playing; standBtn.hidden = !playing; room.stage.querySelectorAll('.chip').forEach((c) => { c.disabled = playing || !wallet.can(Number(c.textContent)); }); };
        setMode(false);

        function showEnd(r) {
          const dealerCards = r.dealer;
          cards.filter((c) => c.dataset.row === 'dealer').forEach((c) => c.remove());
          cards = cards.filter((c) => c.dataset.row !== 'dealer');
          dealerCards.forEach((c, i) => { const el = card(c, L.dealerRow, i); el.dataset.row = 'dealer'; });
          const text = { win: `你 ${r.playerValue} 點，我 ${r.dealerValue} 點。你贏了。`, natural: '一開始就 21 點，漂亮。', push: `${r.playerValue} 點平手，退回押注。`,
            lose: `我 ${r.dealerValue} 點，這局是我的。`, bust: `${r.playerValue} 點，爆了。` }[r.result];
          say(r.dealerValue > 21 && r.result === 'win' ? `我爆牌了（${r.dealerValue} 點）。你贏了。` : text);
          if (r.payout > r.bet) { winBurst(room, { x: 240, y: 160, text: r.result === 'natural' ? '21 點！' : '贏了！' }); tray.drop(r.payout); }
          else if (r.payout > 0) tray.drop(r.payout);
          setMode(false); chipBar.sync(); refreshCoins();
        }
        function deal() {
          const r = casino.bjDeal(bet);
          if (!r.ok) { say(r.reason === 'coins' ? noMoney() : '等這局結束。'); return; }
          clearCards();
          const p = r.done ? r.player : r.player;
          p.forEach((c, i) => { const el = card(c, L.playerRow, i); el.dataset.row = 'player'; });
          if (r.done) { later(() => showEnd(r), 500); return; }
          const up = card(r.dealerUp, L.dealerRow, 0); up.dataset.row = 'dealer';
          const hole = card(null, L.dealerRow, 1, true); hole.dataset.row = 'dealer';
          setMode(true);
          say(`你 ${r.playerValue.total} 點。要牌，還是停牌？`);
          refreshCoins();
        }
        function hit() {
          const r = casino.bjHit();
          if (!r.ok) return;
          const el = card(r.player[r.player.length - 1], L.playerRow, r.player.length - 1); el.dataset.row = 'player';
          if (r.done) later(() => showEnd(r), 450); else say(`你 ${r.playerValue.total} 點。還要嗎？`);
        }
        function stand() { const r = casino.bjStand(); if (r.ok) showEnd(r); }
        dealBtn.addEventListener('click', deal); hitBtn.addEventListener('click', hit); standBtn.addEventListener('click', stand);
        keyHandler = (e) => {
          if (e.repeat) return false;
          if (e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') { if (casino.handActive) hit(); else deal(); return true; }
          if (e.code === 'KeyS' && casino.handActive) { stand(); return true; }
          return false;
        };
        room.onLeave(() => { if (casino.handActive) casino.bjStand(); });
      },
    });
  }

  /* ═════════ 骰子 ═════════ */
  function dice() {
    const L = DICE;
    let pick = null, busy = false;
    room.show({
      bg: L.bg, back: hall,
      build: () => {
        coinsTag();
        const msg = sign(150, 150, 180, '點下注區放籌碼，再點骰盅', 'felt-sign');
        const chipBar = chips(L.chips.x, L.chips.y, () => placeChip());
        const zoneEls = L.zones.map((z) => {
          const el = room.hotspot({ x: z.x, y: z.y, w: z.w, h: z.h, label: '', cls: 'zone', onClick: () => { if (!busy) { pick = z.pick; placeChip(); } } });
          el.append(h('span', { class: 'zone-text', text: PICK_TEXT[z.pick] }), h('span', { class: 'zone-odds', text: z.pick === 'seven' ? '中了 ×5' : '中了 ×2' }));
          el.dataset.pick = z.pick;
          return el;
        });
        const marker = room.add(h('div', { class: 'chip on placed', hidden: true }), 0, 0, 30, 30);
        function placeChip() {
          zoneEls.forEach((el) => el.classList.toggle('picked', el.dataset.pick === pick));
          if (!pick) return;
          const z = L.zones.find((q) => q.pick === pick);
          marker.hidden = false; marker.textContent = String(bet);
          place(marker, z.x + z.w / 2 - 15, z.y + z.h - 36);
          msg.textContent = `押 ${PICK_TEXT[pick]} ${bet}・點骰盅搖骰子`;
        }
        const diceEls = L.dice.map((d) => room.add(h('div', { class: 'die', 'data-v': '1', hidden: true }), d.x, d.y, 30, 30));
        const cup = room.hotspot({ ...L.cup, sprite: 'room.dice.cup', label: '搖骰子', cls: 'cup', onClick: () => roll() });
        const tray = coinTray(game, room, { ...L.tray, from: { x: 240, y: 120 } });
        function roll() {
          if (busy) return;
          if (!pick) { msg.textContent = '先點一個下注區（小、七、大）'; return; }
          const r = casino.dice(bet, pick);
          if (!r.ok) { msg.textContent = r.reason === 'coins' ? noMoney() : '現在不能玩'; return; }
          busy = true; refreshCoins();
          diceEls.forEach((d) => { d.hidden = true; });
          cup.classList.remove('lifted'); cup.classList.add('shaking');
          msg.textContent = '喀啦喀啦……';
          later(() => {
            cup.classList.remove('shaking'); cup.classList.add('lifted');
            diceEls.forEach((d, i) => { d.dataset.v = String(r.dice[i]); d.hidden = false; });
            const sum = r.dice[0] + r.dice[1];
            if (r.payout > 0) { msg.textContent = `${sum} 點！拿回 ${r.payout}`; winBurst(room, { x: 240, y: 110, text: `${sum} 點 中了！`, big: pick === 'seven' }); tray.drop(r.payout); }
            else msg.textContent = `${sum} 點，沒中。再搖一次？`;
            busy = false; chipBar.sync(); refreshCoins();
          }, 900);
        }
        keyHandler = (e) => { if (['KeyF', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) roll(); return true; } return false; };
      },
    });
  }

  /* ═════════ 幸運轉盤 ═════════ */
  function wheel() {
    const L = WHEEL, segs = casino.wheel();
    let angle = 0, busy = false;
    room.show({
      bg: L.bg, back: hall,
      build: () => {
        coinsTag();
        const msg = sign(360, 176, 108, '押注後按「轉！」', 'hint-sign');
        const chipBar = chips(L.chips.x, L.chips.y);
        const disc = room.img('room.wheel.disc', L.disc.x, L.disc.y, L.disc.w, L.disc.h, 'wheel-disc');
        room.img('room.wheel.pointer', L.pointer.x, L.pointer.y, L.pointer.w, L.pointer.h, 'wheel-pointer');
        const spin = room.add(h('button', { class: 'btn table-btn spin-btn', type: 'button', text: '轉！' }), L.spin.x, L.spin.y, L.spin.w, L.spin.h);
        disc.addEventListener('click', () => go());
        disc.classList.add('clickable');
        spin.addEventListener('click', () => go());
        const tray = coinTray(game, room, { ...L.tray, from: { x: 240, y: 120 } });
        function go() {
          if (busy) return;
          const r = casino.spinWheel(bet);
          if (!r.ok) { msg.textContent = r.reason === 'coins' ? noMoney() : '現在不能玩'; return; }
          busy = true; refreshCoins();
          // 第 i 格的中心在順時針 i × 30 度；轉盤要轉到讓那一格停在正上方的指針下
          const per = 360 / segs.length;
          const target = 360 - r.index * per + (Math.random() - 0.5) * per * 0.6;
          angle = angle - (angle % 360) + 360 * 5 + target;
          disc.style.transform = `rotate(${angle}deg)`;
          msg.textContent = '轉呀轉……';
          later(() => {
            const m = segs[r.index].mult;
            if (r.payout > r.bet) { msg.textContent = `×${m}！拿回 ${r.payout}`; winBurst(room, { x: 240, y: 122, text: `×${m}`, big: m >= 5 }); tray.drop(r.payout); }
            else if (r.payout > 0) { msg.textContent = `×${m}，拿回 ${r.payout}`; tray.drop(r.payout); }
            else msg.textContent = '停在 0，下次一定。';
            busy = false; chipBar.sync(); refreshCoins();
          }, 3300);
        }
        keyHandler = (e) => { if (['KeyF', 'Space', 'Enter'].includes(e.code)) { if (!e.repeat) go(); return true; } return false; };
      },
    });
  }

  const GAMES = { slot, blackjack, dice, wheel };
  hall();
  return room.closed.finally(offCoins);
}
