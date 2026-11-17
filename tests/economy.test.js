import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, realData } from './helpers.js';
import { buildRegistry } from '../js/core/registry.js';
import { normalize } from '../js/core/save.js';
import { resolveSrc, createAssets, frameAt } from '../js/core/assets.js';
import { checkPhases, phaseOfHour } from '../js/systems/clock.js';
import { PHASES } from '../js/data/time.js';
import { diceMultiplier, diceRtp, slotMultiplier, slotRtp, checkCasino, rollDice, spinSlot } from '../js/systems/casino.js';
import { casino as cfg } from '../js/data/casino.js';
import { buildTimeline, stepAt } from '../js/systems/summonFx.js';
import { summonFx } from '../js/data/summonFx.js';
import { assets as manifest } from '../js/data/assets.js';

test('時間設定：四個時段剛好涵蓋 24 小時；設定錯誤會被抓到', () => {
  assert.deepEqual(checkPhases(PHASES), []);
  const ids = new Set(); for (let h = 0; h < 24; h += 0.25) ids.add(phaseOfHour(h));
  assert.deepEqual([...ids].sort(), ['dawn', 'day', 'dusk', 'night']);
  assert.ok(checkPhases([{ id: 'a', from: 0, to: 12 }, { id: 'b', from: 13, to: 24 }]).length > 0);                         // 有空洞
  assert.ok(checkPhases([{ id: 'a', from: 0, to: 13 }, { id: 'b', from: 12, to: 24 }]).length > 0);                         // 重疊
  assert.ok(checkPhases([{ id: 'a', from: 0, to: 12 }, { id: 'a', from: 12, to: 24 }]).length > 0);                         // id 重複
  assert.ok(checkPhases([]).length > 0); assert.ok(checkPhases([{ id: 'a', from: 5, to: 5 }]).length > 0);
  assert.deepEqual(checkPhases([{ id: 'x', from: 22, to: 6 }, { id: 'y', from: 6, to: 22 }]), []);                          // 跨午夜
});

test('資料：正式資料全數通過；商店套利與賭場穩賺的設定會被擋下', () => {
  const reg = buildRegistry(realData());
  assert.deepEqual(reg.errors, []);
  assert.equal(reg.goods.length, 5); assert.ok(reg.casino); assert.ok(reg.summonFx);
  const d = realData();
  const bad = buildRegistry({ ...d, goods: [{ item: 'crop_turnip', price: 12 }, { item: 'nope', price: 5 }, { item: 'feed', price: 0 }, { item: 'feed', price: 15 }, { item: 'feed', price: 20 }],
    casino: { ...d.casino, dice: { side: 3, seven: 5 } }, summonFx: { steps: 'x' } });
  assert.deepEqual(bad.goods.map((g) => g.item), ['feed']);
  assert.equal(bad.casino, null); assert.equal(bad.summonFx, null);
  assert.ok(bad.errors.some((e) => e.includes('高於賣價')) && bad.errors.some((e) => e.includes('穩賺')));
  // 任何一樣東西買來再賣一定虧
  for (const g of reg.goods) assert.ok(g.price > (reg.itemById.get(g.item).sell || 0));
});

test('錢包：只收正整數、不夠不扣、有上限', () => {
  const g = makeGame();
  assert.equal(g.wallet.coins(), 0);
  for (const bad of [0, -5, 1.5, NaN, '3']) { assert.equal(g.wallet.add(bad), 0); assert.equal(g.wallet.spend(bad), false); }
  assert.equal(g.wallet.add(100), 100);
  assert.equal(g.wallet.spend(101), false); assert.equal(g.wallet.coins(), 100);
  assert.equal(g.wallet.spend(40), true); assert.equal(g.wallet.coins(), 60);
  assert.equal(g.wallet.add(5_000_000), 999999 - 60); assert.equal(g.wallet.coins(), 999999);
  assert.equal(g.wallet.add(1), 0);
});

