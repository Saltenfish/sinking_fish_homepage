/* 商店：用金幣買道具（種子、飼料、肥料、魚餌），也可以把收集品賣掉換金幣。
   商品在 data/market.js；物品的賣價是 items.js 裡的 sell。 */
export function createMarket({ reg, inv, wallet, progress, bus, cap = 999 }) {
  const qtyOk = (n) => Number.isInteger(n) && n >= 1 && n <= 99;
  return {
    goods() { return reg.goods.map((g) => ({ item: reg.itemById.get(g.item), price: g.price, affordable: wallet.can(g.price) })); },
    sellable() { return inv.list().filter(({ item }) => item.sell > 0).map(({ item, count }) => ({ item, count, price: item.sell })); },

    buy(itemId, qty = 1) {
      const g = reg.goodByItem.get(itemId);
      if (!g) return { ok: false, reason: 'unknown' };
      if (!qtyOk(qty)) return { ok: false, reason: 'qty' };
      if (inv.count(itemId) + qty > cap) return { ok: false, reason: 'full' };
      const cost = g.price * qty;
      if (!wallet.spend(cost, 'market')) return { ok: false, reason: 'coins' };
      inv.add(itemId, qty);
      progress.inc('bought', qty);
      bus.emit('market:trade', { kind: 'buy', itemId, qty, coins: cost });
      return { ok: true, cost };
    },

    sell(itemId, qty = 1) {
      const item = reg.itemById.get(itemId);
      if (!item || !(item.sell > 0)) return { ok: false, reason: 'unsellable' };
      if (!qtyOk(qty)) return { ok: false, reason: 'qty' };
      if (!inv.remove(itemId, qty)) return { ok: false, reason: 'none' };
      const gain = wallet.add(item.sell * qty, 'market');
      progress.inc('sold', qty);
      bus.emit('market:trade', { kind: 'sell', itemId, qty, coins: gain });
      return { ok: true, gain };
    },
  };
}
