/* 成就：條件寫在 data/achievements.js，這裡只負責在相關事件發生時檢查。 */
export function createAchievements({ save, reg, bus, inv, progress, now = Date.now }) {
  const met = (c) => {
    if (c.stat !== undefined) return progress.stat(c.stat) >= c.gte;
    if (c.flag !== undefined) return progress.flag(c.flag);
    if (c.seenAll !== undefined) return c.seenAll.every((id) => inv.seen(id));
    return false;
  };

  let checking = false, again = false;
  function check() {
    // 發獎勵會再觸發 inv:changed → 再進來一次；用旗標改成「跑完再補跑一輪」，避免遞迴
    if (checking) { again = true; return; }
    checking = true;
    try {
      do {
        again = false;
        for (const a of reg.achievements) {
          if (save.data.achievements[a.id] !== undefined || !met(a.cond)) continue;
          save.data.achievements[a.id] = now();
          save.commit();
          bus.emit('ach:unlocked', { achievement: a });
          if (a.reward) for (const id of Object.keys(a.reward)) inv.add(id, a.reward[id]);
        }
      } while (again);
    } finally { checking = false; }
  }

  bus.on('stat:changed', check);
  bus.on('flag:set', check);
  bus.on('inv:changed', check);

  return {
    check,
    unlocked(id) { return save.data.achievements[id] !== undefined; },
    list() { return reg.achievements.map((a) => ({ achievement: a, unlockedAt: save.data.achievements[a.id] ?? null })); },
  };
}
