import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame } from './helpers.js';
import { settlePlot } from '../js/systems/farm.js';
import { createRing, splitRings } from '../js/systems/ringModel.js';
import { phaseOfHour } from '../js/systems/clock.js';
import { rollLoot } from '../js/systems/loot.js';

const MIN = 60000;

test('inventory：未知物品、非法數量、上限、扣除不足', () => {
  const g = makeGame();
  const origWarn = console.warn; console.warn = () => {};
  assert.equal(g.inv.add('nope', 1), 0);
  assert.equal(g.inv.add('feed', 0), 0);
  assert.equal(g.inv.add('feed', 1.5), 0);
  assert.equal(g.inv.add('feed', -2), 0);
  console.warn = origWarn;
  assert.equal(g.inv.add('feed', 5), 5);
  assert.equal(g.inv.remove('feed', 6), false);
  assert.equal(g.inv.count('feed'), 5);
  assert.equal(g.inv.remove('feed', 5), true);
  assert.equal(g.inv.count('feed'), 0);
  assert.equal('feed' in g.save.data.inv, false);
  assert.ok(g.inv.seen('feed'));
  assert.equal(g.inv.add('shell', 2000), 999);
  assert.equal(g.inv.add('shell', 1), 0);
});

test('cards：首次與重複召喚、未知卡、隨機優先未看過', () => {
  const g = makeGame();
  assert.equal(g.cards.summon('ghost'), null);
  assert.equal(g.cards.summon('c001').first, true);
  assert.equal(g.cards.summon('c001').first, false);
  assert.equal(g.progress.stat('cardsSummoned'), 1);
  assert.equal(g.save.data.cards.c001.count, 2);
  g.save.data.cards.deleted_card = { at: 1, count: 1 };
  assert.equal(g.cards.ownedCount(), 1);
  g.reg.characters.forEach((c, i) => { if (i !== 7) g.cards.summon(c.id); });
  for (const r of [0, 0.5, 0.999]) { g.setRng(r); assert.equal(g.cards.randomIndex(), 7); }
  g.cards.summon(g.reg.characters[7].id);
  g.setRng(0.999999);
  const idx = g.cards.randomIndex();
  assert.ok(idx >= 0 && idx < g.cards.total());
});

test('farm：settlePlot 濕 1 倍、乾 0.5 倍、不超過成熟、時鐘倒退不倒扣', () => {
  const p = { crop: 'x', progress: 0, last: 0, wetUntil: 4 * MIN };
  assert.equal(settlePlot(p, 100 * MIN, 10 * MIN, 0.5).progress, 4 * MIN + 3 * MIN);
  assert.equal(settlePlot(p, 5 * MIN, 60 * MIN, 0.5).progress, 5 * MIN);
  const back = settlePlot({ ...p, progress: 2 * MIN, last: 50 * MIN }, 100 * MIN, 10 * MIN, 0.5);
  assert.equal(back.progress, 2 * MIN); assert.equal(back.last, 10 * MIN);
});

test('farm：播種 → 澆水 → 成熟 → 收成 的完整流程', () => {
  const g = makeGame();
  assert.equal(g.farm.plant(0, 'seed_turnip').reason, 'no-seed');
  g.inv.add('seed_turnip', 1);
  assert.equal(g.farm.plant(9, 'seed_turnip').reason, 'invalid');
  assert.equal(g.farm.plant(0, 'feed').reason, 'not-seed');
  assert.equal(g.inv.count('seed_turnip'), 1);
  assert.equal(g.farm.plant(0, 'seed_turnip').ok, true);
  assert.equal(g.inv.count('seed_turnip'), 0);
  assert.equal(g.farm.plant(0, 'seed_turnip').reason, 'occupied');
  assert.equal(g.farm.harvest(0).reason, 'not-ripe');
  assert.equal(g.farm.water(0).ok, true);
  g.t.now += 4 * MIN;
  const mid = g.farm.status(0);
  assert.equal(mid.state, 'growing'); assert.ok(Math.abs(mid.pct - 0.8) < 1e-9); assert.equal(mid.wet, true);
  g.t.now += 1 * MIN;
  assert.equal(g.farm.status(0).state, 'ripe');
  assert.equal(g.farm.ripeCount(), 1);
  assert.equal(g.farm.water(0).reason, 'ripe');
  g.setRng(0.99);
  const h = g.farm.harvest(0);
  assert.equal(h.ok, true); assert.equal(h.qty, 2);
  assert.equal(g.inv.count('crop_turnip'), 2);
  assert.equal(g.farm.status(0).state, 'empty');
  assert.equal(g.farm.harvest(0).reason, 'empty');
  assert.ok(g.ach.unlocked('first_harvest'));
});

