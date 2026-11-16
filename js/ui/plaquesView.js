/* 許願牌：每個網站一塊牌，點一下翻面看說明與連結。下方是訪客自己掛的願望（只存在自己的瀏覽器）。 */
import { h, extLink } from './dom.js';
import { safeUrl } from '../core/util.js';

const MAX_WISHES = 10, MAX_LEN = 30;

export function plaquesView(game) {
  const { reg, save, ui } = game;
  const list = h('div', { class: 'plaques' });
  for (const s of reg.sites) {
    const url = safeUrl(s.url);
    const detail = h('div', { class: 'plaque-back', hidden: true }, h('p', { text: s.desc || '' }), url ? extLink(url, '前往 ↗', 'btn link') : null);
    const head = h('button', { class: `btn plaque t-${s.type || 'x'}`, type: 'button', text: s.name, 'aria-expanded': 'false',
      onclick: () => { detail.hidden = !detail.hidden; head.setAttribute('aria-expanded', String(!detail.hidden)); } });
    list.append(h('div', { class: 'plaque-wrap' }, head, detail));
  }
  if (!reg.sites.length) list.append(h('p', { text: '樹上還沒有掛任何牌子。' }));

  const wishList = h('div', { class: 'wishes' });
  const input = h('input', { type: 'text', maxLength: MAX_LEN, placeholder: '寫下你的願望…', 'aria-label': '願望' });
  function renderWishes() {
    wishList.replaceChildren(...save.data.wishes.map((w, i) => h('div', { class: 'wish' }, h('span', { text: w }),
      h('button', { class: 'btn', type: 'button', text: '取下', onclick: () => { save.data.wishes.splice(i, 1); save.commit(); renderWishes(); } }))));
  }
  function add() {
    const text = input.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    if (save.data.wishes.length >= MAX_WISHES) { ui.toast('樹枝掛滿了，先取下一塊吧'); return; }
    save.data.wishes.push(text); save.commit();
    input.value = ''; renderWishes();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); } });
  renderWishes();

  const body = h('div', null, list, h('h4', { text: '我的許願牌' }), wishList,
    h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'button', text: '掛上去', onclick: add })));
  return ui.panel({ title: '許願樹', body }).closed;
}
