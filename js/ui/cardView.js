/* 單張卡片：正面（圖、名字、稀有度）↔ 背面（簡介、標籤、連結）。卡面圖在這裡才載入。 */
import { h, extLink } from './dom.js';
import { safeUrl } from '../core/util.js';

export function cardView(game, { id } = {}) {
  const c = game.reg.characterById.get(id);
  if (!c) return Promise.resolve();
  let flipped = false;

  const art = h('div', { class: 'card-art' }, h('span', { text: c.name.slice(0, 1) }));
  if (c.image) {
    const img = h('img', { alt: c.name, decoding: 'async' });
    img.addEventListener('load', () => art.replaceChildren(img));     // 載入成功才換上去，失敗就留著文字佔位
    img.src = c.image;
  }
  const front = h('div', { class: 'card-face' }, art, h('div', { class: 'card-name', text: c.name }), h('div', { class: 'card-rarity', text: c.rarity || 'N' }));
  const url = safeUrl(c.url);
  const back = h('div', { class: 'card-face', hidden: true },
    h('div', { class: 'card-name', text: c.name }),
    h('p', { text: c.tagline || '（尚無簡介）' }),
    h('div', { class: 'tags' }, (c.tags || []).map((t) => h('span', { class: 'tag', text: t }))),
    url ? extLink(url, '前往 Caveduck 聊天 ↗', 'btn link') : null);
  const flip = () => { flipped = !flipped; front.hidden = flipped; back.hidden = !flipped; };
  const body = h('div', { class: `card r-${c.rarity || 'N'}` }, front, back,
    h('button', { class: 'btn', type: 'button', text: '翻面', onclick: flip }));

  return game.ui.panel({
    title: '角色卡', body, scene: 'card',
    onKey: (e) => { if (['KeyF', 'KeyE', 'Space'].includes(e.code)) { if (!e.repeat) flip(); return true; } return false; },
  }).closed;
}
