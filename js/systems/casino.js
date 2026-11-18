/* 小賭場：只用遊戲內金幣的小遊戲（骰子比大小、拉霸）。規則與賠率在 data/casino.js。
   上半部是純函式（可測試、可精確算出期望值），下半部負責扣款與派彩。 */
import { weighted } from '../core/util.js';

/* ---------- 骰子：兩顆骰子，猜 小(2~6) / 大(8~12) / 七 ---------- */
export function rollDice(rng) { return [1 + Math.floor(rng() * 6) % 6, 1 + Math.floor(rng() * 6) % 6]; }
export function diceMultiplier(pick, dice, cfg) {
  const sum = dice[0] + dice[1];
  if (pick === 'small') return sum <= 6 ? cfg.dice.side : 0;
  if (pick === 'big') return sum >= 8 ? cfg.dice.side : 0;
  if (pick === 'seven') return sum === 7 ? cfg.dice.seven : 0;
  return 0;
}
/* 精確期望值（每押 1 能拿回多少） */
export function diceRtp(pick, cfg) {
  let total = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) total += diceMultiplier(pick, [a, b], cfg);
  return total / 36;
}

/* ---------- 拉霸：三個轉輪；三個一樣拿該圖案的倍率，兩個一樣拿 pair 倍率 ---------- */
export function spinSlot(rng, cfg) { return [0, 1, 2].map(() => weighted(rng, cfg.slot.symbols).id); }
export function slotMultiplier(reels, cfg) {
  const [a, b, c] = reels;
  if (a === b && b === c) return cfg.slot.symbols.find((s) => s.id === a)?.triple ?? 0;
  if (a === b || b === c || a === c) return cfg.slot.pair;
  return 0;
}
export function slotRtp(cfg) {
  const sym = cfg.slot.symbols;
  const total = sym.reduce((n, s) => n + s.weight, 0);
  let ev = 0;
  for (const a of sym) for (const b of sym) for (const c of sym) ev += (a.weight * b.weight * c.weight) / total ** 3 * slotMultiplier([a.id, b.id, c.id], cfg);
  return ev;
}

/* 檢查賭場設定：期望值必須小於 1（否則等於無限印錢）。回傳錯誤訊息陣列 */
/* ---------- 幸運轉盤：每格機率相同，停在哪格就拿那格的倍率 ---------- */
export function spinWheel(rng, cfg) { const n = cfg.wheel.segments.length; return Math.min(n - 1, Math.floor(rng() * n)); }
export function wheelRtp(cfg) { const seg = cfg.wheel.segments; return seg.reduce((t, x) => t + x.mult, 0) / seg.length; }

/* ---------- 21 點（簡化版：沒有加倍、分牌、保險） ----------
   牌：{r: 1~13, s: 'S'|'H'|'D'|'C'}。A 算 1 或 11，J/Q/K 算 10。莊家拿到 17 點以上停牌（軟 17 照規則決定）。 */
export const SUITS = ['S', 'H', 'D', 'C'];
export function newDeck(rng) {
  const deck = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += c.r === 1 ? 1 : Math.min(10, c.r); if (c.r === 1) aces++; }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}
export const isNatural = (cards) => cards.length === 2 && handValue(cards).total === 21;
/* 莊家補牌（會改動 hand 與 deck） */
export function dealerPlay(hand, deck, hitSoft17) {
  for (;;) {
    const v = handValue(hand);
    if (v.total > 17 || (v.total === 17 && !(v.soft && hitSoft17))) return hand;
    hand.push(deck.pop());
  }
}
/* 結算：回傳倍率（含本金）與結果 */
export function blackjackOutcome(player, dealer, rules) {
  const p = handValue(player).total, d = handValue(dealer).total;
  if (p > 21) return { result: 'bust', mult: 0 };
  if (isNatural(player) && !isNatural(dealer)) return { result: 'natural', mult: rules.natural };
  if (isNatural(dealer) && !isNatural(player)) return { result: 'lose', mult: 0 };
  if (d > 21) return { result: 'win', mult: rules.win };
  if (p > d) return { result: 'win', mult: rules.win };
  if (p === d) return { result: 'push', mult: rules.push };
  return { result: 'lose', mult: 0 };
}