test('商店：買賣流程；錢不夠、數量不合法、不能賣的東西都不會動到背包或金幣', () => {
  const g = makeGame();
  assert.equal(g.market.buy('seed_turnip', 1).reason, 'coins');
  g.wallet.add(100);
  assert.equal(g.market.buy('nope').reason, 'unknown');
  for (const q of [0, -1, 1.5, 100]) assert.equal(g.market.buy('seed_turnip', q).reason, 'qty');
  assert.equal(g.market.buy('seed_star', 1).reason, 'coins');
  assert.deepEqual(g.market.buy('seed_turnip', 5), { ok: true, cost: 50 });
  assert.equal(g.inv.count('seed_turnip'), 5); assert.equal(g.wallet.coins(), 50);
  assert.equal(g.market.sell('seed_turnip', 1).reason, 'unsellable');
  assert.equal(g.market.sell('crop_turnip', 1).reason, 'none');
  g.inv.add('crop_turnip', 3);
  assert.deepEqual(g.market.sell('crop_turnip', 2), { ok: true, gain: 24 });
  assert.equal(g.inv.count('crop_turnip'), 1); assert.equal(g.wallet.coins(), 74);
  assert.equal(g.market.sell('crop_turnip', 2).reason, 'none'); assert.equal(g.inv.count('crop_turnip'), 1);
  assert.ok(g.ach.unlocked('first_sale'));
  g.inv.add('feed', 998); g.wallet.add(1000);
  assert.equal(g.market.buy('feed', 5).reason, 'full'); assert.equal(g.inv.count('feed'), 998);
  assert.deepEqual(g.market.sellable().map((e) => e.item.id), ['crop_turnip']);
});

test('賭場：賠率表正確，期望值小於 1（長期一定輸給莊家）', () => {
  assert.deepEqual(checkCasino(cfg), []);
  assert.equal(diceMultiplier('small', [1, 2], cfg), 2); assert.equal(diceMultiplier('small', [3, 4], cfg), 0);
  assert.equal(diceMultiplier('big', [6, 2], cfg), 2); assert.equal(diceMultiplier('big', [3, 4], cfg), 0);
  assert.equal(diceMultiplier('seven', [3, 4], cfg), 5); assert.equal(diceMultiplier('seven', [6, 6], cfg), 0);
  assert.equal(diceMultiplier('whatever', [1, 1], cfg), 0);
  for (const p of ['small', 'big', 'seven']) assert.ok(Math.abs(diceRtp(p, cfg) - 30 / 36) < 1e-9);
  assert.equal(slotMultiplier(['seven', 'seven', 'seven'], cfg), 150);
  assert.equal(slotMultiplier(['fish', 'fish', 'star'], cfg), 0.5); assert.equal(slotMultiplier(['fish', 'star', 'fish'], cfg), 0.5);
  assert.equal(slotMultiplier(['fish', 'star', 'bell'], cfg), 0);
  const rtp = slotRtp(cfg); assert.ok(rtp > 0.7 && rtp < 0.95, `拉霸期望值 ${rtp}`);
  for (const r of [0, 0.5, 0.999999]) { const d = rollDice(() => r); assert.ok(d.every((x) => x >= 1 && x <= 6)); assert.equal(spinSlot(() => r, cfg).length, 3); }
  assert.ok(checkCasino({ ...cfg, slot: { ...cfg.slot, pair: 3 } }).length > 0);
  assert.ok(checkCasino({}).length > 0); assert.ok(checkCasino(null).length > 0);
});

test('賭場：先扣押注再派彩；付不起或亂填押注不會扣錢；大量模擬後莊家贏', async () => {
  const g = makeGame();
  assert.equal(g.casino.slot(10).reason, 'coins');
  g.wallet.add(1000);
  assert.equal(g.casino.slot(7).reason, 'bet'); assert.equal(g.casino.dice(10, 'x').reason, 'pick');
  assert.equal(g.wallet.coins(), 1000);
  g.setRng(0.99);                                   // 兩顆都是 6 → 12 點
  const win = g.casino.dice(100, 'big');
  assert.deepEqual([win.ok, win.payout, win.net, win.dice], [true, 200, 100, [6, 6]]); assert.equal(g.wallet.coins(), 1100);
  const lose = g.casino.dice(100, 'small');
  assert.deepEqual([lose.payout, lose.net], [0, -100]); assert.equal(g.wallet.coins(), 1000);
  g.setRng(0.99); const jackpot = g.casino.slot(10);   // 權重最後一格 = 七
  assert.deepEqual(jackpot.reels, ['seven', 'seven', 'seven']); assert.equal(jackpot.payout, 1500);
  assert.ok(g.ach.unlocked('first_win'));

  const sim = makeGame(); let n = 7; const rnd = () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
  const c = (await import('../js/systems/casino.js')).createCasino({ cfg, wallet: sim.wallet, progress: sim.progress, bus: sim.bus, rng: rnd });
  sim.wallet.add(500000); let staked = 0, back = 0;
  for (let i = 0; i < 20000; i++) { const r = i % 2 ? c.slot(10) : c.dice(10, ['small', 'big', 'seven'][i % 3]); staked += r.bet; back += r.payout; }
  assert.ok(back / staked > 0.7 && back / staked < 0.95, `模擬回收率 ${back / staked}`);
  assert.equal(sim.wallet.coins(), 500000 - staked + back);
});

