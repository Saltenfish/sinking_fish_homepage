/* 世界：管理地圖、玩家、互動物件。每幀由主迴圈呼叫 update(dt)。 */
import { CONFIG } from '../config.js';
import { createTilemap } from '../engine/tilemap.js';
import { boxBlocked, moveBox, distToRect } from '../engine/collision.js';
import { findPath } from '../engine/pathfind.js';
import { createEntity } from './types.js';

export function createWorld({ game, maps, input, camera }) {
  const { save, bus, ui } = game;
  const T = CONFIG.TILE, HALF = CONFIG.PLAYER_HALF;
  const world = {
    map: null, entities: [], solids: [], nearest: null, time: 0,
    player: { x: 0, y: 0, half: HALF, face: { x: 0, y: 1 } },
  };
  let path = null;            // 點擊移動的路徑（格座標陣列）
  let wantInteract = false;
  let busy = false;           // 互動進行中，避免連按重複觸發
  let sinceSave = 0, movedSinceSave = false;

  const passable = (tx, ty) => !world.map.solid(tx, ty) && !world.solids.some((s) => tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h);

  /* 載入地圖。spawn 省略時用地圖預設出生點 */
  world.load = (mapId, spawn) => {
    const data = maps[mapId];
    if (!data) throw new Error(`找不到地圖：${mapId}`);
    world.map = createTilemap(data);
    world.entities = [];
    const ids = new Set();
    for (const def of data.objects || []) {
      if (ids.has(def?.id)) { console.warn(`[world] 物件 id 重複，已略過：${def.id}`); continue; }
      const e = createEntity(def, game);
      if (e) { ids.add(e.id); world.entities.push(e); }
    }
    world.solids = world.entities.filter((e) => e.solid);
    let p = spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y) ? spawn : data.spawn;
    if (boxBlocked(world.map, world.solids, p.x, p.y, HALF)) p = data.spawn;    // 存檔位置現在被擋住（地圖改過）：回出生點
    world.player.x = p.x; world.player.y = p.y;
    path = null; world.nearest = null;
    bus.emit('world:loaded', { map: mapId });
  };

  function findNearest() {
    let best = null, bestD = CONFIG.INTERACT_RANGE;
    for (const e of world.entities) {
      const d = distToRect(world.player.x, world.player.y, e);
      if (d <= bestD && e.prompt() !== null) { best = e; bestD = d; }
    }
    return best;
  }

  function runInteract(e) {
    if (busy) return;
    busy = true;
    Promise.resolve()
      .then(() => e.interact())
      .catch((err) => console.error(`[world] 與「${e.id}」互動時出錯`, err))
      .finally(() => { busy = false; });
  }

  bus.on('input:action', ({ action }) => { if (action === 'interact') wantInteract = true; });
  bus.on('input:tap', ({ x, y }) => {
    if (!world.map) return;
    const tx = Math.floor((x + camera.x) / T), ty = Math.floor((y + camera.y) / T);
    const p = world.player;
    const found = findPath(passable, world.map.w, world.map.h, Math.floor(p.x), Math.floor(p.y), tx, ty);
    // 先走回自己這格的中心再出發，避免從格子邊緣斜切時卡到牆角
    if (found) path = found.length ? [{ x: Math.floor(p.x), y: Math.floor(p.y) }, ...found] : [];
  });

  world.update = (dt) => {
    world.time += dt;
    if (!world.map) return;
    if (ui.isBlocking()) { wantInteract = false; return; }
    const p = world.player;
    const ax = input.axis();
    let dx = 0, dy = 0;

    if (ax.x || ax.y) {
      path = null;
      const len = Math.hypot(ax.x, ax.y);
      dx = (ax.x / len) * CONFIG.PLAYER_SPEED * dt;
      dy = (ax.y / len) * CONFIG.PLAYER_SPEED * dt;
    } else if (path) {
      if (!path.length) path = null;
      else {
        const gx = path[0].x + 0.5, gy = path[0].y + 0.5;
        const ddx = gx - p.x, ddy = gy - p.y, dist = Math.hypot(ddx, ddy);
        const stepLen = CONFIG.PLAYER_SPEED * dt;
        if (dist <= stepLen) { dx = ddx; dy = ddy; path.shift(); }
        else { dx = (ddx / dist) * stepLen; dy = (ddy / dist) * stepLen; }
      }
    }

    if (dx || dy) {
      const r = moveBox(world.map, world.solids, p, dx, dy, HALF);
      const moved = r.x !== p.x || r.y !== p.y;
      p.x = r.x; p.y = r.y;
      p.face = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if (moved) movedSinceSave = true;
      else if (path) path = null;                         // 路被擋住就放棄這條路
    }

    world.nearest = findNearest();
    ui.setPrompt(world.nearest ? world.nearest.prompt() : null);
    if (wantInteract) { wantInteract = false; if (world.nearest) runInteract(world.nearest); }

    sinceSave += dt;
    if (movedSinceSave && sinceSave >= 2) world.savePosition();
  };

  world.savePosition = () => {
    if (!world.map) return;
    save.data.player = { map: world.map.id, x: world.player.x, y: world.player.y };
    save.commit();
    sinceSave = 0; movedSinceSave = false;
  };

  world.followCamera = () => {
    if (world.map) camera.follow(world.player.x * T, world.player.y * T, world.map.w * T, world.map.h * T);
  };

  return world;
}
