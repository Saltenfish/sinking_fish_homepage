/* 成就小屋：成就牆、收藏架、統計。 */
import { h } from './dom.js';

const SHELVES = [['treasure', '寶物'], ['fish', '漁獲'], ['bug', '昆蟲'], ['crop', '作物']];

export function hutView(game) {
  const { reg, inv, cards, ach, progress, ui } = game;
  const list = ach.list();
  const done = list.filter((e) => e.unlockedAt !== null).length;
  const date = (t) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

  const wall = h('div', { class: 'stamps' }, list.map(({ achievement: a, unlockedAt }) => h('div', { class: `stamp${unlockedAt === null ? ' locked' : ''}` },
    h('div', { class: 'stamp-mark', text: unlockedAt === null ? '？' : '印' }),
    h('b', { text: a.name }), h('span', { text: a.desc || '' }),
    unlockedAt === null ? null : h('span', { class: 'note', text: date(unlockedAt) }))));

  const shelves = SHELVES.map(([cat, name]) => {
    const all = reg.items.filter((it) => it.cat === cat);
    if (!all.length) return null;
    const seen = all.filter((it) => inv.seen(it.id)).length;
    return h('div', null, h('h4', { text: `${name}（${seen} / ${all.length}）` }),
      h('div', { class: 'grid' }, all.map((it) => h('div', { class: `cell${inv.seen(it.id) ? '' : ' unknown'}`, title: inv.seen(it.id) ? it.desc || '' : '', text: inv.seen(it.id) ? it.name : '？' }))));
  });

  const stats = [['召喚過的卡', `${cards.ownedCount()} / ${cards.total()}`], ['收成次數', progress.stat('harvests')], ['釣到的魚', progress.stat('catches')],
    ['抓到的蟲', progress.stat('bugsCaught')], ['挖掘次數', progress.stat('digs')], ['供奉次數', progress.stat('offerings')]];

  const body = h('div', { class: 'hut' },
    h('h4', { text: `成就牆（${done} / ${list.length}）` }),
    h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': list.length, 'aria-valuenow': done }, h('div', { style: `width:${list.length ? (done / list.length * 100).toFixed(1) : 0}%` })),
    wall,
    h('h4', { text: '收藏架' }), shelves,
    h('h4', { text: '紀錄' }), h('div', { class: 'stats' }, stats.map(([k, v]) => h('div', null, h('span', { text: k }), h('b', { text: String(v) })))));
  return ui.panel({ scene: 'hut', title: '成就小屋', body, cls: 'xl' }).closed;
}
