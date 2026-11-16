/* 背包：只接受 items.js 裡存在的物品；數量永遠是正整數。 */
export function createInventory({ save, reg, bus, cap = 999 }) {
  const validQty = (n) => Number.isInteger(n) && n > 0;
  const api = {
    count(id) { return save.data.inv[id] || 0; },
    has(id, n = 1) { return api.count(id) >= n; },
    seen(id) { return save.data.seen[id] === true; },

    /* 回傳實際加入的數量（未知物品或超過上限時可能是 0） */
    add(id, n = 1) {
      if (!reg.itemById.has(id) || !validQty(n)) { console.warn(`[inv] 無法加入：${id} x${n}`); return 0; }
      const cur = api.count(id);
      const added = Math.min(n, cap - cur);
      const firstTime = !save.data.seen[id];
      save.data.seen[id] = true;
      if (added > 0) save.data.inv[id] = cur + added;
      save.commit();
      bus.emit('inv:changed', { id, delta: added, count: api.count(id), firstTime });
      return added;
    },

    /* 數量不夠就完全不扣，回傳 false */
    remove(id, n = 1) {
      if (!validQty(n) || api.count(id) < n) return false;
      const left = api.count(id) - n;
      if (left > 0) save.data.inv[id] = left; else delete save.data.inv[id];
      save.commit();
      bus.emit('inv:changed', { id, delta: -n, count: left, firstTime: false });
      return true;
    },

    /* 列出持有物（可指定分類），依 items.js 的順序 */
    list(cat) {
      return reg.items
        .filter((it) => (!cat || it.cat === cat) && api.count(it.id) > 0)
        .map((it) => ({ item: it, count: api.count(it.id) }));
    },
  };
  return api;
}
