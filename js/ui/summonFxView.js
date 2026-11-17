/* 召喚特效：依時間軸（systems/summonFx.js）一個階段一個階段播放。
   這裡只負責「現在是哪個階段、進度多少」，並把它們寫到畫面元素上：
     data-step="charge|beam|flash|flip|reveal"   目前階段
     --p   該階段的進度 0~1        --c   稀有度主色
   目前的視覺是 CSS 佔位（法陣、光柱、翻牌）。正式美術只要針對 .sfx[data-step=...] 寫樣式，
   或在 data/assets.js 填 fx.summon.<階段>，不用改這個檔。
   點擊或按鍵可以跳過；使用者設定「減少動態效果」時直接略過。 */
import { h } from './dom.js';
import { buildTimeline, stepAt } from '../systems/summonFx.js';
import { cssUrl } from './icon.js';

export function summonFxView(game, { id, first = true } = {}) {
  const c = game.reg.characterById.get(id);
  if (!c || !game.reg.summonFx) return Promise.resolve();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const tl = buildTimeline(game.reg.summonFx, c.rarity || 'N', { first });
  if (!tl.total) return Promise.resolve();

  const art = h('div', { class: 'sfx-art' });
  const particles = Array.from({ length: tl.style.particles }, (_, i) => h('i', { style: `--a:${(i * 360 / Math.max(1, tl.style.particles)).toFixed(1)}deg;--d:${0.6 + (i * 37 % 40) / 100}` }));
  const el = h('div', { class: `sfx r-${tl.rarity}`, role: 'img', 'aria-label': '召喚中' },
    h('div', { class: 'sfx-circle' }), h('div', { class: 'sfx-beam' }), h('div', { class: 'sfx-flash' }),
    h('div', { class: 'sfx-card' }, h('div', { class: 'sfx-card-back' }), h('div', { class: 'sfx-card-front', text: c.name })),
    h('div', { class: 'sfx-particles' }, particles), art, h('div', { class: 'sfx-skip', text: '點一下跳過' }));
  el.style.setProperty('--c', tl.style.color);
  const backUrl = game.assets?.url(`card.back.${game.shop?.back?.() || 'default'}`);   // 用目前選的卡背
  if (backUrl) el.style.setProperty('--back-img', cssUrl(backUrl));
  el.style.setProperty('--shake', `${tl.style.shake}px`);

  let raf = null, start = 0, lastStep = '', done = false;
  const view = game.ui.overlay({ el, onClose: () => { done = true; if (raf !== null) cancelAnimationFrame(raf); }, onKey: (e) => { if (!e.repeat) view.close(); return true; } });
  el.addEventListener('click', () => view.close());

  function frame(now) {
    if (done) return;
    if (!start) start = now;
    const s = stepAt(tl, now - start);
    if (!s) { view.close(); return; }
    if (s.id !== lastStep) {
      lastStep = s.id; el.dataset.step = s.id;
      const url = game.assets?.url(`fx.summon.${s.id}`);          // 這個階段有配圖就顯示
      art.style.backgroundImage = url ? `url("${url}")` : '';
      game.bus.emit('summonfx:step', { id: c.id, step: s.id });
    }
    el.style.setProperty('--p', s.p.toFixed(3));
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return view.closed;
}
