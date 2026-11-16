/* 許願樹畫面：一棵大樹，許願牌用繩子垂掛在枝條上、隨風輕晃。
   ・每個網站一塊牌（data/sites.js），點一下在下方顯示說明與連結
   ・訪客自己的願望是較小的牌，只存在自己的瀏覽器
   ・掛點位置在 systems/treeLayout.js；樹本身目前是佔位線稿，之後換成正式美術 */
import { h, extLink } from './dom.js';
import { safeUrl } from '../core/util.js';
import { TREE_W, TREE_H, PLAQUE_W, PLAQUE_H, plaqueSpot } from '../systems/treeLayout.js';

const MAX_WISHES = 10, MAX_LEN = 30;
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]); return el; };

/* 混色樹冠：四種顏色的葉團交錯（固定位置，不用亂數，每次看到的樹都一樣） */
const LEAF_COLORS = ['#f7a8c4', '#b9a5e8', '#7fd1c1', '#f3d37a'];
const LEAVES = [[90, 150, 90], [190, 80, 95], [300, 40, 85], [420, 20, 90], [540, 30, 85], [650, 20, 80], [760, 60, 90], [850, 130, 85],
  [140, 230, 70], [250, 160, 75], [370, 110, 70], [480, 90, 65], [600, 110, 70], [720, 150, 70], [820, 220, 65], [50, 60, 70],
  [330, 200, 55], [560, 190, 55], [680, 250, 50], [880, 40, 60], [220, 20, 60], [470, 170, 50]];
/* 樹幹（填色）與枝條（粗線） */
const TRUNK = 'M360 540 C360 440 330 360 250 300 L270 270 C340 300 400 330 440 300 C450 240 450 160 480 90 L505 95 C490 170 500 250 520 300 C560 320 620 300 650 230 C670 180 700 130 740 95 L760 110 C720 160 700 220 690 290 C680 380 690 460 700 540 Z';
const BRANCHES = [['M262 286 C200 262 140 250 88 242', 14], ['M300 290 C330 220 340 150 285 92', 13], ['M200 262 C170 220 150 170 135 128', 9],
  ['M520 300 C550 220 580 150 628 106', 13], ['M628 106 C645 80 655 55 668 34', 8], ['M745 105 C775 112 800 116 822 108', 9],
  ['M700 250 C760 215 810 200 846 186', 10], ['M480 92 C470 70 440 62 400 60', 8], ['M492 92 C505 74 512 66 522 58', 7],
  ['M690 290 C720 300 750 300 772 298', 8], ['M330 180 C336 174 340 170 342 168', 6]];

function buildTree() {
  const root = svg('svg', { viewBox: `0 0 ${TREE_W} ${TREE_H}`, class: 'tree-svg', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
  LEAVES.forEach(([cx, cy, r], i) => root.append(svg('circle', { cx, cy, r, fill: LEAF_COLORS[i % LEAF_COLORS.length], opacity: '0.5' })));
  root.append(svg('path', { d: TRUNK, fill: '#6b4a34' }));
  for (const [d, w] of BRANCHES) root.append(svg('path', { d, fill: 'none', stroke: '#6b4a34', 'stroke-width': w, 'stroke-linecap': 'round' }));
  LEAVES.slice(0, 10).forEach(([cx, cy, r], i) => root.append(svg('circle', { cx: cx + 30, cy: cy - 10, r: r * 0.45, fill: LEAF_COLORS[(i + 2) % LEAF_COLORS.length], opacity: '0.45' })));
  return root;
}

export function plaquesView(game) {
  const { reg, save, ui } = game;
  const pct = (v, total) => `${(v / total * 100).toFixed(3)}%`;
  const layer = h('div', { class: 'tree-hang' });
  const stage = h('div', { class: 'tree-stage' }, buildTree(), layer);
  const detail = h('div', { class: 'tree-detail', role: 'status', 'aria-live': 'polite' }, h('p', { class: 'hint', text: '點一下樹上的許願牌看看。' }));
  const input = h('input', { type: 'text', maxLength: MAX_LEN, placeholder: '寫下你的願望，掛到樹上…', 'aria-label': '願望' });

  /* 一塊垂掛的牌：上半是繩子，下半是牌子；整組以綁點為軸輕輕擺動 */
  function hang(i, cls, text, onPick) {
    const spot = plaqueSpot(i);
    const total = spot.len + PLAQUE_H;
    const wrap = h('div', { class: 'hang' },
      h('div', { class: 'hang-string', style: `flex-basis:${pct(spot.len, total)}` }),
      h('button', { class: `plaque ${cls} c${i % 5}`, type: 'button', text, onclick: onPick }));
    Object.assign(wrap.style, {
      left: pct(spot.x - PLAQUE_W / 2, TREE_W), top: pct(spot.y, TREE_H), width: pct(PLAQUE_W, TREE_W), height: pct(total, TREE_H),
      animationDuration: `${3.2 + (i * 37 % 17) / 10}s`, animationDelay: `${-(i * 53 % 29) / 10}s`,
    });
    return wrap;
  }

  function showSite(s) {
    const url = safeUrl(s.url);
    detail.replaceChildren(h('b', { text: s.name }), h('p', { text: s.desc || '' }), url ? extLink(url, '前往這個網站 ↗', 'btn link') : null);
  }
  function showWish(i) {
    detail.replaceChildren(h('b', { text: '我的願望' }), h('p', { text: save.data.wishes[i] }),
      h('button', { class: 'btn', type: 'button', text: '取下這塊牌', onclick: () => { save.data.wishes.splice(i, 1); save.commit(); render(); detail.replaceChildren(h('p', { class: 'hint', text: '牌子取下了。' })); } }));
  }
  function render() {
    const nodes = reg.sites.map((s, i) => hang(i, 'site', s.name, () => showSite(s)));
    save.data.wishes.forEach((w, j) => nodes.push(hang(reg.sites.length + j, 'wish', w, () => showWish(j))));
    layer.replaceChildren(...nodes);
  }
  function add() {
    const text = input.value.trim().slice(0, MAX_LEN);
    if (!text) return;
    if (save.data.wishes.length >= MAX_WISHES) { ui.toast('樹枝掛滿了，先取下一塊吧'); return; }
    save.data.wishes.push(text); save.commit();
    input.value = ''; render();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); } });
  render();

  const body = h('div', { class: 'tree' }, h('div', { class: 'tree-scroll' }, stage), detail,
    h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'button', text: '掛上去', onclick: add })));
  return ui.panel({ title: '許願樹', body, cls: 'xl' }).closed;
}
