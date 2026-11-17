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
export function checkCasino(cfg) {
  const errors = [];
  if (!cfg || !Array.isArray(cfg.bets) || !cfg.bets.length || !cfg.bets.every((b) => Number.isInteger(b) && b > 0)) errors.push('casino.bets 必須是正整數陣列');
  const sym = cfg?.slot?.symbols;
  if (!Array.isArray(sym) || sym.length < 2 || !sym.every((s) => s && typeof s.id === 'string' && s.weight > 0 && s.triple >= 0)) errors.push('casino.slot.symbols 設定不合法');
  if (!(cfg?.slot?.pair >= 0) || !(cfg?.dice?.side > 0) || !(cfg?.dice?.seven > 0)) errors.push('casino 的倍率設定不合法');
  if (errors.length) return errors;
  if (new Set(sym.map((s) => s.id)).size !== sym.length) errors.push('casino.slot.symbols 的 id 重複');
  if (slotRtp(cfg) >= 1) errors.push(`拉霸期望值 ${slotRtp(cfg).toFixed(3)} ≥ 1，玩家會穩賺`);
  for (const p of ['small', 'big', 'seven']) if (diceRtp(p, cfg) >= 1) errors.push(`骰子「${p}」期望值 ≥ 1，玩家會穩賺`);
  return errors;
}

export function createCasino({ cfg, wallet, progress, bus, rng = Math.random }) {
  function settle(game, bet, mult, detail) {
    const payout = Math.floor(bet * mult);
    if (payout > 0) wallet.add(payout, 'casino');
    progress.inc('casinoPlays');
    if (payout > bet) progress.inc('casinoWins');
    const result = { ok: true, game, bet, mult, payout, net: payout - bet, ...detail };
    bus.emit('casino:played', result);
    return result;
  }
  const stake = (bet) => {
    if (!cfg.bets.includes(bet)) return 'bet';
    if (!wallet.spend(bet, 'casino')) return 'coins';
    return null;
  };
  return {
    bets: () => cfg.bets.map((b) => ({ bet: b, affordable: wallet.can(b) })),
    symbols: () => cfg.slot.symbols,
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
  };
}
