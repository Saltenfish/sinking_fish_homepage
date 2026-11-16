/* 進度：統計值、旗標、冷卻。全部存在存檔裡，變動時發事件。 */
import { safeKey, isNum } from '../core/util.js';

export function createProgress({ save, bus, now = Date.now }) {
  const need = (k) => { if (!safeKey(k)) throw new Error(`鍵名不合法：${k}`); };
  const api = {
    stat(k) { return save.data.stats[k] || 0; },
    inc(k, n = 1) {
      need(k);
      if (!isNum(n) || n <= 0) return api.stat(k);
      const v = (save.data.stats[k] || 0) + n;
      save.data.stats[k] = v;
      save.commit();
      bus.emit('stat:changed', { key: k, value: v });
      return v;
    },
    flag(k) { return save.data.flags[k] === true; },
    setFlag(k) {
      need(k);
      if (save.data.flags[k] === true) return false;
      save.data.flags[k] = true;
      save.commit();
      bus.emit('flag:set', { key: k });
      return true;
    },
    clearFlag(k) {
      if (save.data.flags[k] !== true) return false;
      delete save.data.flags[k];
      save.commit();
      return true;
    },
    /* 冷卻：距離上次觸發還要多久（0 = 可以用了） */
    cooldownLeft(k, ms) {
      const last = save.data.cooldowns[k];
      if (!isNum(last)) return 0;
      const t = now();
      if (t < last) return 0;               // 時鐘被往回調：直接放行，避免永久卡住
      return Math.max(0, last + ms - t);
    },
    markCooldown(k) { need(k); save.data.cooldowns[k] = now(); save.commit(); },
  };
  return api;
}
