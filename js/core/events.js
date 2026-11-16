/* 事件匯流排：各系統只透過事件互相通知，不直接互相呼叫。
   事件清單見 README「事件一覽」。 */
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) {
      if (typeof fn !== 'function') throw new TypeError('bus.on 需要函式');
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => { map.get(type)?.delete(fn); };
    },
    emit(type, payload) {
      const set = map.get(type);
      if (!set) return;
      // 複製一份再跑，監聽器在執行中取消訂閱也不會出錯；單一監聽器出錯不影響其他
      for (const fn of [...set]) {
        try { fn(payload); } catch (e) { console.error(`[bus] 事件 ${type} 的監聽器出錯`, e); }
      }
    },
  };
}
