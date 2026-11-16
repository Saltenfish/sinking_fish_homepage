/* 掉落表：weight 越大越常出現；item: null 代表落空；phases 限定時段（dawn 清晨 / day 白天 / dusk 黃昏 / night 夜晚），不填就是全天 */

/* 釣魚（每一列需要 id） */
export const fish = [
  { id: 'f_small', item: 'fish_small', weight: 60 },
  { id: 'f_koi', item: 'fish_koi', weight: 25, phases: ['day', 'dusk'] },
  { id: 'f_odd', item: 'fish_odd', weight: 6, phases: ['night', 'dawn'] },
  { id: 'f_coin', item: 'coin_old', weight: 5 },
];

export const loot = {
  /* 搖許願樹 */
  tree: [
    { item: 'leaf_pink', weight: 30 },
    { item: 'leaf_purple', weight: 30 },
    { item: 'leaf_teal', weight: 30 },
    { item: 'leaf_gold', weight: 8 },
    { item: 'feed', weight: 25 },
  ],
  /* 草叢 */
  bush: [
    { item: null, weight: 50 },
    { item: 'seed_turnip', weight: 35 },
    { item: 'seed_star', weight: 5 },
    { item: 'feed', weight: 10 },
  ],
  /* 挖掘點 */
  dig: [
    { item: 'coin_old', weight: 30 },
    { item: 'shell', weight: 30 },
    { item: 'seed_star', weight: 15 },
    { item: 'seed_turnip', weight: 25 },
  ],
};
