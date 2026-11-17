import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, realData } from './helpers.js';
import { buildRegistry } from '../js/core/registry.js';
import { normalize } from '../js/core/save.js';
import { town } from '../js/data/maps/town.js';
import { CONFIG } from '../js/config.js';

const MIN = 60000;

test('升級：依序漲價、錢不夠不扣、滿級後不能再買、存檔後還在', () => {
  const g = makeGame();
  assert.equal(g.upgrades.buy('nope').reason, 'unknown');
  assert.equal(g.upgrades.buy('farm_plots').reason, 'coins');
  assert.equal(g.farm.size, 6);
  g.wallet.add(5000);
  const prices = [];
  for (let i = 0; i < 4; i++) { const r = g.upgrades.buy('farm_plots'); assert.equal(r.ok, true); prices.push(r.price); }
  assert.deepEqual(prices, [150, 300, 600, 1200]);
  assert.equal(g.upgrades.buy('farm_plots').reason, 'max');
  assert.equal(g.upgrades.nextPrice('farm_plots'), null);
  assert.equal(g.farm.size, 18);
  assert.equal(g.wallet.coins(), 5000 - 2250);
  g.save.flush();
  assert.equal(makeGame({ ls: g.ls }).farm.size, 18);
});

test('擴建農地：新的田可以種；田數不會超過地圖上預留的數量', () => {
  const g = makeGame();
  g.inv.add('seed_turnip', 2);
  assert.equal(g.farm.plant(6, 'seed_turnip').reason, 'invalid');
  g.wallet.add(200); g.upgrades.buy('farm_plots');
  assert.equal(g.farm.size, 9);
  assert.equal(g.farm.plant(8, 'seed_turnip').ok, true);
  assert.equal(g.farm.plant(9, 'seed_turnip').reason, 'invalid');
  g.save.data.upgrades.farm_plots = 50;                  // 存檔被改壞也不會超過上限
  assert.equal(g.farm.size, 18);
});

test('自動灑水器：沒澆水也用全速生長，狀態顯示為濕', () => {
  const g = makeGame();
  g.inv.add('seed_turnip', 2);
  g.farm.plant(0, 'seed_turnip');
  g.t.now += 2 * MIN;
  assert.ok(Math.abs(g.farm.status(0).pct - 0.2) < 1e-9);   // 乾的：半速
  g.wallet.add(500); assert.equal(g.upgrades.buy('sprinkler').ok, true);
  assert.equal(g.farm.status(0).wet, true);
  g.t.now += 2 * MIN;
  assert.ok(Math.abs(g.farm.status(0).pct - 0.6) < 1e-9);   // 裝好之後：全速
  assert.equal(g.upgrades.buy('sprinkler').reason, 'max');
});

test('生長藥水：每次長一半、可以重複用、成熟後不能再用', () => {
  const g = makeGame();
  g.inv.add('seed_turnip', 1); g.farm.plant(0, 'seed_turnip');
  assert.equal(g.farm.tonic(0).reason, 'no-item');
  g.inv.add('growth_tonic', 3);
  assert.equal(g.farm.tonic(0).ok, true); assert.ok(Math.abs(g.farm.status(0).pct - 0.5) < 1e-9);
  assert.equal(g.farm.tonic(0).ok, true); assert.equal(g.farm.status(0).state, 'ripe');
  assert.equal(g.farm.tonic(0).reason, 'ripe'); assert.equal(g.inv.count('growth_tonic'), 1);
  assert.equal(g.farm.tonic(3).reason, 'empty');
});

test('資料與存檔：升級資料檢查；舊存檔沒有 upgrades 也能讀', () => {
  assert.deepEqual(buildRegistry(realData()).errors, []);
  const bad = buildRegistry({ ...realData(), upgrades: [{ id: 'a', name: 'A', prices: [] }, { id: 'b', name: 'B', prices: [10, -1] }, { id: 'c', name: 'C', prices: [5], step: 0 }] });
  assert.equal(bad.upgrades.length, 0); assert.equal(bad.errors.length, 3);
  assert.deepEqual(normalize({ v: 1 }, 1).upgrades, {});
  assert.deepEqual(normalize({ v: 1, upgrades: { farm_plots: 2, x: -1, y: 1.5, __proto__: 3 } }, 1).upgrades, { farm_plots: 2 });
});

test('地圖：預留的田數等於上限，每塊 index 都不重複', () => {
  const plots = town.objects.filter((o) => o.type === 'plot');
  assert.equal(plots.length, CONFIG.FARM_MAX_PLOTS);
  assert.deepEqual(plots.map((p) => p.index).sort((a, b) => a - b), Array.from({ length: CONFIG.FARM_MAX_PLOTS }, (_, i) => i));
});
