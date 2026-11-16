import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, realData } from './helpers.js';
import { buildRegistry } from '../js/core/registry.js';
import { normalize } from '../js/core/save.js';
import { pickScale } from '../js/engine/view.js';
import { stickToAxis } from '../js/engine/input.js';
import { skyTint, createClock } from '../js/systems/clock.js';
import { bugReaction } from '../js/systems/bugs.js';
import { rollLoot } from '../js/systems/loot.js';
import { ANCHORS, plaqueSpot, TREE_W, TREE_H, PLAQUE_W, PLAQUE_H } from '../js/systems/treeLayout.js';
import { createTilemap } from '../js/engine/tilemap.js';
import { boxBlocked } from '../js/engine/collision.js';
import { town } from '../js/data/maps/town.js';
import { CONFIG } from '../js/config.js';

const opts = { minW: CONFIG.VIEW_MIN_W, minH: CONFIG.VIEW_MIN_H, scales: CONFIG.VIEW_SCALES };

test('畫面倍率：桌機放大、手機用最小倍率，任何尺寸都不會回傳無效值', () => {
  assert.equal(pickScale(1920, 1080, opts), 2);
  assert.equal(pickScale(3840, 2160, opts), 4);
  assert.equal(pickScale(1366, 768, opts), 1.5);
  assert.equal(pickScale(390, 844, opts), 1);     // 手機直向
  assert.equal(pickScale(844, 390, opts), 1);     // 手機橫向
  for (const [w, h] of [[1, 1], [320, 480], [2560, 1080], [5120, 1440], [800, 600]]) assert.ok(CONFIG.VIEW_SCALES.includes(pickScale(w, h, opts)));
});

test('搖桿：死區內不動、輕推潛行、推到底正常走，方向是單位向量', () => {
  assert.deepEqual(stickToAxis(0.1, 0.1, 0.4), { x: 0, y: 0, mag: 0 });
  assert.equal(stickToAxis(0.4, 0, 0.4).mag, 0.4);
  const full = stickToAxis(0.7, 0.7, 0.4);
  assert.equal(full.mag, 1); assert.ok(Math.abs(Math.hypot(full.x, full.y) - 1) < 1e-9);
  assert.deepEqual(stickToAxis(NaN, 0, 0.4), { x: 0, y: 0, mag: 0 });
});

test('天色：白天透明、深夜最暗、整天連續變化（相鄰十分鐘不會突然跳色）', () => {
  assert.equal(skyTint(12).a, 0);
  assert.equal(skyTint(2).a, 0.42); assert.equal(skyTint(23.9).a, 0.42);
  assert.ok(skyTint(18).a > 0 && skyTint(18).a < 0.42);
  assert.deepEqual(skyTint(24), skyTint(0)); assert.deepEqual(skyTint(-1), skyTint(23));
  for (let m = 0; m < 24 * 6; m++) {
    const a = skyTint(m / 6), b = skyTint((m + 1) / 6);
    assert.ok(Math.abs(a.a - b.a) <= 0.05, `${m / 6} 點透明度跳太多`);
    for (const c of [a.r, a.g, a.b]) assert.ok(c >= 0 && c <= 255);
  }
});

test('時鐘：依現實時間；?hour 預覽值可設定與取消', () => {
  const at = (h, m) => new Date(2026, 0, 1, h, m).getTime();
  const clock = createClock(() => at(22, 14));
  assert.equal(clock.phase(), 'night'); assert.equal(clock.label(), '22:14');
  clock.setDebugHour(12.5); assert.equal(clock.phase(), 'day'); assert.equal(clock.label(), '12:30');
  clock.setDebugHour(30); assert.equal(clock.hour(), 6);
  clock.setDebugHour(null); assert.equal(clock.label(), '22:14');
  assert.equal(createClock(() => at(6, 0)).phase(), 'dawn');
});

test('捕蟲：遠處或慢慢走不會嚇跑，靠近又走太快才會', () => {
  const o = { alertRadius: CONFIG.BUG_ALERT_RADIUS, sneakSpeed: CONFIG.BUG_SNEAK_SPEED };
  assert.equal(bugReaction(5, CONFIG.PLAYER_SPEED, o), 'stay');
  assert.equal(bugReaction(1, CONFIG.PLAYER_SPEED, o), 'flee');
  assert.equal(bugReaction(1, CONFIG.PLAYER_SPEED * CONFIG.SNEAK_RATE, o), 'stay');   // 潛行速度一定抓得到
  assert.equal(bugReaction(1, 0, o), 'stay');
});

test('捕蟲：白天沒有蟲，黃昏只有螢火蟲，深夜兩種都有', () => {
  const g = makeGame();
  const pool = (phase) => g.reg.lootTables.bugs.filter((t) => t.phases.includes(phase)).map((t) => t.item);
  assert.deepEqual(pool('day'), []); assert.deepEqual(pool('dawn'), []);
  assert.deepEqual(pool('dusk'), ['bug_firefly']);
  assert.deepEqual(pool('night').sort(), ['bug_firefly', 'bug_glow']);
  assert.equal(rollLoot(g.reg.lootTables.bugs, { rng: () => 0.99, phase: 'night' }), 'bug_glow');
});

