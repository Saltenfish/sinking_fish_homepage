/* 小圖示：有素材就回傳 <img>，沒有就回傳 null（呼叫端只顯示文字）。 */
import { h } from './dom.js';

export function assetImg(game, key, alt = '', cls = 'icon') {
  const url = game.assets?.url(key);
  if (!url) return null;
  const img = h('img', { class: cls, alt, decoding: 'async', loading: 'lazy' });
  img.addEventListener('error', () => img.remove());   // 圖檔壞掉就拿掉，不留破圖
  img.src = url;
  return img;
}
export const itemIcon = (game, id) => assetImg(game, `item.${id}`);
