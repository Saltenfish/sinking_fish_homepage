/* 魚缸：把釣到的魚養起來。餵飼料後魚會開心一段時間；開心的魚每天可以領一次小禮物（金幣）。
   存檔：save.data.tank = [{item, at, fedAt}] */
export function createTank({ save, reg, inv, wallet, progress, bus, now = Date.now, capacity = 8, happyMs = 86400000, giftCdMs = 72000000, giftPerFish = 5 }) {
  const fishItem = (id) => { const it = reg.itemById.get(id); return it && it.cat === 'fish' ? it : null; };
  /* 資料裡已經不存在的魚（物品被刪除）自動清掉 */
  const clean = () => {
    const before = save.data.tank.length;
    save.data.tank = save.data.tank.filter((f) => fishItem(f.item));
    if (save.data.tank.length !== before) save.commit();
    return save.data.tank;
  };
  const happy = (f) => f.fedAt > 0 && now() - f.fedAt < happyMs && now() >= f.fedAt;

  const api = {
    capacity,
    list() { return clean().map((f, index) => ({ index, item: fishItem(f.item), happy: happy(f), at: f.at })); },
    count() { return clean().length; },
    happyCount() { return clean().filter(happy).length; },
    /* 背包裡可以放進魚缸的魚 */
    candidates() { return inv.list('fish'); },

    add(itemId) {
      if (!fishItem(itemId)) return { ok: false, reason: 'not-fish' };
      if (clean().length >= capacity) return { ok: false, reason: 'full' };
      if (!inv.remove(itemId, 1)) return { ok: false, reason: 'none' };
      save.data.tank.push({ item: itemId, at: now(), fedAt: 0 });
      save.commit();
      progress.inc('tankAdded');
      bus.emit('tank:changed', { action: 'add', itemId });
      return { ok: true };
    },

    /* 把魚撈回背包 */
    remove(index) {
      const list = clean();
      if (!Number.isInteger(index) || index < 0 || index >= list.length) return { ok: false, reason: 'invalid' };
      const [f] = list.splice(index, 1);
      save.commit();
      inv.add(f.item, 1);
      bus.emit('tank:changed', { action: 'remove', itemId: f.item });
      return { ok: true };
    },

    /* 餵一份飼料：缸裡所有魚都變開心 */
    feed() {
      const list = clean();
      if (!list.length) return { ok: false, reason: 'empty' };
      if (!inv.remove('feed', 1)) return { ok: false, reason: 'no-feed' };
      const t = now();
      for (const f of list) f.fedAt = t;
      save.commit();
      progress.inc('tankFeeds');
      bus.emit('tank:changed', { action: 'feed' });
      return { ok: true };
    },

    giftReady() { return api.happyCount() > 0 && progress.cooldownLeft('tankGift', giftCdMs) === 0; },
    /* 領禮物：每條開心的魚給 giftPerFish 金幣 */
    collect() {
      if (!api.giftReady()) return { ok: false, reason: api.happyCount() ? 'cooldown' : 'unhappy' };
      progress.markCooldown('tankGift');
      const coins = wallet.add(api.happyCount() * giftPerFish, 'tank');
      bus.emit('tank:changed', { action: 'gift', coins });
      return { ok: true, coins };
    },
  };
  return api;
}
