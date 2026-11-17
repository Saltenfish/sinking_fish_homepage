/* 傳送地圖：小地圖 + 地點清單，點地點直接傳送。 */
import { h } from './dom.js';

const PX = 6;   // 小地圖上一格的大小

export function mapView(game) {
  const { world, progress, ui } = game;
  const map = world.map;
  if (!map) return Promise.resolve();
  const places = world.landmarks.filter((l) => !l.secret || progress.flag(l.secret));

  const cv = h('canvas', { class: 'minimap', width: map.w * PX, height: map.h * PX, 'aria-hidden': 'true' });
  const g = cv.getContext('2d');
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    // 秘密入口在小地圖上看起來要跟牆一樣
    const t = map.char(x, y) === 'r' ? map.legend['#'] || map.tile(x, y) : map.tile(x, y);
    g.fillStyle = t.color || '#000'; g.fillRect(x * PX, y * PX, PX, PX);
  }
  g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
  places.forEach((l, i) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(l.x * PX, l.y * PX, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b2030'; g.fillText(String(i + 1), l.x * PX, l.y * PX + 4);
  });
  g.fillStyle = '#f6c453'; g.fillRect(world.player.x * PX - 4, world.player.y * PX - 4, 8, 8);

  let panel = null;
  const go = (l) => { if (world.teleport(l.x, l.y)) panel.close(); else ui.toast('現在去不了那裡'); };
  const body = h('div', { class: 'mapview' }, cv,
    h('div', { class: 'places' }, places.map((l, i) => h('button', { class: 'btn', type: 'button', text: `${i + 1}. ${l.name}`, onclick: () => go(l) }))),
    h('p', { class: 'hint', text: '黃色方塊是你的位置。按數字鍵或點地點名稱傳送。' }));
  panel = ui.panel({ scene: 'map',
    title: '地圖', body, cls: 'wide',
    onKey: (e) => {
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m && places[Number(m[1]) - 1]) { go(places[Number(m[1]) - 1]); return true; }
      if (e.code === 'KeyM') { if (!e.repeat) panel.close(); return true; }
      return false;
    },
  });
  return panel.closed;
}
