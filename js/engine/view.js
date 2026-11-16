/* 畫面尺寸：畫布永遠填滿整個視窗；依視窗大小挑放大倍率，視窗越大看到的範圍越廣。 */

/* 純函式：挑第一個「放大後仍看得到最小範圍」的倍率；都放不下（手機）就用最小倍率 */
export function pickScale(w, h, { minW, minH, scales }) {
  for (const s of scales) if (w / s >= minW && h / s >= minH) return s;
  return scales[scales.length - 1];
}

export function createView({ canvas, camera, config, win = window, onResize }) {
  const view = { w: 0, h: 0, scale: 1 };
  function apply() {
    const cw = Math.max(1, win.innerWidth), ch = Math.max(1, win.innerHeight);
    view.scale = pickScale(cw, ch, { minW: config.VIEW_MIN_W, minH: config.VIEW_MIN_H, scales: config.VIEW_SCALES });
    view.w = Math.ceil(cw / view.scale); view.h = Math.ceil(ch / view.scale);
    if (canvas.width !== view.w) canvas.width = view.w;
    if (canvas.height !== view.h) canvas.height = view.h;
    camera.viewW = view.w; camera.viewH = view.h;
    onResize?.(view);
  }
  win.addEventListener('resize', apply);
  win.addEventListener('orientationchange', apply);
  apply();
  return view;
}
