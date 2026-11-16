/* ============================================================
   物品資料
   欄位：id、name、cat（seed 種子 / crop 作物 / fish 漁獲 / bug 昆蟲 / treasure 寶物 / misc 其他）、desc
============================================================ */
export const items = [
  { id: 'feed', name: '魚飼料', cat: 'misc', desc: '聞起來不怎麼樣。也許哪裡的水邊有誰會喜歡。' },

  { id: 'seed_turnip', name: '蕪菁種子', cat: 'seed', desc: '長得快，適合新手。' },
  { id: 'seed_star', name: '星星果種子', cat: 'seed', desc: '稀有，要等比較久。' },
  { id: 'crop_turnip', name: '蕪菁', cat: 'crop', desc: '圓滾滾。' },
  { id: 'crop_star', name: '星星果', cat: 'crop', desc: '晚上會微微發光。' },

  { id: 'fish_small', name: '小溪魚', cat: 'fish', desc: '溪裡最常見的魚。' },
  { id: 'fish_koi', name: '花鯉', cat: 'fish', desc: '白天比較活躍。' },
  { id: 'fish_odd', name: '顏色不太對的魚', cat: 'fish', desc: '牠用一種「你認真？」的眼神看你。夜裡才釣得到。' },

  { id: 'leaf_pink', name: '櫻粉落葉', cat: 'treasure', desc: '許願樹的葉子。' },
  { id: 'leaf_purple', name: '紫藤落葉', cat: 'treasure', desc: '許願樹的葉子。' },
  { id: 'leaf_teal', name: '青綠落葉', cat: 'treasure', desc: '許願樹的葉子。' },
  { id: 'leaf_gold', name: '金黃落葉', cat: 'treasure', desc: '許願樹的葉子，比較少見。' },
  { id: 'coin_old', name: '古幣', cat: 'treasure', desc: '看不懂上面的字。' },
  { id: 'shell', name: '貝殼', cat: 'treasure', desc: '為什麼溪邊會有貝殼？' },
];
