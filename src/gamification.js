const effortXP = { S: 10, M: 20, L: 35, XL: 50, XXL: 70 };

export function pointsForAction(action) {
  return effortXP[action.effort] || effortXP.M;
}

export function addXP(state, amount, reason, referenceId = "") {
  const key = `${reason}:${referenceId}`;
  if (state.xp.events.some(event => event.key === key)) return false;
  state.xp.events.push({ key, amount, reason, at: new Date().toISOString() });
  state.xp.total += amount;
  return true;
}

export function levelFor(total) {
  const level = Math.floor(total / 100) + 1;
  const into = total % 100;
  const names = ["Premier pas", "Élan", "Persévérance", "Alignement", "Rayonnement", "Équilibre"];
  return { level, into, remaining: 100 - into, title: names[Math.min(level - 1, names.length - 1)] };
}

export function milestoneFor(state, action) {
  const count = state.actions.filter(item => item.status === "done").length;
  if (count === 1) return "Premier pas posé !";
  if ([5, 10, 25, 50, 100].includes(count)) return `${count} micro-actions accomplies !`;
  if (action.effort === "XXL") return "Un vrai rocher déplacé !";
  return "Une pierre de plus sur ton chemin !";
}
