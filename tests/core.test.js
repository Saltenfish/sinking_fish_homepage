import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../js/core/events.js';
import { buildRegistry } from '../js/core/registry.js';
import { createSave, safeStorage, normalize, migrate, blankSave, SAVE_VERSION } from '../js/core/save.js';
import { safeUrl, weighted } from '../js/core/util.js';
import { realData, memLS, makeGame } from './helpers.js';

test('bus：監聽器出錯不影響其他監聽器，可取消訂閱', () => {
  const bus = createBus(); const got = [];
  const origErr = console.error; console.error = () => {};
  bus.on('x', () => { throw new Error('boom'); });
  const off = bus.on('x', (p) => got.push(p));
  bus.emit('x', 1); off(); bus.emit('x', 2);
  console.error = origErr;
  assert.deepEqual(got, [1]);
});

test('registry：正式資料全部通過檢查', () => {
  const reg = buildRegistry(realData());
  assert.deepEqual(reg.errors, []);
  assert.ok(reg.characters.length >= 20);
  assert.equal(reg.sites.length, 4);
});

test('registry：壞資料被略過並回報，不會整個壞掉', () => {
  const d = realData();
  const reg = buildRegistry({ ...d,
    characters: [{ id: 'a', name: 'A', url: 'https://x.test/' }, { id: 'a', name: '重複', url: 'https://x.test/' }, { id: 'b', name: 'B', url: 'javascript:alert(1)' }, { name: '沒 id', url: 'https://x.test/' }, null, { id: '__proto__', name: 'P', url: 'https://x.test/' }],
    crops: [{ id: 'bad', name: '壞', seed: 'nope', produce: 'crop_turnip', growMs: 1, yield: [1, 1] }],
    achievements: [{ id: 'z', name: 'Z', cond: { what: 1 } }],
  });
  assert.equal(reg.characters.length, 1);
  assert.equal(reg.crops.length, 0);
  assert.equal(reg.achievements.length, 0);
  assert.equal(reg.errors.length, 7);
});

test('safeUrl 只放行 http(s)', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,hi'), null);
  assert.equal(safeUrl('not a url'), null);
  assert.ok(safeUrl('https://caveduck.io/x'));
});

test('weighted：邊界值', () => {
  const table = [{ id: 1, weight: 1 }, { id: 2, weight: 3 }];
  assert.equal(weighted(() => 0, table).id, 1);
  assert.equal(weighted(() => 0.9999, table).id, 2);
  assert.equal(weighted(() => 0.5, []), null);
});

test('save：寫入後重新讀取內容一致', () => {
  const ls = memLS();
  const a = makeGame({ ls });
  a.inv.add('feed', 3); a.cards.summon('c001'); a.progress.setFlag('hello');
  a.save.flush();
  const b = makeGame({ ls });
  assert.equal(b.inv.count('feed'), 3);
  assert.ok(b.cards.has('c001'));
  assert.ok(b.progress.flag('hello'));
});

test('save：壞掉的存檔會備份並重新開始', () => {
  const ls = memLS(); ls.setItem('test', '{這不是 JSON');
  const origWarn = console.warn; console.warn = () => {};
  const g = makeGame({ ls });
  console.warn = origWarn;
  assert.equal(g.save.data.v, SAVE_VERSION);
  assert.equal(ls.getItem('test.broken'), '{這不是 JSON');
});

test('save：normalize 丟掉不合格欄位與危險鍵名', () => {
  const raw = JSON.parse('{"v":1,"inv":{"feed":2,"bad":-1,"frac":1.5,"__proto__":9},"flags":{"a":true,"b":"yes"},"cards":{"c1":{"at":5,"count":0},"c2":"x"},"farm":{"plots":[{"crop":"turnip","progress":1,"last":2},{"crop":5},7]},"player":{"map":"town","x":"1","y":2},"wishes":["  hi  ","",3,"' + 'x'.repeat(50) + '"],"fish":{"visits":-3,"feeds":2}}');
  const n = normalize(raw, 10);
  assert.deepEqual(n.inv, { feed: 2 });
  assert.deepEqual(n.flags, { a: true });
  assert.deepEqual(n.cards, { c1: { at: 5, count: 1 } });
  assert.deepEqual(n.farm.plots, [{ crop: 'turnip', progress: 1, last: 2, wetUntil: 0, fert: false }, null, null]);
  assert.equal(n.player, null);
  assert.deepEqual(n.wishes, ['hi', 'x'.repeat(30)]);
  assert.deepEqual(n.fish, { visits: 0, feeds: 2, msgs: 0, lastAt: 0 });
  assert.equal(({}).polluted, undefined);
});

test('save：拒絕較新版本與無版本資料', () => {
  assert.throws(() => migrate({ v: SAVE_VERSION + 1 }));
  assert.throws(() => migrate({}));
  assert.throws(() => migrate(null));
  assert.equal(migrate(blankSave(1)).v, SAVE_VERSION);
});

test('save：匯出後匯入內容一致（含中文）；亂碼匯入失敗且不影響現有進度', () => {
  const a = makeGame();
  a.inv.add('shell', 2); a.save.data.wishes.push('願望✨中文');
  const code = a.save.exportCode();
  const b = makeGame();
  b.inv.add('feed', 1);
  for (const bad of ['', 'hello', 'SFH.@@@', 'SFH.' + btoa('{"v":99}'), 'SFH.' + btoa('[1]'), 5]) {
    assert.equal(b.save.importCode(bad).ok, false);
    assert.equal(b.inv.count('feed'), 1);
  }
  assert.equal(b.save.importCode('  ' + code + '\n').ok, true);
  assert.equal(b.inv.count('shell'), 2);
  assert.equal(b.inv.count('feed'), 0);
  assert.deepEqual(b.save.data.wishes, ['願望✨中文']);
});

test('save：localStorage 壞掉時改用記憶體，不會丟例外', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  const storage = safeStorage(broken);
  const save = createSave({ storage, key: 'k', now: () => 1, delay: 1 });
  save.load(); save.data.flags.x = true; save.commit();
  assert.equal(save.flush(), false);
  assert.equal(storage.persistent, false);
  assert.ok(JSON.parse(storage.get('k')).flags.x);
});

test('save：commit 會延遲合併成一次寫入', async () => {
  const ls = memLS(); let writes = 0;
  const counted = { ...ls, setItem: (k, v) => { writes++; ls.setItem(k, v); } };
  const save = createSave({ storage: safeStorage(counted), key: 'k', now: () => 1, delay: 10 });
  save.load();
  for (let i = 0; i < 20; i++) save.commit();
  assert.equal(writes, 0);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(writes, 1);
});
