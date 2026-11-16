/* 繪製：目前全部是佔位色塊。之後換美術時，只需要改這個檔（與各物件的 draw）。
   ・不會動的地面先畫成一張底圖，每幀只貼上鏡頭範圍
   ・物件只畫鏡頭內的
   ・天色依現實時間連續變化；會發光的物件（點亮的石燈、螢火蟲、卡環）在夜色之上再畫一層光 */
export function createRenderer({ canvas, tile }) {
  const ctx = canvas.getContext('2d');
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
    draw({ map, entities, player, camera, tint, time }) {
      const viewW = canvas.width, viewH = canvas.height;
      if (groundFor !== map) buildGround(map);
      ctx.imageSmoothingEnabled = false;          // 畫布改變大小後這個設定會被重置，所以每幀設一次
      ctx.fillStyle = '#10141c';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.drawImage(ground, -camera.x, -camera.y);

      ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glows = [];
      for (const e of entities) {
        const px = e.x * tile - camera.x, py = e.y * tile - camera.y, pw = e.w * tile, ph = e.h * tile;
        if (px > viewW + tile * 4 || py > viewH + tile * 4 || px + pw < -tile * 4 || py + ph < -tile * 4) continue;
        const glow = e.glow ? e.glow() : 0;
        if (glow > 0) glows.push([px + pw / 2, py + ph / 2, glow * tile]);
        if (e.visible && !e.visible()) continue;
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

      if (tint && tint.a > 0) {
        ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
        ctx.fillRect(0, 0, viewW, viewH);
        if (glows.length) {
          ctx.globalCompositeOperation = 'lighter';
          for (const [gx, gy, gr] of glows) {
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            grad.addColorStop(0, `rgba(255,220,140,${Math.min(0.5, tint.a)})`);
            grad.addColorStop(1, 'rgba(255,220,140,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    },
  };
}
