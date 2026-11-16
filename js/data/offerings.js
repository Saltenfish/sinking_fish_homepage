/* 祭壇供奉：用收集品換外觀。
   欄位：id、name、desc、cost（{物品id: 數量}）、cardBack（換到的卡背花色代號，對應 css 的 .back-代號） */
export const offerings = [
  { id: 'back_sakura', name: '卡背・櫻', desc: '粉色系的卡背。', cost: { leaf_pink: 3, crop_turnip: 2 }, cardBack: 'sakura' },
  { id: 'back_tide', name: '卡背・潮', desc: '水色系的卡背。', cost: { fish_koi: 2, shell: 1 }, cardBack: 'tide' },
  { id: 'back_star', name: '卡背・星夜', desc: '夜空與螢光。', cost: { crop_star: 1, bug_firefly: 2 }, cardBack: 'star' },
];
