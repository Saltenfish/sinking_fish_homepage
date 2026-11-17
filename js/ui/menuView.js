/* 存檔選單：匯出、匯入、重置。匯入或重置成功後重新載入頁面，確保所有系統讀到新存檔。 */
import { h } from './dom.js';

export function menuView(game) {
  const { save, ui, storage } = game;
  save.flush();
  const out = h('textarea', { readOnly: true, rows: 4, value: save.exportCode(), 'aria-label': '存檔碼' });
  const inp = h('textarea', { rows: 4, placeholder: '把存檔碼貼在這裡', 'aria-label': '要匯入的存檔碼' });
  const msg = h('p', { class: 'note', role: 'status' });

  async function copy() {
    try { await navigator.clipboard.writeText(out.value); msg.textContent = '已複製存檔碼。'; }
    catch { out.focus(); out.select(); msg.textContent = '請手動複製上面的文字。'; }
  }
  async function doImport() {
    if (!inp.value.trim()) { msg.textContent = '請先貼上存檔碼。'; return; }
    const sure = await ui.choose('匯入會覆蓋目前的進度，確定嗎？', ['確定匯入', '取消']);
    if (sure !== 0) return;
    const r = save.importCode(inp.value);
    if (r.ok) location.reload(); else msg.textContent = `匯入失敗：${r.error}`;
  }
  async function doReset() {
    const sure = await ui.choose('確定要清除所有進度嗎？這個動作無法復原。', ['確定清除', '取消']);
    if (sure !== 0) return;
    save.reset();
    location.reload();
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { msg.textContent = '這個瀏覽器不允許切換全螢幕。'; }
  }
  const btn = (text, fn) => h('button', { class: 'btn', type: 'button', text, onclick: fn });
  const body = h('div', null,
    storage.persistent ? null : h('p', { class: 'warn', text: '這個瀏覽器目前無法保存進度（可能是無痕模式）。關掉網頁後進度會消失，請用存檔碼備份。' }),
    document.documentElement.requestFullscreen ? h('div', { class: 'row' }, btn('切換全螢幕', toggleFullscreen)) : null,
    h('h4', { text: '匯出存檔' }), out, h('div', { class: 'row' }, btn('複製', copy)),
    h('h4', { text: '匯入存檔' }), inp, h('div', { class: 'row' }, btn('匯入', doImport)),
    h('h4', { text: '重新開始' }), h('div', { class: 'row' }, btn('清除所有進度', doReset)), msg,
    h('p', { class: 'hint', text: '操作：WASD／方向鍵或點擊地面移動・按住 Shift 潛行・E 互動・B 背包・M 地圖・L 目錄・Esc 選單' }));
  return ui.panel({ scene: 'menu', title: '選單', body }).closed;
}
