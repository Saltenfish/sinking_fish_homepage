/* 建立 DOM 的小工具。文字一律走 textContent，不使用 innerHTML，資料裡的內容不會被當成程式執行。 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* 對外連結：只接受 http(s)，並且不把本頁資訊帶給對方 */
export function extLink(href, text, cls) {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: cls, text });
}
