/* 掉落：從掉落表抽一項。回傳物品 id，落空回傳 null。 */
import { weighted } from '../core/util.js';

export function rollLoot(table, { rng = Math.random, phase } = {}) {
  if (!Array.isArray(table)) return null;
  const pool = table.filter((t) => !t.phases || !phase || t.phases.includes(phase));
  const hit = weighted(rng, pool);
  return hit ? hit.item : null;
}
