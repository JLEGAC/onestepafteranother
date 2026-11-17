// Arrays are atomic on purpose: index-based victories and XP totals cannot be
// blindly unioned. Only independent top-level domains are merged automatically.
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function comparable(state) {
  const copy = structuredClone(state || {}); delete copy.updatedAt; delete copy.createdAt;
  return copy;
}
export const equal = (a,b) => canonical(comparable(a)) === canonical(comparable(b));
export function mergeStates(base, local, remote) {
  if (!base) return { state: null, conflicts: ['Première connexion'] };
  const result = structuredClone(remote); const conflicts = [];
  // Related goals/steps/actions and XP are one unit: avoid inconsistent links or rewards.
  const groups = [['stones','steps','actions','xp','habits','habitLogs','challenges','capsules','daily','weeks','reserveOrder'], ['profile'], ['preferences'], ['tools']];
  for (const keys of groups) {
    const pick = obj => Object.fromEntries(keys.map(k => [k, obj[k]]));
    const b=canonical(pick(base)), l=canonical(pick(local)), r=canonical(pick(remote));
    if (l === b) continue;
    if (r === b || l === r) for (const k of keys) result[k] = structuredClone(local[k]);
    else conflicts.push(keys[0]);
  }
  return { state: conflicts.length ? null : result, conflicts };
}
export function hasData(state, initial) { return !equal(state, initial); }
