/* 鏡頭：跟著玩家，不超出地圖邊界；地圖比畫面小時置中。單位是像素。
   viewW / viewH 會在視窗改變大小時由 view.js 更新。 */
export function createCamera(viewW, viewH) {
  const cam = {
    x: 0, y: 0, viewW, viewH,
    follow(px, py, mapW, mapH) {
      const vw = cam.viewW, vh = cam.viewH;
      cam.x = mapW <= vw ? (mapW - vw) / 2 : Math.max(0, Math.min(mapW - vw, px - vw / 2));
      cam.y = mapH <= vh ? (mapH - vh) / 2 : Math.max(0, Math.min(mapH - vh, py - vh / 2));
      cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
    },
  };
  return cam;
}