export function checkCasino(cfg) {
  const errors = [];
  if (!cfg || !Array.isArray(cfg.bets) || !cfg.bets.length || !cfg.bets.every((b) => Number.isInteger(b) && b > 0)) errors.push('casino.bets 必須是正整數陣列');
  const sym = cfg?.slot?.symbols;
  if (!Array.isArray(sym) || sym.length < 2 || !sym.every((s) => s && typeof s.id === 'string' && s.weight > 0 && s.triple >= 0)) errors.push('casino.slot.symbols 設定不合法');
  if (!(cfg?.slot?.pair >= 0) || !(cfg?.dice?.side > 0) || !(cfg?.dice?.seven > 0)) errors.push('casino 的倍率設定不合法');
  const seg = cfg?.wheel?.segments;
  if (!Array.isArray(seg) || seg.length < 4 || !seg.every((x) => x && Number.isFinite(x.mult) && x.mult >= 0)) errors.push('casino.wheel.segments 設定不合法');
  const bj = cfg?.blackjack;
  if (!bj || !(bj.win > 0) || !(bj.push >= 0) || !(bj.natural > 0) || typeof bj.hitSoft17 !== 'boolean') errors.push('casino.blackjack 設定不合法');
  else if (bj.win > 2 || bj.push > 1 || bj.natural > 2.5) errors.push('casino.blackjack 的倍率太高（勝 ≤ 2、平手 ≤ 1、21 點 ≤ 2.5）');
  if (errors.length) return errors;
  if (new Set(sym.map((s) => s.id)).size !== sym.length) errors.push('casino.slot.symbols 的 id 重複');
  if (slotRtp(cfg) >= 1) errors.push(`拉霸期望值 ${slotRtp(cfg).toFixed(3)} ≥ 1，玩家會穩賺`);
  for (const p of ['small', 'big', 'seven']) if (diceRtp(p, cfg) >= 1) errors.push(`骰子「${p}」期望值 ≥ 1，玩家會穩賺`);
  if (wheelRtp(cfg) >= 1) errors.push(`轉盤期望值 ${wheelRtp(cfg).toFixed(3)} ≥ 1，玩家會穩賺`);
  return errors;
}

/* 遊戲結果的金幣不直接進錢包，而是先掉進「出幣口」（save.data.casinoTray），點一下才收進錢包。
   出幣口的金幣存在存檔裡，離開或關掉網頁也不會不見（離開賭場時會自動收走）。 */
export function createCasino({ cfg, wallet, progress, bus, save, rng = Math.random }) {
  let hand = null;   // 進行中的 21 點：{bet, deck, player, dealer}

  function settle(game, bet, mult, detail) {
    const payout = Math.floor(bet * mult);
    if (payout > 0) { save.data.casinoTray = Math.min(999999, (save.data.casinoTray || 0) + payout); save.commit(); }
    progress.inc('casinoPlays');
    if (payout > bet) progress.inc('casinoWins');
    const result = { ok: true, game, bet, mult, payout, net: payout - bet, tray: save.data.casinoTray, ...detail };
    bus.emit('casino:played', result);
    return result;
  }
  const stake = (bet) => {
    if (!cfg.bets.includes(bet)) return 'bet';
    if (!wallet.spend(bet, 'casino')) return 'coins';
    return null;
  };
  const view = () => hand && { bet: hand.bet, player: hand.player.slice(), dealerUp: hand.dealer[0], playerValue: handValue(hand.player) };
  function finishHand() {
    const h = hand; hand = null;
    if (handValue(h.player).total <= 21 && !isNatural(h.player)) dealerPlay(h.dealer, h.deck, cfg.blackjack.hitSoft17);
    const o = blackjackOutcome(h.player, h.dealer, cfg.blackjack);
    return settle('blackjack', h.bet, o.mult, { result: o.result, player: h.player, dealer: h.dealer, playerValue: handValue(h.player).total, dealerValue: handValue(h.dealer).total, done: true });
  }

  const api = {
    bets: () => cfg.bets.map((b) => ({ bet: b, affordable: wallet.can(b) })),
    symbols: () => cfg.slot.symbols,
    wheel: () => cfg.wheel.segments,
    tray: () => save.data.casinoTray || 0,
    /* 把出幣口的金幣收進錢包，回傳收了多少 */
    pickup() {
      const n = save.data.casinoTray || 0;
      if (n <= 0) return 0;
      save.data.casinoTray = 0; save.commit();
      return wallet.add(n, 'casino');
    },
    dice(bet, pick) {
      if (!['small', 'big', 'seven'].includes(pick)) return { ok: false, reason: 'pick' };
      const bad = stake(bet); if (bad) return { ok: false, reason: bad };
      const dice = rollDice(rng);
      return settle('dice', bet, diceMultiplier(pick, dice, cfg), { dice, pick });
    },
    slot(bet) {
      const bad = stake(bet); if (bad) return { ok: false, reason: bad };
      const reels = spinSlot(rng, cfg);
      return settle('slot', bet, slotMultiplier(reels, cfg), { reels });
    },
    spinWheel(bet) {
      const bad = stake(bet); if (bad) return { ok: false, reason: bad };
      const index = spinWheel(rng, cfg);
      return settle('wheel', bet, cfg.wheel.segments[index].mult, { index });
    },
    /* 21 點：發牌 → 要牌／停牌。一開始就 21 點（或莊家 21 點）會直接結算 */
    get handActive() { return hand !== null; },
    hand: view,
    bjDeal(bet) {
      if (hand) return { ok: false, reason: 'busy' };
      const bad = stake(bet); if (bad) return { ok: false, reason: bad };
      const deck = newDeck(rng);
      hand = { bet, deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()] };
      if (isNatural(hand.player) || isNatural(hand.dealer)) return finishHand();
      return { ok: true, done: false, ...view() };
    },
    bjHit() {
      if (!hand) return { ok: false, reason: 'no-hand' };
      hand.player.push(hand.deck.pop());
      const v = handValue(hand.player).total;
      if (v >= 21) return finishHand();
      return { ok: true, done: false, ...view() };
    },
    bjStand() {
      if (!hand) return { ok: false, reason: 'no-hand' };
      return finishHand();
    },
  };
  return api;
}
