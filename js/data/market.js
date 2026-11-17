/* 商店賣的東西。item 要對應 items.js 的 id；price 是買價（金幣）。
   買價必須高於該物品的賣價（items.js 的 sell），否則可以無限套利，開機檢查會擋下。 */
export const goods = [
  { item: 'seed_turnip', price: 10 },
  { item: 'seed_star', price: 120 },
  { item: 'fertilizer', price: 40 },
  { item: 'feed', price: 15 },
  { item: 'bait', price: 20 },
];
