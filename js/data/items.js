/* ============================================================
   物品資料
   欄位：id、name、cat（seed 種子 / crop 作物 / fish 漁獲 / bug 昆蟲 / treasure 寶物 / misc 其他）、desc
        sell（可省略）：在商店賣掉一個可以拿到多少金幣；沒寫就是不能賣
============================================================ */
export const items = [
  { id: 'feed', name: '魚飼料', cat: 'misc', desc: '聞起來不怎麼樣。也許哪裡的水邊有誰會喜歡。' },

  { id: 'fertilizer', name: '肥料', cat: 'misc', desc: '對成長中的作物用，直接長大一截。每株限用一次。' },
  { id: 'growth_tonic', name: '生長藥水', cat: 'misc', desc: '對成長中的作物用，直接長大一半。可以重複使用。' },
  { id: 'bait', name: '魚餌', cat: 'misc', desc: '釣魚時自動使用，魚會比較快上鉤。' },

  { id: 'seed_turnip', name: '蕪菁種子', cat: 'seed', desc: '長得快，適合新手。' },
  { id: 'seed_star', name: '星星果種子', cat: 'seed', desc: '稀有，要等比較久。' },
  { id: 'crop_turnip', name: '蕪菁', cat: 'crop', desc: '圓滾滾。', sell: 12 },
  { id: 'crop_star', name: '星星果', cat: 'crop', desc: '晚上會微微發光。', sell: 150 },

  { id: 'fish_small', name: '小溪魚', cat: 'fish', desc: '溪裡最常見的魚。', sell: 8 },
  { id: 'fish_koi', name: '花鯉', cat: 'fish', desc: '白天比較活躍。', sell: 25 },
  { id: 'fish_odd', name: '顏色不太對的魚', cat: 'fish', desc: '牠用一種「你認真？」的眼神看你。夜裡才釣得到。', sell: 60 },

  { id: 'bug_firefly', name: '螢火蟲', cat: 'bug', desc: '黃昏之後才出現。要慢慢靠近。', sell: 15 },
  { id: 'bug_glow', name: '發光甲蟲', cat: 'bug', desc: '深夜才看得到，很稀有。', sell: 45 },

  { id: 'leaf_pink', name: '櫻粉落葉', cat: 'treasure', desc: '許願樹的葉子。', sell: 3 },
  { id: 'leaf_purple', name: '紫藤落葉', cat: 'treasure', desc: '許願樹的葉子。', sell: 3 },
  { id: 'leaf_teal', name: '青綠落葉', cat: 'treasure', desc: '許願樹的葉子。', sell: 3 },
  { id: 'leaf_gold', name: '金黃落葉', cat: 'treasure', desc: '許願樹的葉子，比較少見。', sell: 12 },
  { id: 'coin_old', name: '古幣', cat: 'treasure', desc: '看不懂上面的字。', sell: 30 },
  { id: 'shell', name: '貝殼', cat: 'treasure', desc: '為什麼溪邊會有貝殼？', sell: 10 },
];
