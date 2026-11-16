/* 魚魚的回覆引擎（下班版）。不碰畫面、不碰存檔，只吃「詞庫 + 當下狀態」吐出台詞。
   語氣規則：
   ・熟悉度分三級（0 剛認識 / 1 熟了 / 2 老朋友），由來訪、餵食、聊天次數決定
   ・每次對話前兩句一定溫和，之後才逐漸可能嘴人；嘴人機率有上限，只是「偶爾」
   ・偵測到負面情緒時一律認真安慰，不嘴 */
import { clamp, pick } from '../core/util.js';

export function familiarity(f) {
  const score = (f.visits || 0) + (f.feeds || 0) * 2 + Math.floor((f.msgs || 0) / 10);
  return score >= 12 ? 2 : score >= 4 ? 1 : 0;
}

/* tier：熟悉度；turn：這次對話的第幾句（從 1 起算） */
export function sassChance(tier, turn) {
  const base = [0.05, 0.22, 0.4][clamp(tier, 0, 2)];
  return base * clamp((turn - 2) / 4, 0, 1);
}

const CONDITIONS = {
  ripe: (c) => c.ripe > 0,
  noCards: (c) => c.cards === 0,
  allCards: (c) => c.total > 0 && c.cards >= c.total,
  night: (c) => c.phase === 'night',
  hasFish: (c) => c.fishInBag > 0,
  longAway: (c) => c.days >= 3,
  fed: (c) => c.justFed === true,
  crossSite: (c) => c.promptVisits > 0,
};

const fill = (line, ctx) => String(line).replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null ? String(ctx[k]) : m));
const asLines = (v) => (Array.isArray(v) ? v : [v]);

export function createFishBrain({ words, rng = Math.random }) {
  const W = words;
  const pool = (name) => (Array.isArray(W[name]) && W[name].length ? W[name] : null);

  // 規則的正規表達式先編譯好；寫壞的規則略過，不讓整個魚魚壞掉
  const rules = [];
  for (const k of W.KEYS || []) {
    try { rules.push({ ...k, _re: new RegExp(k.re, 'i') }); }
    catch { console.warn('[魚魚] 規則的 re 寫錯了，已略過：', k.re); }
  }
  let comfortRe = null;
  try { comfortRe = W.COMFORT_RE ? new RegExp(W.COMFORT_RE, 'i') : null; } catch { console.warn('[魚魚] COMFORT_RE 寫錯了'); }

  let turn = 0, prev = null, repeats = 0;
  const said = new Set();   // 這次對話已經講過的觀察，不重複

  function observe(ctx, tier) {
    for (const o of W.OBSERVE || []) {
      const test = CONDITIONS[o.if];
      if (!test || said.has(o.if) || (o.tier || 0) > tier || !test(ctx)) continue;
      said.add(o.if);
      return pick(rng, o.r);
    }
    return null;
  }

  return {
    get turn() { return turn; },

    /* 開場：一律溫和，最多帶一句對現況的觀察 */
    greet(ctx) {
      const tier = familiarity(ctx);
      const g = W.GREET || {};
      const set = (ctx.visits <= 1 ? g.FIRST : tier >= 2 ? g.REGULAR : g.BACK) || g.FIRST || ['……'];
      const lines = [...asLines(pick(rng, set))];
      const note = observe(ctx, tier);
      if (note) lines.push(...asLines(note));
      return lines.map((l) => fill(l, ctx));
    },

    reply(text, ctx) {
      const t = String(text ?? '').trim();
      if (!t) return [];
      turn += 1;
      const tier = familiarity(ctx);
      const sassy = rng() < sassChance(tier, turn);
      const out = [];

      if (t === prev) {
        repeats += 1;
        if (repeats >= 2 && W.MISC?.REPEAT) return [fill(W.MISC.REPEAT, ctx)];
      } else { prev = t; repeats = 0; }

      if (comfortRe && comfortRe.test(t) && pool('COMFORT')) {
        return asLines(pick(rng, W.COMFORT)).map((l) => fill(l, ctx));   // 安慰永遠是真心的
      }

      const rule = rules.find((k) => k._re.test(t));
      if (rule) {
        if (rule.type === 'fortune' && pool('FORTUNE')) out.push(W.MISC?.FORTUNE_INTRO || '……', pick(rng, W.FORTUNE));
        else if (rule.type === 'dice' && pool('DICE')) out.push(fill(pick(rng, W.DICE), { n: 1 + Math.floor(rng() * 6) % 6 }));
        else if (rule.type === 'status' && pool('STATUS')) out.push(...asLines(pick(rng, W.STATUS)));
        else {
          const src = sassy && Array.isArray(rule.sassy) && rule.sassy.length ? rule.sassy : rule.r;
          if (Array.isArray(src) && src.length) out.push(...asLines(pick(rng, src)));
        }
      }
      if (!out.length) {
        const name = sassy && pool('SASSY') ? 'SASSY' : tier >= 1 && pool('CASUAL') && rng() < 0.5 ? 'CASUAL' : 'WARM';
        out.push(...asLines(pick(rng, pool(name) || ['嗯。'])));
        if (rng() < 0.15) { const note = observe(ctx, tier); if (note) out.push(...asLines(note)); }
      }
      return out.map((l) => fill(l, ctx));
    },
  };
}
