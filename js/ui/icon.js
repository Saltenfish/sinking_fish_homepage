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
/* 給 CSS 變數用的 url()：一定要轉成絕對網址。CSS 變數裡的相對路徑會以 css 檔的位置為基準，而不是網頁 */
export const cssUrl = (url) => `url("${new URL(url, document.baseURI).href}")`;

export const itemIcon = (game, id) => assetImg(game, `item.${id}`);
