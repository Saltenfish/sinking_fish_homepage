/* 背包：卡冊／物品／圖鑑／成就 四個分頁。 */
import { h } from './dom.js';
import { itemIcon } from './icon.js';

const CAT_NAMES = { seed: '種子', crop: '作物', fish: '漁獲', bug: '昆蟲', treasure: '寶物', misc: '其他' };

export function bagView(game) {
  const { reg, inv, cards, ach, ui, wallet } = game;
  const content = h('div', { class: 'bag-content' });
  const tabs = {
    卡冊() {
      const owned = reg.characters.filter((c) => cards.has(c.id));
      return h('div', null, h('p', { text: `已召喚 ${owned.length} / ${reg.characters.length}` }),
        h('div', { class: 'grid' }, reg.characters.map((c) => (cards.has(c.id)
          ? h('button', { class: `btn cell r-${c.rarity || 'N'}`, type: 'button', text: c.name, onclick: () => ui.show('card', { id: c.id }) })
          : h('div', { class: 'cell unknown', text: '？' })))));
    },
    物品() {
      const all = inv.list();
      const purse = h('p', { class: 'coins', text: `🪙 ${wallet.coins()} 金幣` });
      if (!all.length) return h('div', null, purse, h('p', { text: '包包是空的。到處走走看看吧。' }));
      return h('div', null, purse, Object.keys(CAT_NAMES).map((cat) => {
        const rows = all.filter((e) => e.item.cat === cat);
        return rows.length ? h('div', null, h('h4', { text: CAT_NAMES[cat] }),
          rows.map((e) => h('div', { class: 'item' }, h('b', null, itemIcon(game, e.item.id), `${e.item.name} ×${e.count}`), h('span', { text: e.item.desc || '' })))) : null;
      }));
    },
    圖鑑() {
      const seen = reg.items.filter((it) => inv.seen(it.id)).length;
      return h('div', null, h('p', { text: `已發現 ${seen} / ${reg.items.length}` }),
        h('div', { class: 'grid' }, reg.items.map((it) => h('div', { class: `cell${inv.seen(it.id) ? '' : ' unknown'}`, text: inv.seen(it.id) ? it.name : '？' }))));
    },
    成就() {
      return h('div', null, ach.list().map(({ achievement: a, unlockedAt }) => h('div', { class: `item${unlockedAt === null ? ' locked' : ''}` },
        h('b', { text: `${unlockedAt === null ? '□' : '■'} ${a.name}` }), h('span', { text: a.desc || '' }))));
    },
  };
  const names = Object.keys(tabs);
  const buttons = names.map((name) => h('button', { class: 'btn tab', type: 'button', text: name, onclick: () => select(name) }));
  function select(name) {
    buttons.forEach((b, i) => b.classList.toggle('on', names[i] === name));
    content.replaceChildren(tabs[name]());
  }
  select(names[0]);
  return ui.panel({
    onKey: (e) => { if (e.code === 'KeyE' || e.code === 'KeyB') { if (!e.repeat) ui.closeTop(); return true; } return false; },   // 再按一次 E 收起背包
    title: '背包', body: h('div', null, h('div', { class: 'row' }, buttons), content), cls: 'wide', scene: 'bag' }).closed;
}
