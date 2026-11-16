/* 成就資料。cond 三選一：
     { stat: '統計項', gte: 數字 }   統計值達標（cardsSummoned / harvests / catches / digs / bugsCaught / offerings / treeShakes）
     { flag: '旗標' }                某件事發生過（fishFound / lanternsAll）
     { seenAll: ['物品id', ...] }    這些物品全部拿到過
   reward（可省略）：{ 物品id: 數量 } */
export const achievements = [
  { id: 'first_summon', name: '初次召喚', desc: '翻開第一張卡。', cond: { stat: 'cardsSummoned', gte: 1 } },
  { id: 'summon_10', name: '熟客', desc: '召喚 10 張不同的卡。', cond: { stat: 'cardsSummoned', gte: 10 }, reward: { seed_star: 1 } },
  { id: 'first_harvest', name: '第一次收成', desc: '親手收成作物。', cond: { stat: 'harvests', gte: 1 } },
  { id: 'first_catch', name: '上鉤了', desc: '釣到第一條魚。', cond: { stat: 'catches', gte: 1 } },
  { id: 'all_leaves', name: '四色落葉', desc: '集滿許願樹的四種落葉。', cond: { seenAll: ['leaf_pink', 'leaf_purple', 'leaf_teal', 'leaf_gold'] }, reward: { feed: 3 } },
  { id: 'lanterns', name: '點燈人', desc: '點亮所有石燈。', cond: { flag: 'lanternsAll' }, reward: { seed_star: 1 } },
  { id: 'first_bug', name: '夜行者', desc: '抓到第一隻蟲。', cond: { stat: 'bugsCaught', gte: 1 } },
  { id: 'all_bugs', name: '螢光圖鑑', desc: '兩種夜晚的蟲都抓到過。', cond: { seenAll: ['bug_firefly', 'bug_glow'] } },
  { id: 'first_offering', name: '供奉', desc: '在祭壇換到第一樣東西。', cond: { stat: 'offerings', gte: 1 } },
  { id: 'all_fish', name: '溪流通', desc: '三種魚都釣到過。', cond: { seenAll: ['fish_small', 'fish_koi', 'fish_odd'] } },
  { id: 'fish_found', name: '？？？', desc: '找到某個不在地圖上的地方。', cond: { flag: 'fishFound' } },
];
