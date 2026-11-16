/* 快速目錄：不想逛地圖的人可以直接在這裡找到所有連結。 */
import { h, extLink } from './dom.js';
import { safeUrl } from '../core/util.js';

export function listView(game) {
  const { reg, cards, ui } = game;
  const row = (name, url, note) => { const u = safeUrl(url); return h('li', null, u ? extLink(u, name) : name, note ? h('span', { class: 'note', text: `　${note}` }) : null); };
  const body = h('div', null,
    h('h4', { text: `角色（${reg.characters.length}）` }),
    h('ul', { class: 'list' }, reg.characters.map((c) => row(c.name, c.url, [cards.has(c.id) ? '已召喚' : '', c.tagline || ''].filter(Boolean).join('・')))),
    h('h4', { text: `網站（${reg.sites.length}）` }),
    h('ul', { class: 'list' }, reg.sites.map((s) => row(s.name, s.url, s.desc))));
  return ui.panel({ title: '快速目錄', body, cls: 'wide' }).closed;
}
