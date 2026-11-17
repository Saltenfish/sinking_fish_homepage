/* 農田：用時間戳計算生長，不跑計時器。關掉網頁作物照樣長。
   每格存 {crop, progress, last, wetUntil}：
     progress  已累積的生長量（毫秒，以「有澆水」的速度計）
     last      上次結算的時間
     wetUntil  土壤保持濕潤到什麼時候 */
import { randInt, clamp } from '../core/util.js';

/* 純函式：把一格田結算到 now。濕潤期間 1 倍速，乾燥期間 dryRate 倍速 */
export function settlePlot(plot, growMs, now, dryRate, alwaysWet = false) {
  const last = Math.min(plot.last, now);             // 時鐘被往回調時不倒扣
  const elapsed = now - last;
  const wet = alwaysWet ? elapsed : clamp(Math.min(now, plot.wetUntil) - last, 0, elapsed);
  const gain = wet + (elapsed - wet) * dryRate;
  return { ...plot, progress: Math.min(growMs, plot.progress + gain), last: now };
}

/* size()：目前可以用的田數（會隨「擴建農地」變多）；sprinkler()：是否裝了自動灑水器 */
export function createFarm({ save, reg, bus, inv, progress, now = Date.now, rng = Math.random, plots = 6, maxPlots = 18, size = () => plots, sprinkler = () => false, wetMs = 600000, dryRate = 0.5, fertRate = 0.3, tonicRate = 0.5 }) {
  const cur = () => Math.max(0, Math.min(maxPlots, Math.floor(size())));
  function ensure() {
    const arr = save.data.farm.plots;
    while (arr.length < cur()) arr.push(null);
    if (arr.length > maxPlots) arr.length = maxPlots;      // 不會因為田數變少就刪掉已種的作物，只是暫時用不到
    return arr;
  }
  const valid = (i) => Number.isInteger(i) && i >= 0 && i < cur();

  /* 結算並回傳該格（空格或作物資料已被移除則為 null） */
  function settled(i) {
    const arr = ensure();
    const plot = arr[i];
    if (!plot) return null;
    const crop = reg.cropById.get(plot.crop);
    if (!crop) { arr[i] = null; save.commit(); return null; }   // 作物被從資料刪除：清空這格
    arr[i] = settlePlot(plot, crop.growMs, now(), dryRate, sprinkler());
    return { plot: arr[i], crop };
  }

  const api = {
    get size() { return cur(); },
    maxSize: maxPlots,

    status(i) {
      if (!valid(i)) return { state: 'invalid' };
      const s = settled(i);
      if (!s) return { state: 'empty' };
      const pct = s.plot.progress / s.crop.growMs;
      return {
        state: pct >= 1 ? 'ripe' : 'growing',
        crop: s.crop,
        pct: Math.min(1, pct),
        stage: Math.min(3, Math.floor(pct * 3)),       // 0 發芽、1 成長、2 快熟、3 成熟
        wet: sprinkler() || s.plot.wetUntil > now(),
        fertilized: s.plot.fert === true,
      };
    },

    ripeCount() {
      let n = 0;
      for (let i = 0; i < cur(); i++) if (api.status(i).state === 'ripe') n++;
      return n;
    },

    /* 可種的種子清單（背包裡有、且對應得到作物） */
    plantable() {
      return inv.list('seed').filter(({ item }) => reg.cropBySeed.has(item.id)).map(({ item, count }) => ({ seed: item, count, crop: reg.cropBySeed.get(item.id) }));
    },

    plant(i, seedId) {
      if (!valid(i)) return { ok: false, reason: 'invalid' };
      if (settled(i)) return { ok: false, reason: 'occupied' };
      const crop = reg.cropBySeed.get(seedId);
      if (!crop) return { ok: false, reason: 'not-seed' };
      if (!inv.remove(seedId, 1)) return { ok: false, reason: 'no-seed' };
      ensure()[i] = { crop: crop.id, progress: 0, last: now(), wetUntil: 0, fert: false };
      save.commit();
      bus.emit('farm:changed', { index: i, action: 'plant', crop });
      return { ok: true, crop };
    },

    water(i) {
      if (!valid(i)) return { ok: false, reason: 'invalid' };
      const s = settled(i);
      if (!s) return { ok: false, reason: 'empty' };
      if (s.plot.progress >= s.crop.growMs) return { ok: false, reason: 'ripe' };
      s.plot.wetUntil = now() + wetMs;
      save.commit();
      bus.emit('farm:changed', { index: i, action: 'water', crop: s.crop });
      return { ok: true };
    },

    /* 施肥：每株限一次，直接增加一截生長進度 */
    fertilize(i) {
      if (!valid(i)) return { ok: false, reason: 'invalid' };
      const s = settled(i);
      if (!s) return { ok: false, reason: 'empty' };
      if (s.plot.progress >= s.crop.growMs) return { ok: false, reason: 'ripe' };
      if (s.plot.fert) return { ok: false, reason: 'done' };
      if (!inv.remove('fertilizer', 1)) return { ok: false, reason: 'no-item' };
      s.plot.progress = Math.min(s.crop.growMs, s.plot.progress + s.crop.growMs * fertRate);
      s.plot.fert = true;
      save.commit();
      bus.emit('farm:changed', { index: i, action: 'fertilize', crop: s.crop });
      return { ok: true };
    },

    /* 生長藥水：直接增加一截生長進度，可以重複使用 */
    tonic(i) {
      if (!valid(i)) return { ok: false, reason: 'invalid' };
      const s = settled(i);
      if (!s) return { ok: false, reason: 'empty' };
      if (s.plot.progress >= s.crop.growMs) return { ok: false, reason: 'ripe' };
      if (!inv.remove('growth_tonic', 1)) return { ok: false, reason: 'no-item' };
      s.plot.progress = Math.min(s.crop.growMs, s.plot.progress + s.crop.growMs * tonicRate);
      save.commit();
      bus.emit('farm:changed', { index: i, action: 'tonic', crop: s.crop });
      return { ok: true };
    },

    harvest(i) {
      if (!valid(i)) return { ok: false, reason: 'invalid' };
      const s = settled(i);
      if (!s) return { ok: false, reason: 'empty' };
      if (s.plot.progress < s.crop.growMs) return { ok: false, reason: 'not-ripe' };
      const qty = randInt(rng, s.crop.yield[0], s.crop.yield[1]);
      ensure()[i] = null;
      save.commit();
      const got = inv.add(s.crop.produce, qty);
      progress.inc('harvests');
      bus.emit('farm:changed', { index: i, action: 'harvest', crop: s.crop, qty: got });
      return { ok: true, crop: s.crop, qty: got };
    },
  };
  return api;
}
