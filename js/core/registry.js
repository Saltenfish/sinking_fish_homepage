/* 資料登錄與檢查：開機時把 js/data/ 的所有資料檢查一遍。
   不合格的項目會被略過並在主控台印出原因，不會讓整個網站壞掉。 */
import { isObj, isNum, safeKey, safeUrl } from './util.js';
import { PHASES as TIME_PHASES } from '../data/time.js';
import { checkPhases } from '../systems/clock.js';
import { checkCasino } from '../systems/casino.js';

export const RARITIES = ['N', 'R', 'SR', 'SSR'];
export const ITEM_CATS = ['seed', 'crop', 'fish', 'bug', 'treasure', 'misc'];
export const PHASES = TIME_PHASES.map((p) => p.id);   // 時段 id 來自 data/time.js
const str = (v, max = 400) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function collect(list, label, errors, check) {
  const out = [];
  const byId = new Map();
  if (!Array.isArray(list)) { errors.push(`${label}：資料不是陣列`); return { list: out, byId }; }
  list.forEach((raw, i) => {
    const where = `${label}[${i}]${isObj(raw) && raw.id ? `（${raw.id}）` : ''}`;
    if (!isObj(raw)) { errors.push(`${where}：不是物件`); return; }
    if (!safeKey(raw.id)) { errors.push(`${where}：缺少 id 或 id 不合法`); return; }
    if (byId.has(raw.id)) { errors.push(`${where}：id 重複`); return; }
    const problem = check(raw);
    if (problem) { errors.push(`${where}：${problem}`); return; }
    const item = Object.freeze({ ...raw });
    out.push(item); byId.set(item.id, item);
  });
  return { list: out, byId };
}

