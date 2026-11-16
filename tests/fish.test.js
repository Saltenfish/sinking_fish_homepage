import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFishBrain, familiarity, sassChance } from '../js/fish/brain.js';
import words from '../js/fish/words-home.js';
import { createFish } from '../js/fish/index.js';
import { makeGame } from './helpers.js';

const ctx = (o = {}) => ({ visits: 1, feeds: 0, msgs: 0, days: 0, cards: 0, total: 24, ripe: 0, fishInBag: 0, phase: 'day', promptVisits: 0, pv: 0, ...o });
const flat = (v) => v.flat(Infinity);
const SASSY = new Set(flat([...words.SASSY, ...words.KEYS.flatMap((k) => k.sassy || [])]));

test('語氣：熟悉度分級與嘴人機率', () => {
  assert.equal(familiarity({ visits: 1, feeds: 0, msgs: 0 }), 0);
  assert.equal(familiarity({ visits: 2, feeds: 1, msgs: 5 }), 1);
  assert.equal(familiarity({ visits: 6, feeds: 3, msgs: 40 }), 2);
  for (const tier of [0, 1, 2]) { assert.equal(sassChance(tier, 1), 0); assert.equal(sassChance(tier, 2), 0); }
  assert.ok(sassChance(2, 3) < sassChance(2, 6));
  assert.ok(sassChance(0, 99) <= 0.05 && sassChance(2, 99) <= 0.4);
});

test('語氣：每次對話前兩句絕不嘴人，就算是老朋友、亂數再極端也一樣', () => {
  for (const r of [0, 0.01, 0.2, 0.5, 0.99]) {
    const brain = createFishBrain({ words, rng: () => r });
    const old = ctx({ visits: 30, feeds: 20, msgs: 500 });
    for (const line of [...brain.greet(old), ...brain.reply('今天天氣不錯', old), ...brain.reply('謝謝你', old)]) assert.ok(!SASSY.has(line), `太早嘴人：${line}`);
  }
});

test('語氣：剛認識的人整場幾乎不被嘴；老朋友聊久了會偶爾被嘴，但不過半', () => {
  let n = 0; const seq = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  const count = (c) => { let sassy = 0, total = 0;
    for (let s = 0; s < 300; s++) { const b = createFishBrain({ words, rng: seq }); for (let i = 0; i < 12; i++) { const out = b.reply(`隨便聊聊${s}-${i}`, c); total++; if (out.some((l) => SASSY.has(l))) sassy++; } }
    return sassy / total; };
  const fresh = count(ctx()), old = count(ctx({ visits: 30, feeds: 20, msgs: 500 }));
  assert.ok(fresh < 0.06, `新朋友被嘴比例 ${fresh}`);
  assert.ok(old > 0.1 && old < 0.45, `老朋友被嘴比例 ${old}`);
});

test('安慰：偵測到負面情緒一律用 COMFORT，不嘴', () => {
  const brain = createFishBrain({ words, rng: () => 0 });
  const old = ctx({ visits: 30, feeds: 20, msgs: 500 });
  for (let i = 0; i < 8; i++) brain.reply(`暖場${i}`, old);
  const comfort = new Set(flat(words.COMFORT));
  for (const t of ['我今天好累', '有點想哭', '壓力好大喔']) for (const l of brain.reply(t, old)) assert.ok(comfort.has(l), l);
});

test('回覆：代號會被換成實際數值；空字串不回；重複三次會提醒', () => {
  const brain = createFishBrain({ words, rng: () => 0 });
  const c = ctx({ cards: 7, total: 24, ripe: 2 });
  const s = brain.reply('我的進度如何', c).join('');
  assert.match(s, /7/); assert.match(s, /24/); assert.doesNotMatch(s, /\{\w+\}/);
  assert.deepEqual(brain.reply('   ', c), []);
  brain.reply('嗨', c); brain.reply('嗨', c);
  assert.deepEqual(brain.reply('嗨', c), [words.MISC.REPEAT]);
  for (const l of [...brain.reply('擲骰', c), ...brain.reply('抽籤', c)]) assert.doesNotMatch(l, /\{\w+\}/);
});

test('詞庫：所有台詞裡的代號引擎都認得；規則的正規表達式都能編譯', () => {
  const known = new Set(Object.keys(ctx()).concat(['n']));
  const all = flat([Object.values(words.GREET), words.OBSERVE.map((o) => o.r), words.WARM, words.CASUAL, words.SASSY, words.COMFORT, words.KEYS.map((k) => [k.r || [], k.sassy || []]), words.STATUS, words.FORTUNE, words.DICE, Object.values(words.MISC)]);
  for (const line of all) { assert.equal(typeof line, 'string'); for (const m of line.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(m[1]), `未知代號 {${m[1]}}：${line}`); }
  for (const k of words.KEYS) assert.doesNotThrow(() => new RegExp(k.re, 'i'));
  assert.doesNotThrow(() => new RegExp(words.COMFORT_RE, 'i'));
});

test('引擎：詞庫寫壞（壞規則、缺少池）也不會丟例外', () => {
  const origWarn = console.warn; console.warn = () => {};
  const brain = createFishBrain({ words: { KEYS: [{ re: '(' }, { re: 'x', r: [] }], COMFORT_RE: '[' }, rng: () => 0.5 });
  console.warn = origWarn;
  assert.ok(brain.greet(ctx()).length >= 1);
  assert.ok(brain.reply('x', ctx()).length >= 1);
});

test('連動：讀得到 prompt_list 的來訪次數；找到池塘後寫入記號；餵食要有飼料', async () => {
  const g = makeGame();
  g.ls.setItem('pp_fish_visits', '5');
  const fish = createFish({ ...g, crossStorage: g.storage });
  assert.equal(fish.found(), false);
  assert.equal(fish.feed(), false);
  assert.equal(g.ls.getItem('sfh_pond_found'), null);
  g.inv.add('feed', 1);
  assert.equal(fish.feed(), true);
  assert.equal(fish.found(), true);
  assert.equal(g.ls.getItem('sfh_pond_found'), '1');
  assert.equal(g.inv.count('feed'), 0);
  assert.ok(g.ach.unlocked('fish_found'));

  g.setRng(0);
  const s = await fish.session({ justFed: true });
  assert.equal(s.name, '魚魚');
  const greet = s.greet();
  assert.ok(greet.length >= 2);
  assert.equal(g.save.data.fish.visits, 1);
  s.reply('你好');
  assert.equal(g.save.data.fish.msgs, 1);
  await fish.session();                       // 同一次開網頁再開一次不重複計算來訪
  assert.equal(g.save.data.fish.visits, 1);

  // 連動台詞：在 prompt 那邊聊過的人，開場會被認出來
  const brain = createFishBrain({ words, rng: () => 0.99 });
  assert.match(brain.greet(ctx({ visits: 2, promptVisits: 5, pv: 5 })).join(''), /5|Prompt/);
});
