/* 時鐘：依訪客的本地時間決定時段。 */
export function phaseOfHour(h) {
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}
export function createClock(now = Date.now) {
  return {
    now,
    hour() { return new Date(now()).getHours(); },
    phase() { return phaseOfHour(new Date(now()).getHours()); },
  };
}
