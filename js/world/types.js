/* ============================================================
   地圖物件類型。地圖資料裡的 objects 用 type 指到這裡。
   新增一種互動物件：在最下面 register('名稱', (def, game) => ({ ... })) 即可。

   每個類型回傳的物件可以有：
     prompt()    靠近時顯示的提示文字（回傳 null = 不顯示）
     interact()  按下互動鍵時做的事（可以是 async）
     color()     佔位色塊顏色          label()  佔位文字
     draw(ctx, px, py, tile, time)   自己畫（有的話取代色塊）
     update(dt)  每幀更新（需要時才寫）
     flat        true = 貼在地上（永遠畫在人物下面），例如農田、法陣
     art         圖比佔地大時，圖的範圍 {x, y, w, h}（相對於物件左上角，單位是格）。也可以寫在地圖資料裡
     visible()   回傳 false 時不畫       glow()  夜晚的發光半徑（格），0 = 不發光
   物件只透過 game.ui / game.farm 等系統做事，不直接碰畫面。
============================================================ */
import { CONFIG } from '../config.js';
import { rollLoot } from '../systems/loot.js';
import { splitRings } from '../systems/ringModel.js';
import { bugReaction } from '../systems/bugs.js';

const types = new Map();
export function register(name, factory) {
  if (types.has(name)) throw new Error(`物件類型重複註冊：${name}`);
  types.set(name, factory);
}

/* 依地圖資料建立物件；資料有問題時回傳 null 並印出原因 */
/* 可以互動的小型地面物件，圖畫成兩倍大（2×2 格），底部對齊原本那一格；佔地與碰撞仍是 1 格 */
const BIG = new Set(['board', 'bush', 'dig', 'lantern', 'fishspot', 'pond', 'offering', 'bugspot']);
export const BIG_ART = Object.freeze({ x: -0.5, y: -1, w: 2, h: 2 });

export function createEntity(def, game) {
  const factory = types.get(def?.type);
  if (!factory) { console.warn(`[world] 未知的物件類型，已略過：`, def); return null; }
  if (typeof def.id !== 'string' || !Number.isFinite(def.x) || !Number.isFinite(def.y)) { console.warn('[world] 物件缺少 id / x / y，已略過：', def); return null; }
  let art = def.art && [def.art.x, def.art.y, def.art.w, def.art.h].every(Number.isFinite) && def.art.w > 0 && def.art.h > 0 ? { ...def.art } : null;
  if (!art && BIG.has(def.type) && !(def.w > 1) && !(def.h > 1)) art = { ...BIG_ART };
  const base = {
    id: def.id, type: def.type, x: def.x, y: def.y, w: def.w || 1, h: def.h || 1, solid: def.solid === true, art,
    prompt: () => null, interact: () => {}, color: () => '#888', label: () => '',
  };
  try { return Object.assign(base, factory(def, game)); }
  catch (e) { console.error(`[world] 物件「${def.id}」建立失敗`, e); return null; }
}

/* 共用：從掉落表拿一樣東西（有冷卻）。回傳 'cooldown' / 'nothing' / 物品 id */
function forage(game, key, cdMs, tableName) {
  if (game.progress.cooldownLeft(key, cdMs) > 0) return 'cooldown';
  game.progress.markCooldown(key);
  const id = rollLoot(game.reg.lootTables[tableName], { rng: game.rng, phase: game.clock.phase() });
  if (!id) return 'nothing';
  return game.inv.add(id, 1) > 0 ? id : 'nothing';
}

/* ---------- 公告欄 ---------- */
register('board', (def, game) => ({
  color: () => '#8d6e63', label: () => '告',
  prompt: () => '閱讀公告',
  interact: () => game.ui.say(Array.isArray(def.lines) && def.lines.length ? def.lines : ['（空白的公告欄）']),
}));

