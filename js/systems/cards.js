/* 角色卡收集：誰被召喚過、幾次。所有卡從一開始就能召喚，這裡只做紀錄。 */
import { pick } from '../core/util.js';

export function createCards({ save, reg, bus, progress, now = Date.now, rng = Math.random }) {
  const api = {
    total() { return reg.characters.length; },
    has(id) { return !!save.data.cards[id]; },
    /* 只計算目前資料裡仍存在的卡（角色被刪掉後，舊紀錄不會讓數字超過總數） */
    ownedCount() { return reg.characters.reduce((n, c) => n + (api.has(c.id) ? 1 : 0), 0); },

    summon(id) {
      const card = reg.characterById.get(id);
      if (!card) return null;
      const rec = save.data.cards[id];
      const first = !rec;
      if (first) save.data.cards[id] = { at: now(), count: 1 };
      else rec.count += 1;
      save.commit();
      if (first) progress.inc('cardsSummoned');
      progress.inc('summonsTotal');
      bus.emit('card:summoned', { id, first, card });
      return { card, first };
    },

    /* 隨機挑一張：優先挑還沒看過的；全部看過就全體隨機。沒有任何卡時回傳 -1 */
    randomIndex() {
      const all = reg.characters;
      if (!all.length) return -1;
      const unseen = [];
      all.forEach((c, i) => { if (!api.has(c.id)) unseen.push(i); });
      return unseen.length ? pick(rng, unseen) : Math.floor(rng() * all.length) % all.length;
    },
  };
  return api;
}
