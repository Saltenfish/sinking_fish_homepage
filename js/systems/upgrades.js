/* 永久升級：等級存在 save.data.upgrades = {升級id: 等級}。資料在 data/upgrades.js。 */
export function createUpgrades({ save, reg, wallet, progress, bus }) {
  const api = {
    level(id) { return save.data.upgrades[id] || 0; },
    max(id) { return reg.upgradeById.get(id)?.prices.length ?? 0; },
    /* 下一級的價格；已經滿級或沒有這個升級回傳 null */
    nextPrice(id) {
      const u = reg.upgradeById.get(id);
      if (!u) return null;
      const lv = api.level(id);
      return lv < u.prices.length ? u.prices[lv] : null;
    },
    list() { return reg.upgrades.map((u) => ({ upgrade: u, level: api.level(u.id), max: u.prices.length, price: api.nextPrice(u.id) })); },
    buy(id) {
      const u = reg.upgradeById.get(id);
      if (!u) return { ok: false, reason: 'unknown' };
      const price = api.nextPrice(id);
      if (price === null) return { ok: false, reason: 'max' };
      if (!wallet.spend(price, 'upgrade')) return { ok: false, reason: 'coins' };
      save.data.upgrades[id] = api.level(id) + 1;
      save.commit();
      progress.inc('upgrades');
      bus.emit('upgrade:bought', { upgrade: u, level: save.data.upgrades[id] });
      return { ok: true, level: save.data.upgrades[id], price };
    },
  };
  return api;
}