/* ---------- 許願樹 ---------- */
register('tree', (def, game) => ({
  color: () => '#9c6b98', label: () => '許願樹',
  prompt: () => '許願樹',
  async interact() {
    const pickIdx = await game.ui.choose('許願樹', ['看許願牌', '搖一搖樹']);
    if (pickIdx === 0) return game.ui.show('plaques');
    if (pickIdx !== 1) return undefined;
    const got = forage(game, 'tree', CONFIG.TREE_SHAKE_CD_MS, 'tree');
    if (got === 'cooldown') return game.ui.say(['樹葉還在晃。等一下再搖吧。']);
    game.progress.inc('treeShakes');
    if (got === 'nothing') return game.ui.say(['沙沙沙……只有風吹過。']);
    return undefined;   // 拿到東西時由通知顯示
  },
}));

/* ---------- 召喚法陣 ---------- */
register('altar', (def, game) => ({
  color: () => '#6c5ce7', label: () => '法陣',
  prompt: () => '站上法陣',
  flat: true,
  glow: () => 3,
  interact: () => game.ui.show('ring'),
  draw(ctx, px, py, tile) {
    ctx.fillStyle = '#6c5ce7';
    ctx.fillRect(px + 3, py + 3, tile * 2 - 6, tile * 2 - 6);
  },
  drawOver(ctx, px, py, tile, time) {
    const cx = px + tile, cy = py + tile;
    // 地圖上的卡環：依卡片數自動分圈，交替反向公轉
    const rings = splitRings(game.reg.characters.length, CONFIG.RING_PER_RING);
    rings.forEach((count, ri) => {
      const radius = tile * (1.9 + ri * 0.8), dir = ri % 2 ? -1 : 1;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + dir * time * 0.25;
        const x = Math.round(cx + Math.cos(a) * radius - 4), y = Math.round(cy + Math.sin(a) * radius * 0.7 - 6 + Math.sin(time * 2 + i) * 2);
        ctx.fillStyle = 'rgba(20,16,40,0.25)'; ctx.fillRect(x + 1, y + 14, 7, 2);   // 影子
        ctx.fillStyle = '#9d8cff'; ctx.fillRect(x, y, 9, 12);                         // 卡背：亮框、深底、中間一點光
        ctx.fillStyle = '#2d2a4a'; ctx.fillRect(x + 1, y + 1, 7, 10);
        ctx.fillStyle = '#6c5ce7'; ctx.fillRect(x + 3, y + 4, 3, 4);
      }
    });
  },
}));

/* ---------- 農田 ---------- */
register('plot', (def, game) => {
  const i = def.index;
  if (!Number.isInteger(i) || i < 0 || i >= game.farm.maxSize) throw new Error(`農田 index 不合法：${i}`);
  const st = () => game.farm.status(i);
  const open = () => i < game.farm.size;               // 還沒擴建到這一塊：不顯示、不能互動
  return {
    visible: open,
    color() { const s = st(); return s.state === 'empty' ? '#6d4c41' : s.state === 'ripe' ? '#f4a261' : s.wet ? '#4e6b3a' : '#7a6a3a'; },
    label() { const s = st(); return s.state === 'empty' ? '' : s.state === 'ripe' ? '熟' : `${Math.floor(s.pct * 100)}%`; },
    prompt() { if (!open()) return null; const s = st(); return s.state === 'empty' ? '播種' : s.state === 'ripe' ? `收成${s.crop.name}` : s.wet ? `照顧${s.crop.name}` : '澆水'; },
    flat: true,
    /* 素材鍵依狀態切換：ent.plot.empty / ent.plot.growing / ent.plot.ripe */
    sprite() { return `ent.plot.${st().state}`; },
    async interact() {
      const s = st();
      if (s.state === 'ripe') { game.farm.harvest(i); return; }
      if (s.state === 'growing') {
        const canFert = !s.fertilized && game.inv.has('fertilizer');
        const canTonic = game.inv.has('growth_tonic');
        if (!s.wet && !canFert && !canTonic) { game.farm.water(i); game.ui.toast('澆水了'); return; }
        if (!canFert && !canTonic) { await game.ui.say([`${s.crop.name}正在長大（${Math.floor(s.pct * 100)}%）。土還是濕的。`, '商店有賣肥料和生長藥水，可以讓它長快一點。']); return; }
        const opts = [...(s.wet ? [] : ['澆水']), ...(canFert ? ['施肥（每株一次）'] : []), ...(canTonic ? [`生長藥水（剩 ${game.inv.count('growth_tonic')}）`] : [])];
        const idx = await game.ui.choose(`${s.crop.name}（${Math.floor(s.pct * 100)}%）`, opts);
        if (idx < 0) return;
        if (opts[idx] === '澆水') { game.farm.water(i); game.ui.toast('澆水了'); }
        else if (opts[idx].startsWith('施肥')) { if (game.farm.fertilize(i).ok) game.ui.toast('施肥了，長大了一截'); }
        else if (game.farm.tonic(i).ok) game.ui.toast('喝了藥水，一下子長大了一半');
        return;
      }
      const seeds = game.farm.plantable();
      if (!seeds.length) { await game.ui.say(['手上沒有種子。草叢和地上發亮的地方也許找得到。']); return; }
      const idx = await game.ui.choose('要種什麼？', seeds.map((e) => `${e.seed.name} ×${e.count}`));
      if (idx < 0) return;
      const r = game.farm.plant(i, seeds[idx].seed.id);
      if (r.ok) game.ui.toast(`種下了${r.crop.name}`);
    },
  };
});

