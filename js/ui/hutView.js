/* ============================================================
   成就小屋：走進去是一間有兩座書架的木屋。
   ・左邊書架放成就：還沒達成的是暗暗的剪影，達成之後獎盃亮起來
   ・右邊書架放收藏品（寶物、魚、蟲、作物）：拿到過的才會亮
   ・滑鼠移過去會發光並顯示名字；點一下，房間中央浮出一張紙條寫著說明
   ・桌上的筆記本是各項紀錄
   位置設定在 data/rooms.js 的 HUT。
============================================================ */
import { h } from './dom.js';
import { openRoom } from './room.js';
import { HUT } from '../data/rooms.js';

const date = (t) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

/* 純函式：把 n 個東西排進書架的層板，回傳每個東西的位置 {x, y, w, h}（底部對齊層板） */
export function shelfSlots(c, shelfTops, n, { w, h: hh, perShelf }) {
  const inner = (c.x1 - 8) - (c.x0 + 8);
  const step = inner / perShelf;
  const out = [];
  for (let i = 0; i < n; i++) {
    const shelf = Math.floor(i / perShelf);
    if (shelf >= shelfTops.length) break;
    const col = i % perShelf;
    out.push({ x: Math.round(c.x0 + 8 + col * step + (step - w) / 2), y: shelfTops[shelf] - hh, w, h: hh });
  }
  return out;
}

export function hutView(game) {
  const { reg, inv, cards, ach, progress, assets } = game;
  const room = openRoom(game, { title: '成就小屋', scene: 'hut-room' });
  let note = null;

  function showNote(lines, x) {
    note?.remove();
    note = h('div', { class: 'room-note' }, lines.map((l, i) => h(i ? 'p' : 'b', { text: l })));
    note.addEventListener('click', (e) => { e.stopPropagation(); note.remove(); note = null; });
    room.add(note, Math.max(10, Math.min(300, x - 80)), 96, 170);
  }

  room.show({
    bg: HUT.bg, back: null,
    build: (stage) => {
      stage.addEventListener('click', () => { note?.remove(); note = null; });
      const [left, right] = HUT.cases;
      for (const c of HUT.cases) room.add(h('div', { class: 'case-title', text: c.title }), c.x0 + 70, 14, 48, 11);

      // 左邊：成就
      const list = ach.list();
      const aSlots = shelfSlots(left, HUT.shelfTops, list.length, { w: 22, h: 26, perShelf: 6 });
      list.forEach(({ achievement: a, unlockedAt }, i) => {
        const s = aSlots[i]; if (!s) return;
        const done = unlockedAt !== null;
        room.hotspot({
          ...s, sprite: `trophy.${HUT.trophyKinds[i % HUT.trophyKinds.length]}`, label: done ? a.name : '？？？',
          cls: done ? 'shelf-item lit' : 'shelf-item dark',
          onClick: () => showNote(done ? [a.name, a.desc || '', `達成：${date(unlockedAt)}`] : ['還沒達成', a.desc || '繼續探索看看。'], s.x),
        });
      });
      room.add(h('div', { class: 'shelf-count', text: `${list.filter((e) => e.unlockedAt !== null).length} / ${list.length}` }), left.x0 + 8, left.y1 - 14, left.x1 - left.x0 - 16);

      // 右邊：收藏品
      const items = reg.items.filter((it) => HUT.collectCats.includes(it.cat));
      const iSlots = shelfSlots(right, HUT.shelfTops, items.length, { w: 24, h: 24, perShelf: 7 });
      items.forEach((it, i) => {
        const s = iSlots[i]; if (!s) return;
        const seen = inv.seen(it.id);
        room.hotspot({
          ...s, sprite: `item.${it.id}`, label: seen ? it.name : '？？？', cls: seen ? 'shelf-item lit' : 'shelf-item dark',
          onClick: () => showNote(seen ? [it.name, it.desc || '', `背包裡有 ${inv.count(it.id)} 個`] : ['還沒拿到過', '到處走走，也許會遇到。'], s.x),
        });
      });
      room.add(h('div', { class: 'shelf-count', text: `${items.filter((it) => inv.seen(it.id)).length} / ${items.length}` }), right.x0 + 8, right.y1 - 14, right.x1 - right.x0 - 16);

      // 桌上的筆記本：紀錄
      room.hotspot({ ...HUT.notebook, label: '紀錄', cls: 'notebook', onClick: () => showNote(['紀錄',
        `召喚過的卡：${cards.ownedCount()} / ${cards.total()}`, `收成：${progress.stat('harvests')} 次`, `釣到的魚：${progress.stat('catches')} 條`,
        `抓到的蟲：${progress.stat('bugsCaught')} 隻`, `挖掘：${progress.stat('digs')} 次`, `賭場：玩了 ${progress.stat('casinoPlays')} 次、贏了 ${progress.stat('casinoWins')} 次`], 240) });
      if (!assets?.url(HUT.bg)) stage.classList.add('no-bg');
    },
  });
  return room.closed;
}
