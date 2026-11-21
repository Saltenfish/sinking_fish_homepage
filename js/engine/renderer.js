/* 繪製：有素材就畫素材（data/assets.js），沒有就畫佔位色塊。
   素材鍵：圖塊 tile.<legend 的 key>、物件 ent.<類型>（或物件自己的 sprite()）、玩家 player。
   ・不會動的地面先畫成一張底圖，每幀只貼上鏡頭範圍
   ・物件只畫鏡頭內的
   ・天色依現實時間連續變化；會發光的物件（點亮的石燈、螢火蟲、卡環）在夜色之上再畫一層光 */
import { frameAt, variantAt } from '../core/assets.js';

const ROW = { down: 0, left: 1, right: 2, up: 3 };   // 玩家行走圖的列順序
const faceRow = (f) => (f.y > 0 ? ROW.down : f.y < 0 ? ROW.up : f.x < 0 ? ROW.left : ROW.right);

export function createRenderer({ canvas, tile, assets }) {
  const ctx = canvas.getContext('2d');
  let ground = null, groundFor = null, edges = null;
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
        if (m.variants) g.drawImage(img, variantAt(m, x, y) * m.frameW, 0, m.frameW, m.frameH, x * tile, y * tile, tile, tile);
        else if (m.frames > 1) { animatedTiles.push({ x, y, key }); g.drawImage(img, 0, 0, m.frameW, m.frameH, x * tile, y * tile, tile, tile); }
        else g.drawImage(img, x * tile, y * tile, tile, tile);
      } else { g.fillStyle = t.color || '#000'; g.fillRect(x * tile, y * tile, tile, tile); }
    }
    // 大型佈景（建築屋頂等）：直接畫進底圖，蓋在圖塊上面。沒有素材就不畫
    for (const d of map.decor || []) {
      const img = assets?.image(d.sprite);
      if (img) g.drawImage(img, d.x * tile, d.y * tile, d.w * tile, d.h * tile);
    }
    ground = c; groundFor = map;
    edges = buildShores(map);
  }

  /* 水岸：水和陸地交界的地方畫出斜俯視的岸邊（疊在會動的水上面，所以另外存一張）。
     北岸看得到一道泥土的岸壁、水面上有一條影子；東西兩岸是草地蓋過來一點、邊上一條深綠線；
     南岸是草地的邊緣加一條淺色的水花；兩邊都是陸地的轉角畫成圓角 */
  function buildShores(map) {
    const c = document.createElement('canvas');
    c.width = map.w * tile; c.height = map.h * tile;
    const g = c.getContext('2d');
    const isWater = (x, y) => { const k = map.tile(x, y)?.key; return k === 'water' || k === 'bridge' || x < 0 || y < 0 || x >= map.w || y >= map.h; };
    const s = tile / 32;
    const jag = (x, y, i) => ((x * 73856093) ^ (y * 19349663) ^ (i * 83492791)) >>> 0;
    const R = (px_, py_, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(px_ * s), Math.round(py_ * s), Math.ceil(w * s), Math.ceil(h * s)); };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (map.tile(x, y)?.key !== 'water') continue;
      g.save(); g.translate(x * tile, y * tile);
      const n = !isWater(x, y - 1), so = !isWater(x, y + 1), w = !isWater(x - 1, y), e = !isWater(x + 1, y);
      if (n) {
        for (let i = 0; i < 32; i++) {
          const d = 1 + (jag(x, y, i >> 2) % 3);
          R(i, 0, 1, d, '#5e9c4c');
          R(i, d, 1, 1, '#2c5a2a');
          R(i, d + 1, 1, 3, '#8a6342');                  // 岸壁（泥土的正面）
          R(i, d + 4, 1, 3, '#6a4a2e');
          R(i, d + 7, 1, 1, '#4f3520');
        }
        R(0, 11, 32, 3, 'rgba(10,30,60,0.35)');            // 岸壁投在水上的影子
      }
      if (so) {
        for (let i = 0; i < 32; i++) {
          const d = 1 + (jag(x, y, i >> 2) % 3);
          R(i, 32 - d, 1, d, '#5e9c4c');
          R(i, 31 - d, 1, 1, '#2c5a2a');
          R(i, 30 - d, 1, 1, 'rgba(220,245,255,0.75)');    // 水花
        }
      }
      if (w) {
        for (let i = 0; i < 32; i++) {
          const d = 2 + (jag(x, y, 100 + (i >> 2)) % 3);
          R(0, i, d, 1, '#5e9c4c');
          R(d, i, 1, 1, '#2c5a2a');
          R(d + 1, i, 4, 1, 'rgba(10,30,60,0.32)');        // 西岸的影子（光從左邊來）
        }
      }
      if (e) {
        for (let i = 0; i < 32; i++) {
          const d = 2 + (jag(x, y, 200 + (i >> 2)) % 3);
          R(32 - d, i, d, 1, '#5e9c4c');
          R(31 - d, i, 1, 1, '#2c5a2a');
          R(30 - d, i, 1, 1, 'rgba(220,245,255,0.6)');
        }
      }
      // 轉角：兩邊都是陸地 → 圓角
      const corner = (cx, cy, sx, sy) => {
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
          const dist = Math.hypot(7.5 - xx, 7.5 - yy);
          const X = sx > 0 ? cx + xx : cx - xx - 1, Y = sy > 0 ? cy + yy : cy - yy - 1;
          if (dist > 7.5) R(X, Y, 1, 1, '#5e9c4c');
          else if (dist > 6.5) R(X, Y, 1, 1, '#2c5a2a');
        }
      };
      if (n && w) corner(0, 0, 1, 1);
      if (n && e) corner(32, 0, -1, 1);
      if (so && w) corner(0, 32, 1, -1);
      if (so && e) corner(32, 32, -1, -1);
      g.restore();
    }
    return c;
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
      if (edges) ctx.drawImage(edges, -camera.x, -camera.y);   // 水岸疊在流動的水上面

      ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glows = [];
      // 排序：貼地的東西（flat：農田、法陣、挖掘點…）永遠在最下層；其餘依「腳底的 y」由後往前畫，
      // 這樣人物走到大樹後面會被樹冠擋住、走到前面會擋住樹
      const list = [];
      for (const e of entities) {
        const px = e.x * tile - camera.x, py = e.y * tile - camera.y, pw = e.w * tile, ph = e.h * tile;
        const a = e.art;   // 圖比佔地大時的範圍（相對於物件左上角，單位是格）
        const ax = a ? px + a.x * tile : px, ay = a ? py + a.y * tile : py, aw = a ? a.w * tile : pw, ah = a ? a.h * tile : ph;
        if (ax > viewW + tile || ay > viewH + tile || ax + aw < -tile || ay + ah < -tile) continue;
        const glow = e.glow ? e.glow() : 0;
        if (glow > 0) glows.push([px + pw / 2, py + ph / 2, glow * tile]);
        if (e.visible && !e.visible()) continue;
        list.push({ e, px, py, pw, ph, ax, ay, aw, ah, layer: e.flat ? 0 : 1, foot: e.y + e.h });
      }
      list.push({ player: true, layer: 1, foot: player.y + player.half });
      list.sort((p, q) => p.layer - q.layer || p.foot - q.foot);

      for (const d of list) {
        if (d.player) { drawPlayer(); continue; }
        const { e, px, py, pw, ph } = d;
        if (!sprite(e.sprite ? e.sprite() : `ent.${e.type}`, time, d.ax, d.ay, d.aw, d.ah)) {
          if (e.draw) e.draw(ctx, px, py, tile, time);
          else {
            ctx.fillStyle = e.color();
            ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
            const label = e.label();
            if (label) { ctx.fillStyle = '#fff'; ctx.fillText(label, px + pw / 2, py + ph / 2); }
          }
        }
        if (e.drawOver) e.drawOver(ctx, px, py, tile, time);     // 疊在素材上面的動態效果（例如法陣周圍公轉的卡）
      }

      function drawPlayer() {
        const r = player.half * tile;
        const cx = player.x * tile - camera.x, cy = player.y * tile - camera.y;
        // 行走圖照原本的比例畫（例如 32×48 → 1×1.5 格），腳底對齊人物站的位置
        const m = assets?.image('player') ? assets.meta('player') : null;
        const dw = m ? (m.frameW / 32) * tile : tile, dh = m ? (m.frameH / 32) * tile : tile;
        const feet = cy + r;
        if (!sprite('player', time, Math.round(cx - dw / 2), Math.round(feet - dh + tile * 0.12), dw, dh, faceRow(player.face), player.speed > 0)) {
          ctx.fillStyle = '#f6c453';
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          ctx.fillStyle = '#3a2a10';                                  // 面向標記
          ctx.fillRect(cx + player.face.x * r * 0.6 - 2, cy + player.face.y * r * 0.6 - 2, 4, 4);
        }
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