/* ---------- 釣魚點 ---------- */
register('fishspot', (def, game) => ({
  color: () => '#90caf9', label: () => '釣',
  prompt: () => '釣魚',
  interact: () => game.ui.show('fishing'),
}));

/* ---------- 隱藏池塘（魚魚的家） ---------- */
register('pond', (def, game) => ({
  color: () => (game.fish.found() ? '#ff8a65' : '#5c8fb0'), label: () => (game.fish.found() ? '魚' : ''),
  sprite: () => (game.fish.found() ? 'ent.pond.found' : 'ent.pond'),
  prompt: () => (game.fish.found() ? '找魚魚' : '看看水面'),
  async interact() {
    const found = game.fish.found();
    const hasFeed = game.inv.has('feed');
    if (!found && !hasFeed) { await game.ui.say([await game.fish.misc('NO_FEED') || '水面很平靜。']); return; }
    let feedNow = hasFeed;
    if (found && hasFeed) {
      const idx = await game.ui.choose('池塘', ['餵飼料', '只是來聊天']);
      if (idx < 0) return;
      feedNow = idx === 0;
    }
    if (feedNow) {
      if (!found) await game.ui.say(await game.fish.misc('FIRST_FEED') || ['（你把飼料撒進水裡。）']);
      feedNow = game.fish.feed();
    }
    await game.ui.show('fishChat', { justFed: feedNow });
  },
}));

/* ---------- 草叢 ---------- */
register('bush', (def, game) => ({
  color: () => '#4caf50', label: () => '草',
  prompt: () => '翻翻草叢',
  async interact() {
    const got = forage(game, `bush:${def.id}`, CONFIG.DAILY_CD_MS, 'bush');
    if (got === 'cooldown') await game.ui.say(['草叢已經翻過了。晚點再來。']);
    else if (got === 'nothing') await game.ui.say(['沙沙……什麼都沒有。']);
  },
}));

/* ---------- 挖掘點 ---------- */
register('dig', (def, game) => {
  const key = `dig:${def.id}`;
  const ready = () => game.progress.cooldownLeft(key, CONFIG.DAILY_CD_MS) === 0;
  return {
    color: () => (ready() ? '#ffe082' : '#8d7b5a'), label: () => (ready() ? '✦' : ''),
    flat: true,
    sprite: () => (ready() ? 'ent.dig' : 'ent.dig.used'),
    prompt: () => (ready() ? '挖挖看' : null),
    async interact() {
      const got = forage(game, key, CONFIG.DAILY_CD_MS, 'dig');
      if (got === 'cooldown') return;
      game.progress.inc('digs');
      if (got === 'nothing') await game.ui.say(['挖了半天，只有土。']);
    },
  };
});

