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
    map: null, entities: [], solids: [], updaters: [], nearest: null, time: 0,
    player: { x: 0, y: 0, half: HALF, face: { x: 0, y: 1 }, speed: 0 },   // speed：這一幀實際的移動速度（格/秒）
    landmarks: [],
  };
  let path = null;            // 點擊移動的路徑（格座標陣列）
  let tapTarget = null;       // 點擊了某個物件：走到旁邊後自動互動
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
    world.updaters = world.entities.filter((e) => typeof e.update === 'function');
    world.landmarks = (data.landmarks || []).filter((l) => l && typeof l.id === 'string' && Number.isFinite(l.x) && Number.isFinite(l.y) && !boxBlocked(world.map, world.solids, l.x, l.y, HALF));
    let p = spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y) ? spawn : data.spawn;
    if (boxBlocked(world.map, world.solids, p.x, p.y, HALF)) p = data.spawn;    // 存檔位置現在被擋住（地圖改過）：回出生點
    world.player.x = p.x; world.player.y = p.y;
    path = null; tapTarget = null; world.nearest = null;
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
    // 找被點到的物件：手指不容易點準，所以點在物件旁邊一小段距離內也算（取最近的那個）
    const fx = (x + camera.x) / T, fy = (y + camera.y) / T;
    let best = null, bestD = CONFIG.TAP_SLOP;
    for (const e of world.entities) {
      const d = distToRect(fx, fy, e);
      if (d <= bestD && e.prompt() !== null && (d < bestD || !best)) { best = e; bestD = d; }
    }
    tapTarget = best;
    if (tapTarget && distToRect(p.x, p.y, tapTarget) <= CONFIG.INTERACT_RANGE) { path = null; return; }   // 已經在旁邊：下一幀直接互動
    // 目的地：有點到物件就走向物件上離手指最近的那一格，否則走向點擊的那一格
    const gx = tapTarget ? Math.min(tapTarget.x + tapTarget.w - 1, Math.max(tapTarget.x, tx)) : tx;
    const gy = tapTarget ? Math.min(tapTarget.y + tapTarget.h - 1, Math.max(tapTarget.y, ty)) : ty;
    const found = findPath(passable, world.map.w, world.map.h, Math.floor(p.x), Math.floor(p.y), gx, gy);
    // 先走回自己這格的中心再出發，避免從格子邊緣斜切時卡到牆角
    if (found) path = found.length ? [{ x: Math.floor(p.x), y: Math.floor(p.y) }, ...found] : [];
  });

  world.update = (dt) => {
    world.time += dt;
    if (!world.map) return;
    const p = world.player;
    if (ui.isBlocking()) { wantInteract = false; p.speed = 0; return; }
    const ax = input.axis();
    let dx = 0, dy = 0;

    if (ax.mag > 0) {
      path = null; tapTarget = null;
      dx = ax.x * CONFIG.PLAYER_SPEED * ax.mag * dt;
      dy = ax.y * CONFIG.PLAYER_SPEED * ax.mag * dt;
    } else if (path) {
      if (!path.length) path = null;
      else {
        const gx = path[0].x + 0.5, gy = path[0].y + 0.5;
        const ddx = gx - p.x, ddy = gy - p.y, dist = Math.hypot(ddx, ddy);
        const stepLen = CONFIG.PLAYER_SPEED * (tapTarget?.sneak ? CONFIG.SNEAK_RATE : 1) * dt;
        if (dist <= stepLen) { dx = ddx; dy = ddy; path.shift(); }
        else { dx = (ddx / dist) * stepLen; dy = (ddy / dist) * stepLen; }
      }
    }

    if (dx || dy) {
      const r = moveBox(world.map, world.solids, p, dx, dy, HALF);
      const moved = r.x !== p.x || r.y !== p.y;
      p.speed = Math.hypot(r.x - p.x, r.y - p.y) / dt;
      p.x = r.x; p.y = r.y;
      p.face = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if (moved) movedSinceSave = true;
      else if (path) path = null;                         // 路被擋住就放棄這條路
    } else p.speed = 0;

    for (const e of world.updaters) {
      try { e.update(dt); } catch (err) { console.error(`[world] 物件「${e.id}」更新時出錯`, err); }
    }

    world.nearest = findNearest();
    ui.setPrompt(world.nearest ? world.nearest.prompt() : null);
    if (wantInteract) { wantInteract = false; tapTarget = null; if (world.nearest) runInteract(world.nearest); }
    else if (tapTarget && !path) {                         // 點擊物件後走到了（或走不到）
      const t = tapTarget; tapTarget = null;
      if (distToRect(p.x, p.y, t) <= CONFIG.INTERACT_RANGE && t.prompt() !== null) runInteract(t);
    }

    sinceSave += dt;
    if (movedSinceSave && sinceSave >= 2) world.savePosition();
  };

  world.savePosition = () => {
    if (!world.map) return;
    save.data.player = { map: world.map.id, x: world.player.x, y: world.player.y };
    save.commit();
    sinceSave = 0; movedSinceSave = false;
  };

  /* 傳送到指定位置（傳送地圖用）。目的地被擋住時不動，回傳 false */
  world.teleport = (x, y) => {
    if (!world.map || !Number.isFinite(x) || !Number.isFinite(y) || boxBlocked(world.map, world.solids, x, y, HALF)) return false;
    world.player.x = x; world.player.y = y; world.player.speed = 0;
    path = null; tapTarget = null;
    world.savePosition();
    return true;
  };

  world.followCamera = () => {
    if (world.map) camera.follow(world.player.x * T, world.player.y * T, world.map.w * T, world.map.h * T);
  };

  return world;
}
