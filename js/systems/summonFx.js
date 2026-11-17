/* 召喚特效的時間軸（純邏輯）。設定在 data/summonFx.js；畫面在 ui/summonFxView.js。
   美術之後只要替每個階段配上動畫或圖檔，不用動這裡。 */
export function buildTimeline(cfg, rarity, { first = true } = {}) {
  const style = cfg.rarity?.[rarity] || cfg.rarity?.N || {};
  const scale = (Number.isFinite(style.scale) && style.scale > 0 ? style.scale : 1) * (first ? 1 : (cfg.repeatScale > 0 ? cfg.repeatScale : 1));
  const ids = [];
  for (const id of cfg.steps || []) {
    ids.push(id);
    for (const extra of style.extra || []) if (extra.after === id) ids.push(extra.id);
  }
  const msOf = (id) => {
    const extra = (style.extra || []).find((e) => e.id === id);
    const base = extra ? extra.ms : cfg.base?.[id];
    return Number.isFinite(base) && base > 0 ? Math.round(base * scale) : 0;
  };
  let t = 0;
  const steps = [];
  for (const id of ids) {
    const ms = msOf(id);
    if (ms <= 0) continue;
    steps.push({ id, start: t, end: t + ms });
    t += ms;
  }
  return {
    steps, total: t, rarity: cfg.rarity?.[rarity] ? rarity : 'N', first,
    style: { color: style.color || '#ffffff', particles: Math.max(0, Math.floor(style.particles || 0)), shake: Math.max(0, style.shake || 0) },
  };
}

/* 時間 t（毫秒）正在哪個階段：{id, index, p}，p 是該階段的進度 0~1。播完回傳 null */
export function stepAt(timeline, t) {
  if (!(t >= 0) || t >= timeline.total) return null;
  for (let i = 0; i < timeline.steps.length; i++) {
    const s = timeline.steps[i];
    if (t < s.end) return { id: s.id, index: i, p: (t - s.start) / (s.end - s.start) };
  }
  return null;
}