/* ---------- 石燈 ---------- */
register('lantern', (def, game) => {
  const key = `lit:${def.id}`;
  const lit = () => game.progress.flag(key);
  return {
    color: () => (lit() ? '#ffd54f' : '#607d8b'), label: () => '燈',
    sprite: () => (lit() ? 'ent.lantern.lit' : 'ent.lantern'),
    glow: () => (lit() ? 3.5 : 0),
    prompt: () => (lit() ? '熄燈' : '點燈'),
    interact() {
      if (lit()) { game.progress.clearFlag(key); return; }
      game.progress.setFlag(key);
      const all = game.world.entities.filter((e) => e.type === 'lantern');
      if (all.length && all.every((e) => game.progress.flag(`lit:${e.id}`))) {
        if (game.progress.setFlag('lanternsAll')) game.ui.toast('所有石燈都亮了');
      }
    },
  };
});

/* ---------- 成就小屋 ---------- */
register('hut', (def, game) => ({
  color: () => '#d7a86e', label: () => '成就小屋',
  prompt: () => '進入小屋',
  interact: () => game.ui.show('hut'),
}));

/* ---------- 供奉石（祭壇兌換） ---------- */
register('offering', (def, game) => ({
  color: () => '#c9b6ff', label: () => '供',
  prompt: () => '供奉',
  interact: () => game.ui.show('offerings'),
}));

/* ---------- 蟲（黃昏與夜晚才出現；靠太快會飛走） ---------- */
register('bugspot', (def, game) => {
  const caughtKey = `bug:${def.id}`, fleeKey = `bugflee:${def.id}`;
  const table = () => (game.reg.lootTables.bugs || []).filter((t) => !t.phases || t.phases.includes(game.clock.phase()));
  const active = () => table().length > 0
    && game.progress.cooldownLeft(caughtKey, CONFIG.BUG_CATCH_CD_MS) === 0
    && game.progress.cooldownLeft(fleeKey, CONFIG.BUG_FLEE_CD_MS) === 0;
  return {
    sneak: true,          // 點擊牠時，玩家會自動用潛行速度走過去
    visible: active,
    glow: () => (active() ? 1.2 : 0),
    prompt: () => (active() ? '抓蟲' : null),
    update() {
      if (!active()) return;
      const p = game.world.player;
      const dist = Math.hypot(p.x - (def.x + 0.5), p.y - (def.y + 0.5));
      if (bugReaction(dist, p.speed, { alertRadius: CONFIG.BUG_ALERT_RADIUS, sneakSpeed: CONFIG.BUG_SNEAK_SPEED }) === 'flee') {
        game.progress.markCooldown(fleeKey);
        game.ui.toast('蟲被嚇跑了。下次慢慢靠近（按住 Shift 或輕推搖桿）');
      }
    },
    interact() {
      if (!active()) return;
      const id = rollLoot(table(), { rng: game.rng });
      game.progress.markCooldown(caughtKey);
      if (id && game.inv.add(id, 1) > 0) game.progress.inc('bugsCaught');
    },
    draw(ctx, px, py, tile, time) {
      const bob = Math.sin(time * 3 + def.x) * 4;
      ctx.fillStyle = '#eaff8f';
      ctx.fillRect(px + tile / 2 - 2, py + tile / 2 - 2 + bob, 4, 4);
    },
  };
});

/* ---------- 商店 ---------- */
register('market', (def, game) => ({
  color: () => '#e0a458', label: () => '商店',
  prompt: () => '逛商店',
  interact: () => game.ui.show('market'),
}));

/* ---------- 小賭場 ---------- */
register('casino', (def, game) => ({
  color: () => '#c0392b', label: () => '賭場',
  glow: () => 2.5,
  prompt: () => (game.casino ? '進小賭場' : null),
  interact: () => game.ui.show('casino'),
}));

/* ---------- 魚缸 ---------- */
register('tank', (def, game) => ({
  color: () => '#4dd0e1', label: () => `魚缸 ${game.tank.count()}`,
  prompt: () => '看魚缸',
  interact: () => game.ui.show('tank'),
}));

/* ---------- 純裝飾（柱子、旗子…）：不能互動。地圖資料寫 sprite: '素材鍵'（例如 ent.pillar） ---------- */
register('deco', (def) => ({
  color: () => '#77758a', label: () => '',
  sprite: () => (typeof def.sprite === 'string' ? def.sprite : 'ent.deco'),
  flat: def.flat === true,
}));