test('farm：沒澆水要兩倍時間；關掉網頁再回來照樣長', () => {
  const g = makeGame();
  g.inv.add('seed_turnip', 1); g.farm.plant(2, 'seed_turnip');
  g.t.now += 5 * MIN;
  assert.ok(Math.abs(g.farm.status(2).pct - 0.5) < 1e-9);
  g.save.flush();
  const g2 = makeGame({ ls: g.ls, start: g.t.now + 5 * MIN });
  assert.equal(g2.farm.status(2).state, 'ripe');
});

test('farm：作物資料被刪除後，那格田自動清空', () => {
  const g = makeGame();
  g.save.data.farm.plots = [{ crop: 'removed_crop', progress: 0, last: 0, wetUntil: 0 }];
  assert.equal(g.farm.status(0).state, 'empty');
});

test('fishing：太早拉、準時拉、太晚、時段限定', () => {
  const g = makeGame();
  const t0 = g.t.now;
  assert.equal(g.fishing.start(t0), true);
  assert.equal(g.fishing.start(t0), false);
  assert.equal(g.fishing.pull(t0 + 500).state, 'early');
  assert.equal(g.fishing.active, false);

  g.fishing.start(t0);
  assert.equal(g.fishing.update(t0 + 999).state, 'waiting');
  assert.equal(g.fishing.update(t0 + 1000).state, 'bite');
  g.setRng(0);
  const r = g.fishing.pull(t0 + 1500);
  assert.equal(r.state, 'caught'); assert.equal(r.item.id, 'fish_small');
  assert.equal(g.inv.count('fish_small'), 1);
  assert.ok(g.ach.unlocked('first_catch'));

  g.fishing.start(t0);
  assert.equal(g.fishing.update(t0 + 1801).state, 'missed');
  g.fishing.start(t0);
  assert.equal(g.fishing.pull(t0 + 5000).state, 'missed');
  assert.equal(g.fishing.pull(t0).state, 'idle');

  // 夜晚才釣得到怪魚；白天的掉落表裡不能有牠
  for (let i = 0; i < 200; i++) assert.notEqual(rollLoot(g.reg.fish, { rng: () => i / 200, phase: 'day' }), 'fish_odd');
  const night = new Set(); for (let i = 0; i < 200; i++) night.add(rollLoot(g.reg.fish, { rng: () => i / 200, phase: 'night' }));
  assert.ok(night.has('fish_odd')); assert.ok(!night.has('fish_koi'));
});

test('achievements：條件達成只解鎖一次，獎勵會發放且不會遞迴', () => {
  const g = makeGame();
  for (let i = 0; i < 10; i++) g.cards.summon(g.reg.characters[i].id);
  assert.ok(g.ach.unlocked('first_summon')); assert.ok(g.ach.unlocked('summon_10'));
  assert.equal(g.inv.count('seed_star'), 1);
  g.cards.summon(g.reg.characters[10].id);
  assert.equal(g.events.filter((e) => e.type === 'ach:unlocked' && e.achievement.id === 'summon_10').length, 1);
  for (const id of ['leaf_pink', 'leaf_purple', 'leaf_teal']) g.inv.add(id, 1);
  assert.ok(!g.ach.unlocked('all_leaves'));
  g.inv.add('leaf_gold', 1);
  assert.ok(g.ach.unlocked('all_leaves'));
  assert.equal(g.inv.count('feed'), 3);
});

