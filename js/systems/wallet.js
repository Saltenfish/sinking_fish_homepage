/* 錢包：小鎮裡的金幣（遊戲內代幣，與真實金錢無關）。永遠是 0 以上的整數。 */
export function createWallet({ save, bus, progress, cap = 999999 }) {
  const ok = (n) => Number.isInteger(n) && n > 0;
  const api = {
    coins() { return save.data.coins; },
    can(n) { return ok(n) && save.data.coins >= n; },
    /* 回傳實際增加的數量（碰到上限時會少於 n） */
    add(n, reason = '') {
      if (!ok(n)) return 0;
      const added = Math.min(n, cap - save.data.coins);
      if (added <= 0) return 0;
      save.data.coins += added;
      save.commit();
      progress?.inc('coinsEarned', added);
      bus.emit('coins:changed', { coins: save.data.coins, delta: added, reason });
      return added;
    },
    /* 錢不夠就完全不扣，回傳 false */
    spend(n, reason = '') {
      if (!api.can(n)) return false;
      save.data.coins -= n;
      save.commit();
      bus.emit('coins:changed', { coins: save.data.coins, delta: -n, reason });
      return true;
    },
  };
  return api;
}
