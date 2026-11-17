/* 商店：買道具、賣收集品、買永久升級。規則在 systems/market.js 與 systems/upgrades.js。 */
import { h } from './dom.js';
import { itemIcon } from './icon.js';

const REASON = { coins: '金幣不夠', full: '這個東西已經帶滿了', none: '背包裡沒有這個東西', max: '已經是最高等級了' };

export function marketView(game) {
  const { market, wallet, inv, ui, upgrades, farm } = game;
  let tab = 'buy';
  const coins = h('div', { class: 'coins' });
  const box = h('div', { class: 'shop-list' });
  const tabs = { buy: h('button', { class: 'btn tab', type: 'button', text: '買東西', onclick: () => { tab = 'buy'; render(); } }),
    sell: h('button', { class: 'btn tab', type: 'button', text: '賣東西', onclick: () => { tab = 'sell'; render(); } }),
    upgrade: h('button', { class: 'btn tab', type: 'button', text: '升級', onclick: () => { tab = 'upgrade'; render(); } }) };

  const act = (r) => { if (!r.ok) ui.toast(REASON[r.reason] || '現在沒辦法交易'); render(); };
  const btn = (text, fn, disabled) => h('button', { class: 'btn', type: 'button', text, disabled, onclick: fn });
  const row = (item, right, buttons) => h('div', { class: 'shop-row' }, itemIcon(game, item.id),
    h('div', { class: 'shop-info' }, h('b', { text: item.name }), h('span', { class: 'note', text: item.desc || '' })),
    h('div', { class: 'shop-price', text: right }), h('div', { class: 'row' }, buttons));

  function render() {
    coins.textContent = `🪙 ${wallet.coins()}`;
    for (const k of Object.keys(tabs)) tabs[k].classList.toggle('on', tab === k);
    if (tab === 'buy') {
      box.replaceChildren(...market.goods().map(({ item, price }) => row(item, `${price} 金幣　持有 ${inv.count(item.id)}`, [
        btn('買 1', () => act(market.buy(item.id, 1)), !wallet.can(price)),
        btn('買 5', () => act(market.buy(item.id, 5)), !wallet.can(price * 5)),
      ])));
    } else if (tab === 'upgrade') {
      box.replaceChildren(h('p', { class: 'note', text: `目前有 ${farm.size} / ${farm.maxSize} 塊田。升級買了就一直有效。` }),
        ...upgrades.list().map(({ upgrade: u, level, max, price }) => h('div', { class: 'shop-row' },
          h('div', { class: 'shop-info' }, h('b', { text: `${u.name}${max > 1 ? `（${level} / ${max} 級）` : level ? '（已安裝）' : ''}` }), h('span', { class: 'note', text: u.desc || '' })),
          h('div', { class: 'shop-price', text: price === null ? '已滿級' : `${price} 金幣` }),
          h('div', { class: 'row' }, btn(price === null ? '完成' : '購買', () => { const r = upgrades.buy(u.id); if (r.ok) ui.toast(`${u.name}完成`); act(r); }, price === null || !wallet.can(price))))));
    } else {
      const list = market.sellable();
      box.replaceChildren(...(list.length ? list.map(({ item, count, price }) => row(item, `每個 ${price} 金幣　持有 ${count}`, [
        btn('賣 1', () => act(market.sell(item.id, 1))),
        btn(`全賣（${Math.min(count, 99)}）`, () => act(market.sell(item.id, Math.min(count, 99)))),
      ])) : [h('p', { text: '背包裡沒有可以賣的東西。作物、魚、蟲和寶物都可以賣。' })]));
    }
  }
  render();
  const body = h('div', { class: 'shop' }, h('div', { class: 'row shop-head' }, tabs.buy, tabs.sell, tabs.upgrade, coins), box);
  return ui.panel({ title: '商店', body, cls: 'wide', scene: 'market' }).closed;
}