export function buildRegistry(src) {
  const errors = [...checkPhases(TIME_PHASES)];

  const characters = collect(src.characters, 'characters', errors, (c) => {
    if (!str(c.name, 60)) return '缺少 name';
    if (!safeUrl(c.url)) return 'url 必須是 http(s) 連結';
    if (c.rarity !== undefined && !RARITIES.includes(c.rarity)) return `rarity 只能是 ${RARITIES.join('/')}`;
    if (c.tags !== undefined && !(Array.isArray(c.tags) && c.tags.every((t) => str(t, 20)))) return 'tags 必須是文字陣列';
    if (c.image !== undefined && !str(c.image, 200)) return 'image 必須是路徑文字';
    return null;
  });

  const sites = collect(src.sites, 'sites', errors, (s) => {
    if (!str(s.name, 60)) return '缺少 name';
    if (!safeUrl(s.url)) return 'url 必須是 http(s) 連結';
    return null;
  });

  const items = collect(src.items, 'items', errors, (it) => {
    if (!str(it.name, 30)) return '缺少 name';
    if (!ITEM_CATS.includes(it.cat)) return `cat 只能是 ${ITEM_CATS.join('/')}`;
    if (it.sell !== undefined && !(Number.isInteger(it.sell) && it.sell > 0)) return 'sell 必須是正整數';
    return null;
  });

  const crops = collect(src.crops, 'crops', errors, (c) => {
    if (!str(c.name, 30)) return '缺少 name';
    if (!items.byId.has(c.seed)) return `seed「${c.seed}」不在 items 裡`;
    if (!items.byId.has(c.produce)) return `produce「${c.produce}」不在 items 裡`;
    if (!(isNum(c.growMs) && c.growMs > 0)) return 'growMs 必須是正數';
    const y = c.yield;
    if (!(Array.isArray(y) && y.length === 2 && Number.isInteger(y[0]) && Number.isInteger(y[1]) && y[0] >= 1 && y[1] >= y[0])) return 'yield 必須是 [最少, 最多]';
    return null;
  });
  const cropBySeed = new Map(crops.list.map((c) => [c.seed, c]));

  const lootProblem = (t) => {
    if (!items.byId.has(t.item)) return `item「${t.item}」不在 items 裡`;
    if (!(isNum(t.weight) && t.weight > 0)) return 'weight 必須是正數';
    if (t.phases !== undefined && !(Array.isArray(t.phases) && t.phases.every((p) => PHASES.includes(p)))) return `phases 只能含 ${PHASES.join('/')}`;
    return null;
  };
  const fish = collect(src.fish, 'fish', errors, lootProblem);

  const lootTables = {};
  if (isObj(src.loot)) {
    for (const name of Object.keys(src.loot)) {
      if (!safeKey(name)) continue;
      const rows = Array.isArray(src.loot[name]) ? src.loot[name] : [];
      lootTables[name] = rows.filter((row, i) => {
        if (isObj(row) && row.item === null && isNum(row.weight) && row.weight > 0) return true; // item:null 代表「什麼都沒有」
        const problem = isObj(row) ? lootProblem(row) : '不是物件';
        if (problem) errors.push(`loot.${name}[${i}]：${problem}`);
        return !problem;
      });
    }
  }

  const achievements = collect(src.achievements, 'achievements', errors, (a) => {
    if (!str(a.name, 30)) return '缺少 name';
    const c = a.cond;
    if (!isObj(c)) return '缺少 cond';
    if (c.stat !== undefined) { if (!(safeKey(c.stat) && isNum(c.gte))) return 'cond 需要 {stat, gte}'; }
    else if (c.flag !== undefined) { if (!safeKey(c.flag)) return 'cond.flag 不合法'; }
    else if (c.seenAll !== undefined) {
      if (!(Array.isArray(c.seenAll) && c.seenAll.length && c.seenAll.every((id) => items.byId.has(id)))) return 'cond.seenAll 必須是 items 裡的 id 陣列';
    } else return 'cond 只支援 stat / flag / seenAll';
    if (a.reward !== undefined) {
      if (!isObj(a.reward)) return 'reward 必須是 {物品id: 數量}';
      for (const k of Object.keys(a.reward)) if (!items.byId.has(k) || !(Number.isInteger(a.reward[k]) && a.reward[k] > 0)) return `reward「${k}」不合法`;
    }
    return null;
  });

  const offerings = collect(src.offerings || [], 'offerings', errors, (o) => {
    if (!str(o.name, 30)) return '缺少 name';
    if (!isObj(o.cost) || !Object.keys(o.cost).length) return 'cost 必須是 {物品id: 數量}';
    for (const k of Object.keys(o.cost)) if (!items.byId.has(k) || !(Number.isInteger(o.cost[k]) && o.cost[k] > 0)) return `cost「${k}」不合法`;
    if (o.cardBack !== undefined && !/^[a-z0-9]{1,20}$/.test(o.cardBack)) return 'cardBack 只能用小寫英數字';
    return null;
  });

  /* 商店商品：物品要存在、不可重複、買價要高於賣價（否則可以無限套利） */
  const goods = [];
  const goodByItem = new Map();
  (Array.isArray(src.goods) ? src.goods : []).forEach((g, i) => {
    const where = `goods[${i}]`;
    if (!isObj(g) || !items.byId.has(g.item)) { errors.push(`${where}：item 不在 items 裡`); return; }
    if (goodByItem.has(g.item)) { errors.push(`${where}：商品重複（${g.item}）`); return; }
    if (!(Number.isInteger(g.price) && g.price > 0)) { errors.push(`${where}：price 必須是正整數`); return; }
    const sell = items.byId.get(g.item).sell || 0;
    if (g.price <= sell) { errors.push(`${where}：買價 ${g.price} 必須高於賣價 ${sell}`); return; }
    const good = Object.freeze({ item: g.item, price: g.price });
    goods.push(good); goodByItem.set(g.item, good);
  });

  /* 賭場設定：有問題就整個停用（casino = null） */
  let casino = null;
  if (src.casino !== undefined) {
    const problems = checkCasino(src.casino);
    if (problems.length) errors.push(...problems.map((p) => `casino：${p}`)); else casino = src.casino;
  }

  /* 召喚特效設定：格式不對就停用（直接顯示卡片） */
  let summonFx = null;
  if (src.summonFx !== undefined) {
    const f = src.summonFx;
    if (isObj(f) && Array.isArray(f.steps) && f.steps.every((x) => safeKey(x)) && isObj(f.base) && isObj(f.rarity)) summonFx = f;
    else errors.push('summonFx：需要 steps（陣列）、base、rarity');
  }

  return {
    errors,
    goods, goodByItem, casino, summonFx,
    offerings: offerings.list, offeringById: offerings.byId,
    characters: characters.list, characterById: characters.byId,
    sites: sites.list, siteById: sites.byId,
    items: items.list, itemById: items.byId,
    crops: crops.list, cropById: crops.byId, cropBySeed,
    fish: fish.list,
    lootTables,
    achievements: achievements.list, achievementById: achievements.byId,
  };
}
