/* ============================================================
   角色卡資料 —— 平常只需要改這個檔
   新增角色：複製一段 { ... }, 貼在陣列裡，改內容即可。

   欄位：
     id       必填，不可重複，只用英數字（例：c001）。上線後不要改，存檔靠它認卡
     name     必填，角色名
     url      必填，Caveduck 角色頁連結（https:// 開頭）
     tagline  卡片背面的一句話簡介
     tags     標籤陣列
     rarity   N / R / SR / SSR（決定卡背微光顏色）
     image    卡面 Q 圖路徑（例：assets/cards/c001.webp），沒有就先不填
============================================================ */
export const characters = [
  { id: 'c001', name: '範例角色一', url: 'https://caveduck.io/', tagline: '這裡寫一句勾人的簡介。', tags: ['範例'], rarity: 'SSR' },
  { id: 'c002', name: '範例角色二', url: 'https://caveduck.io/', tagline: '把連結換成角色頁網址。', tags: ['範例'], rarity: 'SR' },
  { id: 'c003', name: '範例角色三', url: 'https://caveduck.io/', tagline: '圖片之後再補也可以。', tags: ['範例'], rarity: 'R' },

  /* ↓↓↓ 測試用假卡（讓卡環有 24 張可以轉）。放入真實角色後，把下面這一行整行刪掉 ↓↓↓ */
  ...Array.from({ length: 21 }, (_, i) => ({ id: `demo${String(i + 4).padStart(2, '0')}`, name: `測試卡 ${i + 4}`, url: 'https://caveduck.io/', tagline: '測試用假卡。', tags: ['測試'], rarity: ['N', 'R', 'SR'][i % 3] })),
];