test('魚缸：只收魚、有容量、餵食後開心一段時間、禮物有冷卻、撈回背包', () => {
  const g = makeGame();
  assert.equal(g.tank.add('feed').reason, 'not-fish'); assert.equal(g.tank.add('fish_small').reason, 'none');
  assert.equal(g.tank.feed().reason, 'empty');
  g.inv.add('fish_small', 3); g.inv.add('fish_koi', 1);
  for (let i = 0; i < 3; i++) assert.equal(g.tank.add('fish_small').ok, true);
  assert.equal(g.tank.add('fish_koi').reason, 'full'); assert.equal(g.inv.count('fish_koi'), 1);
  assert.equal(g.tank.count(), 3); assert.equal(g.inv.count('fish_small'), 0);
  assert.ok(g.ach.unlocked('tank_3'));
  assert.equal(g.tank.feed().reason, 'no-feed'); assert.equal(g.tank.collect().reason, 'unhappy');
  g.inv.add('feed', 2);
  assert.equal(g.tank.feed().ok, true); assert.equal(g.tank.happyCount(), 3); assert.equal(g.inv.count('feed'), 1);
  assert.deepEqual(g.tank.collect(), { ok: true, coins: 15 }); assert.equal(g.wallet.coins(), 15);
  assert.equal(g.tank.collect().reason, 'cooldown');
  g.t.now += 1001; assert.equal(g.tank.happyCount(), 0);                 // 過了開心時間
  g.t.now += 5000; assert.equal(g.tank.collect().reason, 'unhappy');
  for (const bad of [-1, 3, 1.5, 'x']) assert.equal(g.tank.remove(bad).reason, 'invalid');
  assert.equal(g.tank.remove(0).ok, true); assert.equal(g.tank.count(), 2); assert.equal(g.inv.count('fish_small'), 1);
  g.save.flush();
  const g2 = makeGame({ ls: g.ls, start: g.t.now });
  assert.equal(g2.tank.count(), 2);
  g2.save.data.tank.push({ item: 'deleted_fish', at: 1, fedAt: 0 });      // 資料被刪掉的魚自動清除
  assert.equal(g2.tank.count(), 2);
});

test('農田：施肥直接長一截、每株限一次、沒肥料不行', () => {
  const g = makeGame();
  g.inv.add('seed_turnip', 1); g.farm.plant(0, 'seed_turnip');
  assert.equal(g.farm.fertilize(0).reason, 'no-item'); assert.equal(g.farm.fertilize(1).reason, 'empty');
  g.inv.add('fertilizer', 2);
  assert.equal(g.farm.fertilize(0).ok, true);
  assert.ok(Math.abs(g.farm.status(0).pct - 0.3) < 1e-9); assert.equal(g.farm.status(0).fertilized, true);
  assert.equal(g.farm.fertilize(0).reason, 'done'); assert.equal(g.inv.count('fertilizer'), 1);
  g.t.now += 60 * 60000; assert.equal(g.farm.fertilize(0).reason, 'ripe');
  g.save.flush(); assert.equal(makeGame({ ls: g.ls, start: g.t.now }).farm.status(0).fertilized, true);
});

test('釣魚：有魚餌會自動用掉一個並縮短等待', () => {
  const g = makeGame();
  g.fishing.start(1000); assert.equal(g.fishing.baited, false); assert.equal(g.fishing.biteAt, 2000); g.fishing.cancel();
  g.inv.add('bait', 1);
  g.fishing.start(1000); assert.equal(g.fishing.baited, true); assert.equal(g.fishing.biteAt, 1400); assert.equal(g.inv.count('bait'), 0);
  g.fishing.cancel(); assert.equal(g.fishing.baited, false);
});