test('progress：冷卻與時鐘倒退', () => {
  const g = makeGame();
  assert.equal(g.progress.cooldownLeft('k', 1000), 0);
  g.progress.markCooldown('k');
  assert.equal(g.progress.cooldownLeft('k', 1000), 1000);
  g.t.now += 400; assert.equal(g.progress.cooldownLeft('k', 1000), 600);
  g.t.now += 600; assert.equal(g.progress.cooldownLeft('k', 1000), 0);
  g.progress.markCooldown('k'); g.t.now -= 99999;
  assert.equal(g.progress.cooldownLeft('k', 1000), 0);
  assert.throws(() => g.progress.setFlag('__proto__'));
});

test('clock：時段切換點', () => {
  assert.deepEqual([4, 5, 6, 7, 16, 17, 18, 19, 23, 0].map(phaseOfHour), ['night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night', 'night']);
});

test('ring：分圈', () => {
  assert.deepEqual(splitRings(0, 30), []);
  assert.deepEqual(splitRings(24, 30), [24]);
  assert.deepEqual(splitRings(31, 30), [16, 15]);
  assert.deepEqual(splitRings(61, 30), [21, 20, 20]);
});

test('ring：慣性滑動後一定停在整數張、索引在範圍內', () => {
  for (const v of [0, 0.4, -3.7, 12, -40, 200]) {
    const ring = createRing({ count: 24 });
    ring.dragStart(); ring.dragMove(0.37); ring.dragEnd(v);
    let steps = 0;
    while (!ring.settled && steps++ < 5000) ring.step(1 / 60);
    assert.ok(ring.settled, `v=${v} 沒有停下來`);
    assert.ok(Number.isInteger(ring.angle) && ring.angle >= 0 && ring.angle < 24);
    assert.equal(ring.frontIndex(), ring.angle);
  }
});

test('ring：命運輪盤停在指定的卡並回呼一次；轉動中不接受其他操作', () => {
  for (const target of [0, 5, 23]) {
    const ring = createRing({ count: 24 });
    ring.nudge(3); for (let i = 0; i < 60; i++) ring.step(1 / 60);
    assert.equal(ring.frontIndex(), 3);
    let done = [];
    assert.equal(ring.spinTo(target, { onDone: (i) => done.push(i) }), true);
    assert.equal(ring.spinTo(1), false);
    ring.nudge(5); ring.dragStart(); ring.dragMove(3); ring.dragEnd(9);
    let prev = ring.angle, steps = 0;
    while (!ring.settled && steps++ < 2000) { ring.step(1 / 60); if (!ring.settled) { assert.ok(ring.angle >= prev - 1e-9, '輪盤不可倒轉'); prev = ring.angle; } }
    assert.deepEqual(done, [target]);
    assert.equal(ring.frontIndex(), target);
  }
});

test('ring：visible 視窗不重複、數量正確，各種張數都成立', () => {
  for (const n of [1, 2, 3, 4, 5, 10, 11, 12, 24, 100]) {
    const ring = createRing({ count: n });
    ring.dragStart(); ring.dragMove(n * 3 + 0.4);
    const vis = ring.visible(5);
    assert.equal(vis.length, Math.min(n, 11), `n=${n}`);
    assert.equal(new Set(vis.map((v) => v.index)).size, vis.length, `n=${n} 有重複`);
    for (const v of vis) assert.ok(v.index >= 0 && v.index < n);
    ring.dragEnd(0);
  }
  const empty = createRing({ count: 0 });
  assert.deepEqual(empty.visible(5), []); assert.equal(empty.frontIndex(), -1);
  empty.nudge(1); empty.step(0.1); assert.equal(empty.spinTo(0), false);
});
