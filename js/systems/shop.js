/* 祭壇供奉：用收集品換外觀（目前是卡背花色）。內容寫在 data/offerings.js。
   已換到的東西記成旗標 own:<id>；目前使用的卡背記在 save.data.settings.cardBack。 */
export function createShop({ save, reg, inv, progress, bus }) {
  const owned = (id) => progress.flag(`own:${id}`);
  const affordable = (o) => Object.keys(o.cost).every((k) => inv.has(k, o.cost[k]));

  const api = {
    list() { return reg.offerings.map((o) => ({ offering: o, owned: owned(o.id), affordable: affordable(o) })); },

    /* 供奉：材料足夠才會一次扣完，不會扣到一半 */
    buy(id) {
      const o = reg.offeringById.get(id);
      if (!o) return { ok: false, reason: 'unknown' };
      if (owned(id)) return { ok: false, reason: 'owned' };
      if (!affordable(o)) return { ok: false, reason: 'cost' };
      for (const k of Object.keys(o.cost)) inv.remove(k, o.cost[k]);
      progress.setFlag(`own:${id}`);
      progress.inc('offerings');
      bus.emit('shop:bought', { offering: o });
      return { ok: true, offering: o };
    },

    /* 可選的卡背：預設 + 已換到的 */
    backs() {
      return [{ id: 'default', name: '預設' }, ...reg.offerings.filter((o) => o.cardBack && owned(o.id)).map((o) => ({ id: o.cardBack, name: o.name }))];
    },
    /* 目前的卡背；存檔裡的值失效（資料被刪）時回到預設 */
    back() {
      const cur = save.data.settings.cardBack;
      return api.backs().some((b) => b.id === cur) ? cur : 'default';
    },
    setBack(id) {
      if (!api.backs().some((b) => b.id === id)) return false;
      save.data.settings.cardBack = id;
      save.commit();
      bus.emit('shop:back', { id });
      return true;
    },
  };
  return api;
}