test('召喚特效：時間軸依稀有度與是否首次變化，階段連續不重疊', () => {
  const n = buildTimeline(summonFx, 'N'), ssr = buildTimeline(summonFx, 'SSR'), again = buildTimeline(summonFx, 'SSR', { first: false });
  assert.deepEqual(n.steps.map((s) => s.id), ['charge', 'beam', 'flip', 'reveal']);
  assert.deepEqual(ssr.steps.map((s) => s.id), ['charge', 'beam', 'flash', 'flip', 'reveal']);
  assert.ok(ssr.total > n.total); assert.ok(Math.abs(again.total - ssr.total / 2) <= 3);
  for (const tl of [n, ssr, again]) {
    assert.equal(tl.steps[0].start, 0); assert.equal(tl.steps.at(-1).end, tl.total);
    for (let i = 1; i < tl.steps.length; i++) assert.equal(tl.steps[i].start, tl.steps[i - 1].end);
    assert.equal(stepAt(tl, 0).id, 'charge'); assert.equal(stepAt(tl, tl.total - 1).id, 'reveal');
    assert.equal(stepAt(tl, tl.total), null); assert.equal(stepAt(tl, -1), null); assert.equal(stepAt(tl, NaN), null);
    for (let t = 0; t < tl.total; t += 37) { const s = stepAt(tl, t); assert.ok(s.p >= 0 && s.p < 1); }
  }
  assert.equal(buildTimeline(summonFx, '不存在的稀有度').rarity, 'N');
  assert.equal(buildTimeline({ steps: [], base: {}, rarity: {} }, 'N').total, 0);
});

test('素材：只接受安全的路徑；沒填或載入失敗都回到佔位圖', async () => {
  assert.equal(resolveSrc('assets/tiles/grass.png'), 'assets/tiles/grass.png');
  assert.equal(resolveSrc('https://example.com/a/b.webp'), 'https://example.com/a/b.webp');
  assert.equal(resolveSrc('tiles/grass.png', 'https://saltenfish.github.io/art/'), 'https://saltenfish.github.io/art/tiles/grass.png');
  for (const bad of ['../secret.png', '/abs.png', 'http://x.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAA', 'a.txt', 'a b.png', '', null, 5, 'assets\\x.png', 'https://x.com/a.exe'])
    assert.equal(resolveSrc(bad), null, String(bad));
  assert.equal(resolveSrc('a.png', 'ftp://x/'), null);

  const loads = []; const done = [];
  const a = createAssets({
    manifest: { ok: 'assets/a.png', anim: { src: 'assets/b.png', frameW: 32, frameH: 32, frames: 4, fps: 8 }, broken: 'assets/missing.png', evil: '../x.png', half: { src: 'assets/c.png', frames: 3 }, empty: null },
    loadImage: (src) => { loads.push(src); return src.includes('missing') ? Promise.reject(new Error('404')) : Promise.resolve({ src }); },
    onLoad: (k) => done.push(k),
  });
  assert.equal(a.errors.length, 2);
  assert.deepEqual(a.keys().sort(), ['anim', 'broken', 'ok']);
  assert.equal(a.url('nope'), null); assert.equal(a.image('nope'), null); assert.equal(a.url('ok'), 'assets/a.png');
  assert.deepEqual(loads, []);                                   // 還沒人要用，不下載
  assert.equal(a.image('ok'), null); assert.equal(a.image('ok'), null); assert.equal(a.image('broken'), null);
  assert.deepEqual(loads, ['assets/a.png', 'assets/missing.png']);   // 每張只下載一次
  const origWarn = console.warn; console.warn = () => {};
  await new Promise((r) => setTimeout(r, 5));
  console.warn = origWarn;
  assert.deepEqual(a.image('ok'), { src: 'assets/a.png' }); assert.equal(a.image('broken'), null);
  assert.deepEqual([a.status('ok'), a.status('broken'), a.status('anim')], ['ready', 'failed', 'idle']);
  assert.deepEqual(done, ['ok']);
  assert.equal(frameAt(a.meta('anim'), 0), 0); assert.equal(frameAt(a.meta('anim'), 0.13), 1); assert.equal(frameAt(a.meta('anim'), 0.5), 0);
  assert.equal(frameAt(a.meta('ok'), 99), 0); assert.equal(frameAt(null, 1), 0);
  assert.deepEqual(createAssets({ manifest, loadImage: () => Promise.reject() }).errors, []);   // 正式清單沒有寫錯的項目
});

test('存檔：舊存檔沒有金幣與魚缸也能讀；不合法的值會被修正', () => {
  const n = normalize({ v: 1 }, 1); assert.equal(n.coins, 0); assert.deepEqual(n.tank, []);
  assert.equal(normalize({ v: 1, coins: -5 }, 1).coins, 0); assert.equal(normalize({ v: 1, coins: 1.5 }, 1).coins, 0);
  assert.equal(normalize({ v: 1, coins: 1e12 }, 1).coins, 999999);
  assert.deepEqual(normalize({ v: 1, tank: [{ item: 'fish_small', at: 5 }, { item: '__proto__', at: 1 }, 'x', { item: 'a', at: -1 }] }, 1).tank, [{ item: 'fish_small', at: 5, fedAt: 0 }]);
});
