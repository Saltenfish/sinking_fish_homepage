/* 鏡頭：跟著玩家，不超出地圖邊界；地圖比畫面小時置中。單位是像素。 */
export function createCamera(viewW, viewH) {
  const cam = {
    x: 0, y: 0, viewW, viewH,
    follow(px, py, mapW, mapH) {
      cam.x = mapW <= viewW ? (mapW - viewW) / 2 : Math.max(0, Math.min(mapW - viewW, px - viewW / 2));
      cam.y = mapH <= viewH ? (mapH - viewH) / 2 : Math.max(0, Math.min(mapH - viewH, py - viewH / 2));
      cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
    },
  };
  return cam;
}
