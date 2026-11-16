/* 魚魚的對外窗口：負責組出「當下狀態」、記錄熟悉度、跨網站連動。
   引擎與詞庫在第一次用到時才載入。 */
import { CONFIG } from '../config.js';

export function createFish({ save, reg, cards, farm, inv, clock, progress, bus, crossStorage, now = Date.now, rng = Math.random }) {
  let loaded = null;          // Promise<{createFishBrain, familiarity, words}>
  let countedVisit = false;   // 同一次開網頁只算一次來訪

  const load = () => (loaded ??= Promise.all([import('./brain.js'), import('./words-home.js')])
    .then(([b, w]) => ({ ...b, words: w.default }))
    .catch((e) => { loaded = null; throw e; }));

  const crossInt = (key) => {
    const n = parseInt(crossStorage?.get(key) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function context(extra = {}) {
    const f = save.data.fish;
    return {
      visits: f.visits, feeds: f.feeds, msgs: f.msgs,
      days: f.lastAt > 0 ? Math.max(0, Math.floor((now() - f.lastAt) / 86400000)) : 0,
      cards: cards.ownedCount(), total: cards.total(),
      ripe: farm.ripeCount(),
      fishInBag: inv.list('fish').reduce((n, e) => n + e.count, 0),
      phase: clock.phase(),
      promptVisits: crossInt(CONFIG.CROSS_SITE.PROMPT_VISITS),
      pv: crossInt(CONFIG.CROSS_SITE.PROMPT_VISITS),
      ...extra,
    };
  }

  return {
    found() { return progress.flag('fishFound'); },

    /* 餵食：消耗一份飼料。回傳是否成功 */
    feed() {
      if (!inv.remove('feed', 1)) return false;
      save.data.fish.feeds += 1;
      save.commit();
      if (progress.setFlag('fishFound')) crossStorage?.set(CONFIG.CROSS_SITE.POND_FOUND, '1');
      return true;
    },

    /* 開始一次對話。回傳 {name, subtitle, greet(), reply(text)} */
    async session({ justFed = false } = {}) {
      const { createFishBrain, words } = await load();
      const brain = createFishBrain({ words, rng });
      const ctxAtOpen = context({ justFed });      // 「幾天沒來」要在更新 lastAt 之前算
      if (!countedVisit) { countedVisit = true; save.data.fish.visits += 1; ctxAtOpen.visits = save.data.fish.visits; }
      save.data.fish.lastAt = now();
      save.commit();
      bus.emit('fish:opened', {});
      return {
        name: words.MISC?.NAME || '魚魚',
        subtitle: words.MISC?.SUBTITLE || '',
        greet: () => brain.greet(ctxAtOpen),
        reply: (text) => {
          save.data.fish.msgs += 1;
          save.commit();
          return brain.reply(text, context({ days: ctxAtOpen.days }));
        },
      };
    },

    async misc(key) { const { words } = await load(); return words.MISC?.[key]; },
  };
}
