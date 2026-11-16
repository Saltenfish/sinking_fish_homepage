/* 測試共用：組出一套不需要瀏覽器的系統。時間與亂數都可以控制。 */
import { createBus } from '../js/core/events.js';
import { buildRegistry } from '../js/core/registry.js';
import { createSave, safeStorage } from '../js/core/save.js';
import { createProgress } from '../js/systems/progress.js';
import { createInventory } from '../js/systems/inventory.js';
import { createCards } from '../js/systems/cards.js';
import { createFarm } from '../js/systems/farm.js';
import { createFishing } from '../js/systems/fishing.js';
import { createAchievements } from '../js/systems/achievements.js';
import { characters } from '../js/data/characters.js';
import { sites } from '../js/data/sites.js';
import { items } from '../js/data/items.js';
import { crops } from '../js/data/crops.js';
import { fish, loot } from '../js/data/loot.js';
import { achievements } from '../js/data/achievements.js';
import { offerings } from '../js/data/offerings.js';
import { createShop } from '../js/systems/shop.js';

export const realData = () => ({ characters, sites, items, crops, fish, loot, achievements, offerings });

export function memLS() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
}

export function makeGame({ data = realData(), ls = memLS(), start = 1_000_000 } = {}) {
  const t = { now: start };
  const now = () => t.now;
  let r = 0.5;
  const rng = () => r;
  const bus = createBus();
  const events = [];
  for (const type of ['inv:changed', 'card:summoned', 'ach:unlocked', 'farm:changed', 'fishing:end', 'stat:changed', 'flag:set', 'save:loaded']) bus.on(type, (p) => events.push({ type, ...p }));
  const reg = buildRegistry(data);
  const storage = safeStorage(ls);
  const save = createSave({ storage, key: 'test', bus, now, delay: 5 });
  save.load();
  const phase = { value: 'day' };
  const clock = { now, phase: () => phase.value };
  const progress = createProgress({ save, bus, now });
  const inv = createInventory({ save, reg, bus });
  const cards = createCards({ save, reg, bus, progress, now, rng });
  const farm = createFarm({ save, reg, bus, inv, progress, now, rng, plots: 6, wetMs: 600000, dryRate: 0.5 });
  const fishing = createFishing({ reg, inv, progress, clock, bus, rng, waitMs: [1000, 1000], biteMs: 800 });
  const ach = createAchievements({ save, reg, bus, inv, progress, now });
  const shop = createShop({ save, reg, inv, progress, bus });
  return { shop, t, setRng: (v) => { r = v; }, phase, bus, events, reg, storage, ls, save, clock, progress, inv, cards, farm, fishing, ach, rng, now };
}
