/* 繪製：有素材就畫素材（data/assets.js），沒有就畫佔位色塊。
   素材鍵：圖塊 tile.<legend 的 key>、物件 ent.<類型>（或物件自己的 sprite()）、玩家 player。
   ・不會動的地面先畫成一張底圖，每幀只貼上鏡頭範圍
   ・物件只畫鏡頭內的
   ・天色依現實時間連續變化；會發光的物件（點亮的石燈、螢火蟲、卡環）在夜色之上再畫一層光 */
import { frameAt } from '../core/assets.js';

const ROW = { down: 0, left: 1, right: 2, up: 3 };   // 玩家行走圖的列順序
const faceRow = (f) => (f.y > 0 ? ROW.down : f.y < 0 ? ROW.up : f.x < 0 ? ROW.left : ROW.right);

export function createRenderer({ canvas, tile, assets }) {
  const ctx = canvas.getContext('2d');
  let ground = null, groundFor = null;
  let animatedTiles = [];   // 有動畫的圖塊（例如水），每幀重畫

  /* 畫一張素材到指定矩形；動畫素材自動取目前影格。row 用於多列的行走圖 */
  function sprite(key, time, dx, dy, dw, dh, row = 0, playing = true) {
    const img = assets?.image(key);
    if (!img) return false;
    const m = assets.meta(key);
    if (m.frames > 1) ctx.drawImage(img, frameAt(m, playing ? time : 0) * m.frameW, row * m.frameH, m.frameW, m.frameH, dx, dy, dw, dh);
    else ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }

  function buildGround(map) {
    const c = document.createElement('canvas');
    c.width = map.w * tile; c.height = map.h * tile;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    animatedTiles = [];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.tile(x, y);
      const key = t.key ? `tile.${t.key}` : null;
      const img = key ? assets?.image(key) : null;
      if (img) {
        const m = assets.meta(key);
        if (m.frames > 1) { animatedTiles.push({ x, y, key }); g.drawImage(img, 0, 0, m.frameW, m.frameH, x * tile, y * tile, tile, tile); }
        else g.drawImage(img, x * tile, y * tile, tile, tile);
      } else { g.fillStyle = t.color || '#000'; g.fillRect(x * tile, y * tile, tile, tile); }
    }
    ground = c; groundFor = map;
  }

  return {
    /* 圖塊素材載入完成後呼叫：下一幀重畫底圖 */
    invalidateGround() { groundFor = null; },

    draw({ map, entities, player, camera, tint, time }) {
      const viewW = canvas.width, viewH = canvas.height;
      if (groundFor !== map) buildGround(map);
      ctx.imageSmoothingEnabled = false;          // 畫布改變大小後這個設定會被重置，所以每幀設一次
      ctx.fillStyle = '#10141c';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.drawImage(ground, -camera.x, -camera.y);
      for (const a of animatedTiles) {
        const px = a.x * tile - camera.x, py = a.y * tile - camera.y;
        if (px > -tile && py > -tile && px < viewW && py < viewH) sprite(a.key, time, px, py, tile, tile);
      }

      ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glows = [];
      for (const e of entities) {
        const px = e.x * tile - camera.x, py = e.y * tile - camera.y, pw = e.w * tile, ph = e.h * tile;
        if (px > viewW + tile * 4 || py > viewH + tile * 4 || px + pw < -tile * 4 || py + ph < -tile * 4) continue;
        const glow = e.glow ? e.glow() : 0;
        if (glow > 0) glows.push([px + pw / 2, py + ph / 2, glow * tile]);
        if (e.visible && !e.visible()) continue;
        if (sprite(e.sprite ? e.sprite() : `ent.${e.type}`, time, px, py, pw, ph)) continue;
        if (e.draw) { e.draw(ctx, px, py, tile, time); continue; }
        ctx.fillStyle = e.color();
        ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
        const label = e.label();
        if (label) { ctx.fillStyle = '#fff'; ctx.fillText(label, px + pw / 2, py + ph / 2); }
      }

      const r = player.half * tile;
      const cx = player.x * tile - camera.x, cy = player.y * tile - camera.y;
      if (!sprite('player', time, Math.round(cx - tile / 2), Math.round(cy - tile * 0.7), tile, tile, faceRow(player.face), player.speed > 0)) {
        ctx.fillStyle = '#f6c453';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#3a2a10';                                  // 面向標記
        ctx.fillRect(cx + player.face.x * r * 0.6 - 2, cy + player.face.y * r * 0.6 - 2, 4, 4);
      }

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
