/* ============================================================
   召喚特效設定
   steps：  階段順序。charge 蓄力 → beam 光柱 → flip 翻面 → reveal 亮相
   base：   每個階段的基本長度（毫秒）
   rarity： 各稀有度的差異
              scale     整體時間倍率（越稀有演出越長）
              color     主色
              particles 粒子數量
              shake     畫面震動幅度（像素）
              extra     額外插入的階段：{ id, ms, after: '插在哪個階段後面' }
   repeatScale：召喚已經看過的卡時，時間再乘上這個倍率（縮短）
   每個階段可以在 data/assets.js 配一張圖：fx.summon.<階段 id>
============================================================ */
export const summonFx = {
  steps: ['charge', 'beam', 'flip', 'reveal'],
  base: { charge: 520, beam: 380, flip: 420, reveal: 480 },
  repeatScale: 0.5,
  rarity: {
    N: { scale: 0.8, color: '#8a93a8', particles: 8, shake: 0 },
    R: { scale: 1, color: '#5aa9e6', particles: 14, shake: 0 },
    SR: { scale: 1.2, color: '#b388ff', particles: 24, shake: 3 },
    SSR: { scale: 1.5, color: '#f6c453', particles: 40, shake: 6, extra: [{ id: 'flash', ms: 300, after: 'beam' }] },
  },
};
