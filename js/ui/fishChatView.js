/* 魚魚聊天視窗。台詞由 js/fish/ 產生，這裡只負責顯示與輸入。 */
import { h } from './dom.js';

const DELAY = 520;   // 魚魚每句話之間的間隔（毫秒）

export async function fishChatView(game, args = {}) {
  let session;
  try { session = await game.fish.session(args); }
  catch (e) { console.error('[魚魚] 載入失敗', e); return game.ui.say(['水面很平靜。魚魚好像不在家。']); }

  const msgs = h('div', { class: 'chat-msgs', role: 'log', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', maxLength: 200, placeholder: '跟魚魚說點什麼…', 'aria-label': '訊息' });
  let alive = true, queue = Promise.resolve();
  const timers = new Set();
  const wait = (ms) => new Promise((r) => { const t = setTimeout(() => { timers.delete(t); r(); }, ms); timers.add(t); });

  function bubble(text, who) {
    msgs.append(h('div', { class: `chat-row ${who}` }, h('div', { class: 'chat-bub', text })));
    msgs.scrollTop = msgs.scrollHeight;
  }
  /* 魚魚的台詞排隊一句一句出來；視窗關掉後就不再出 */
  function botSay(lines) {
    queue = queue.then(async () => {
      for (const line of lines) { if (!alive) return; await wait(DELAY); if (!alive) return; bubble(line, 'bot'); }
    });
  }
  function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    bubble(text, 'me');
    let lines;
    try { lines = session.reply(text); } catch (e) { console.error('[魚魚] 回覆出錯', e); lines = ['……（魚魚吐了一串泡泡）']; }
    botSay(lines);
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });

  const body = h('div', { class: 'chat' }, h('div', { class: 'chat-sub', text: session.subtitle }), msgs,
    h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'button', text: '送出', onclick: send })));
  const p = game.ui.panel({ title: session.name, body, onClose: () => { alive = false; timers.forEach(clearTimeout); timers.clear(); } });
  botSay(session.greet());
  input.focus();
  return p.closed;
}