test('供奉：材料不足不扣、足夠一次扣完、不能重複換、卡背要擁有才能用', () => {
  const g = makeGame();
  g.inv.add('leaf_pink', 3); g.inv.add('crop_turnip', 1);
  assert.equal(g.shop.buy('back_sakura').reason, 'cost');
  assert.equal(g.inv.count('leaf_pink'), 3); assert.equal(g.inv.count('crop_turnip'), 1);
  assert.equal(g.shop.setBack('sakura'), false);
  g.inv.add('crop_turnip', 1);
  assert.equal(g.shop.buy('back_sakura').ok, true);
  assert.equal(g.inv.count('leaf_pink'), 0); assert.equal(g.inv.count('crop_turnip'), 0);
  assert.equal(g.shop.buy('back_sakura').reason, 'owned');
  assert.equal(g.shop.buy('nope').reason, 'unknown');
  assert.ok(g.ach.unlocked('first_offering'));
  assert.deepEqual(g.shop.backs().map((b) => b.id), ['default', 'sakura']);
  assert.equal(g.shop.back(), 'default');
  assert.equal(g.shop.setBack('sakura'), true); assert.equal(g.shop.back(), 'sakura');
  assert.equal(g.shop.setBack('star'), false);
  g.save.flush();
  const g2 = makeGame({ ls: g.ls });
  assert.equal(g2.shop.back(), 'sakura');
  g2.save.data.settings.cardBack = 'deleted_skin';       // 花色資料被刪除時回到預設
  assert.equal(g2.shop.back(), 'default');
});

test('存檔：舊存檔沒有 settings 也能讀；不合法的 settings 會被修正', () => {
  assert.deepEqual(normalize({ v: 1 }, 1).settings, { cardBack: 'default' });
  assert.deepEqual(normalize({ v: 1, settings: { cardBack: 'star' } }, 1).settings, { cardBack: 'star' });
  assert.deepEqual(normalize({ v: 1, settings: { cardBack: 5 } }, 1).settings, { cardBack: 'default' });
  assert.deepEqual(normalize({ v: 1, settings: 'x' }, 1).settings, { cardBack: 'default' });
});

test('資料：供奉資料通過檢查；寫錯的會被略過', () => {
  assert.deepEqual(buildRegistry(realData()).errors, []);
  const bad = buildRegistry({ ...realData(), offerings: [{ id: 'a', name: 'A', cost: {} }, { id: 'b', name: 'B', cost: { nope: 1 } }, { id: 'c', name: 'C', cost: { feed: 1 }, cardBack: 'Bad Name' }, { id: 'd', name: 'D', cost: { feed: 1 } }] });
  assert.equal(bad.offerings.length, 1); assert.equal(bad.errors.length, 3);
});

test('許願樹：每塊牌都在畫面內、位置不重複；掛點用完後仍排得下', () => {
  const seen = new Set();
  for (let i = 0; i < ANCHORS.length * 3; i++) {
    const s = plaqueSpot(i);
    assert.ok(s.x - PLAQUE_W / 2 >= 0 && s.x + PLAQUE_W / 2 <= TREE_W, `第 ${i} 塊超出左右`);
    assert.ok(s.y >= 0 && s.len >= 0 && s.y + s.len + PLAQUE_H <= TREE_H, `第 ${i} 塊超出上下`);
    const key = `${s.x},${s.y},${s.len}`; assert.ok(!seen.has(key), `第 ${i} 塊位置重複`); seen.add(key);
  }
  // 前 14 塊（4 個網站 + 10 個願望）彼此不重疊超過四分之一
  const rects = Array.from({ length: 14 }, (_, i) => { const s = plaqueSpot(i); return { x0: s.x - PLAQUE_W / 2, x1: s.x + PLAQUE_W / 2, y0: s.y + s.len, y1: s.y + s.len + PLAQUE_H }; });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const ov = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    assert.ok(ov <= PLAQUE_W * PLAQUE_H * 0.25, `第 ${i} 與第 ${j} 塊重疊太多`);
  }
});

test('地圖：每個傳送地點都站得上去', () => {
  const map = createTilemap(town);
  const solids = town.objects.filter((o) => o.solid).map((o) => ({ x: o.x, y: o.y, w: o.w || 1, h: o.h || 1 }));
  const ids = new Set();
  for (const l of town.landmarks) {
    assert.ok(!ids.has(l.id)); ids.add(l.id);
    assert.equal(boxBlocked(map, solids, l.x, l.y, CONFIG.PLAYER_HALF), false, `${l.name} 被擋住`);
  }
  assert.ok(town.landmarks.find((l) => l.id === 'pond').secret);
});
