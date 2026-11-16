/* 釣魚：狀態機，不碰畫面。時間由外部傳入，方便測試。
   流程：start → waiting（等咬鉤）→ bite（限時拉竿）→ caught / missed；太早拉 = early */
import { randInt } from '../core/util.js';
import { rollLoot } from './loot.js';

export function createFishing({ reg, inv, progress, clock, bus, rng = Math.random, waitMs = [1500, 5000], biteMs = 800 }) {
  let s = null;   // {state, biteAt, biteUntil}

  const end = (state, extra = {}) => {
    s = null;
    const result = { state, ...extra };
    bus.emit('fishing:end', result);
    return result;
  };

  const api = {
    get active() { return s !== null; },
    get state() { return s ? s.state : 'idle'; },

    start(now) {
      if (s) return false;
      s = { state: 'waiting', biteAt: now + randInt(rng, waitMs[0], waitMs[1]), biteUntil: 0 };
      return true;
    },

    /* 每隔一小段時間呼叫；回傳目前狀態，若因超時結束則回傳結果物件 */
    update(now) {
      if (!s) return { state: 'idle' };
      if (s.state === 'waiting' && now >= s.biteAt) { s.state = 'bite'; s.biteUntil = s.biteAt + biteMs; }
      if (s.state === 'bite' && now > s.biteUntil) return end('missed');
      return { state: s.state };
    },

    /* 玩家拉竿 */
    pull(now) {
      if (!s) return { state: 'idle' };
      api.update(now);
      if (!s) return { state: 'missed' };
      if (s.state === 'waiting') return end('early');
      const itemId = rollLoot(reg.fish, { rng, phase: clock.phase() });
      if (!itemId) return end('missed');
      inv.add(itemId, 1);
      progress.inc('catches');
      return end('caught', { item: reg.itemById.get(itemId) });
    },

    cancel() { if (s) end('cancelled'); },
  };
  return api;
}
