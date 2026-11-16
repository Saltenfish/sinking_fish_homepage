/* 繪製：目前全部是佔位色塊。之後換美術時，只需要改這個檔（與各物件的 draw）。
   ・不會動的地面先畫成一張底圖，每幀只貼上鏡頭範圍
   ・物件只畫鏡頭內的 */
const TINT = { dawn: 'rgba(255,190,150,0.12)', day: null, dusk: 'rgba(255,140,90,0.16)', night: 'rgba(20,24,70,0.38)' };

export function createRenderer({ canvas, tile, viewW, viewH }) {
  canvas.width = viewW; canvas.height = viewH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let ground = null, groundFor = null;

  function buildGround(map) {
    const c = document.createElement('canvas');
    c.width = map.w * tile; c.height = map.h * tile;
    const g = c.getContext('2d');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      g.fillStyle = map.tile(x, y).color || '#000';
      g.fillRect(x * tile, y * tile, tile, tile);
    }
    ground = c; groundFor = map;
  }

  return {
    draw({ map, entities, player, camera, phase, time }) {
      if (groundFor !== map) buildGround(map);
      ctx.fillStyle = '#10141c';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.drawImage(ground, -camera.x, -camera.y);

      ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const e of entities) {
        const px = e.x * tile - camera.x, py = e.y * tile - camera.y, pw = e.w * tile, ph = e.h * tile;
        if (px > viewW + tile * 3 || py > viewH + tile * 3 || px + pw < -tile * 3 || py + ph < -tile * 3) continue;
        if (e.draw) { e.draw(ctx, px, py, tile, time); continue; }
        ctx.fillStyle = e.color();
        ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
        const label = e.label();
        if (label) { ctx.fillStyle = '#fff'; ctx.fillText(label, px + pw / 2, py + ph / 2); }
      }

      const r = player.half * tile;
      const cx = player.x * tile - camera.x, cy = player.y * tile - camera.y;
      ctx.fillStyle = '#f6c453';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = '#3a2a10';                                  // 面向標記
      ctx.fillRect(cx + player.face.x * r * 0.6 - 2, cy + player.face.y * r * 0.6 - 2, 4, 4);

      if (TINT[phase]) { ctx.fillStyle = TINT[phase]; ctx.fillRect(0, 0, viewW, viewH); }
    },
  };
}
