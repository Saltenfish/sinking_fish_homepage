/* 供奉：用收集品換卡背花色，並選擇要用哪一種卡背。 */
import { h } from './dom.js';

export function offeringsView(game) {
  const { reg, inv, shop, ui } = game;
  const box = h('div');
  function render() {
    const rows = shop.list().map(({ offering: o, owned, affordable }) => h('div', { class: 'item' },
      h('b', { text: o.name }), h('span', { text: o.desc || '' }),
      h('span', { class: 'note', text: Object.keys(o.cost).map((k) => `${reg.itemById.get(k).name} ${inv.count(k)}/${o.cost[k]}`).join('　') }),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', disabled: owned || !affordable, text: owned ? '已擁有' : affordable ? '供奉' : '材料不足',
        onclick: () => { const r = shop.buy(o.id); if (r.ok) ui.toast(`換到了：${o.name}`); render(); } }))));
    const cur = shop.back();
    const backs = shop.backs().map((b) => h('button', { class: `btn${b.id === cur ? ' on' : ''}`, type: 'button', text: b.name, 'aria-pressed': String(b.id === cur), onclick: () => { shop.setBack(b.id); render(); } }));
    box.replaceChildren(h('p', { text: '把收集到的東西獻給祭壇，換取不同花色的卡背。' }), ...rows, h('h4', { text: '使用中的卡背' }), h('div', { class: 'row' }, backs));
  }
  render();
  return ui.panel({ title: '供奉石', body: box, cls: 'wide' }).closed;
}
