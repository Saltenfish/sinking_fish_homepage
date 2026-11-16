import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTilemap } from '../js/engine/tilemap.js';
import { boxBlocked, moveBox, distToRect } from '../js/engine/collision.js';
import { findPath } from '../js/engine/pathfind.js';
import { createCamera } from '../js/engine/camera.js';
import { town } from '../js/data/maps/town.js';

const mini = (rows) => createTilemap({ id: 'm', legend: { '.': { solid: false }, '#': { solid: true } }, rows, spawn: { x: 1.5, y: 1.5 }, objects: [] });

test('tilemap：格式錯誤會給出明確訊息', () => {
  assert.throws(() => mini(['...', '..']), /長度/);
  assert.throws(() => mini(['.?.', '...']), /沒定義/);
  assert.throws(() => createTilemap({ id: 'm', legend: { '#': { solid: true } }, rows: ['##', '##'], spawn: { x: 0.5, y: 0.5 } }), /spawn/);
  assert.throws(() => createTilemap({ id: 'm' }), /rows/);
});

test('town：地圖可載入；物件 id 不重複、都在地圖內、不放在擋路的格子上', () => {
  const map = createTilemap(town);
  assert.equal(map.w, 40); assert.equal(map.h, 30);
  const ids = new Set();
  for (const o of town.objects) {
    assert.ok(!ids.has(o.id), `id 重複：${o.id}`); ids.add(o.id);
    for (let y = o.y; y < o.y + (o.h || 1); y++) for (let x = o.x; x < o.x + (o.w || 1); x++) assert.equal(map.solid(x, y), false, `${o.id} 壓在擋路格 (${x},${y})`);
  }
});

test('town：從出生點走得到每一個互動物件（含隱藏池塘）', () => {
  const map = createTilemap(town);
  const solids = town.objects.filter((o) => o.solid).map((o) => ({ x: o.x, y: o.y, w: o.w || 1, h: o.h || 1 }));
  const passable = (x, y) => !map.solid(x, y) && !solids.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
  const sx = Math.floor(town.spawn.x), sy = Math.floor(town.spawn.y);
  for (const o of town.objects) assert.notEqual(findPath(passable, map.w, map.h, sx, sy, o.x, o.y), null, `走不到 ${o.id}`);
  // 池塘只能穿過蘆葦到達：把蘆葦當成牆就走不到
  const pond = town.objects.find((o) => o.type === 'pond');
  const noReeds = (x, y) => passable(x, y) && map.char(x, y) !== 'r';
  assert.equal(findPath(noReeds, map.w, map.h, sx, sy, pond.x, pond.y), null);
});

test('collision：撞牆停住、沿牆滑行、地圖外擋住', () => {
  const map = mini(['#####', '#...#', '#.#.#', '#...#', '#####']);
  assert.equal(boxBlocked(map, [], 1.5, 1.5, 0.3), false);
  assert.equal(boxBlocked(map, [], 1.2, 1.5, 0.3), true);
  assert.equal(boxBlocked(map, [], -5, -5, 0.3), true);
  const r = moveBox(map, [], { x: 1.5, y: 1.5 }, 0.1, -0.5, 0.3);
  assert.equal(r.hitY, true); assert.equal(r.y, 1.5); assert.ok(Math.abs(r.x - 1.6) < 1e-9);
  assert.equal(boxBlocked(map, [{ x: 3, y: 1, w: 1, h: 1 }], 2.8, 1.5, 0.3), true);
  assert.equal(boxBlocked(map, [{ x: 3, y: 1, w: 1, h: 1 }], 2.7, 1.5, 0.3), false);
  assert.equal(distToRect(0, 0, { x: 3, y: 4, w: 1, h: 1 }), 5);
  assert.equal(distToRect(3.5, 4.5, { x: 3, y: 4, w: 1, h: 1 }), 0);
});

test('pathfind：繞路、目標擋路時走到旁邊、走不到回傳 null', () => {
  const map = mini(['#####', '#...#', '#.#.#', '#...#', '#####']);
  const ok = (x, y) => !map.solid(x, y);
  const p = findPath(ok, 5, 5, 1, 1, 3, 3);
  assert.equal(p.length, 4); assert.deepEqual(p[p.length - 1], { x: 3, y: 3 });
  for (let i = 0; i < p.length; i++) { const a = i ? p[i - 1] : { x: 1, y: 1 }; assert.equal(Math.abs(a.x - p[i].x) + Math.abs(a.y - p[i].y), 1); assert.ok(ok(p[i].x, p[i].y)); }
  const near = findPath(ok, 5, 5, 1, 1, 2, 2);
  assert.equal(Math.abs(near.at(-1).x - 2) + Math.abs(near.at(-1).y - 2), 1);
  assert.deepEqual(findPath(ok, 5, 5, 1, 1, 1, 1), []);
  assert.equal(findPath(ok, 5, 5, 1, 1, 9, 9), null);
  const walled = mini(['#####', '#.#.#', '#####']);
  assert.equal(findPath((x, y) => !walled.solid(x, y), 5, 3, 1, 1, 3, 1), null);
});

test('camera：不超出邊界；地圖比畫面小時置中', () => {
  const cam = createCamera(640, 480);
  cam.follow(0, 0, 1280, 960); assert.deepEqual([cam.x, cam.y], [0, 0]);
  cam.follow(5000, 5000, 1280, 960); assert.deepEqual([cam.x, cam.y], [640, 480]);
  cam.follow(100, 100, 320, 240); assert.deepEqual([cam.x, cam.y], [-160, -120]);
});
