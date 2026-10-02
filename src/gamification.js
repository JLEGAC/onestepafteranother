const effortXP = { S: 10, M: 20, L: 35, XL: 50, XXL: 70 };

export function pointsForAction(action) {
  return 5 + (effortXP[action.effort] || effortXP.M);
}

export function effortBonus(action) {
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

export const badgeCatalog = [
  { id: "first-step", title: "Premier pas", icon: "👣", description: "Terminer une micro-action.", test: state => state.actions.some(item => item.status === "done") },
  { id: "five-steps", title: "Un bel élan", icon: "✨", description: "Terminer 5 micro-actions.", test: state => state.actions.filter(item => item.status === "done").length >= 5 },
  { id: "twenty-five-steps", title: "Chemin tracé", icon: "🧭", description: "Terminer 25 micro-actions.", test: state => state.actions.filter(item => item.status === "done").length >= 25 },
  { id: "first-habit", title: "Rituel lancé", icon: "🌱", description: "Valider une première habitude.", test: state => Object.values(state.habitLogs).some(day => Object.values(day).some(Boolean)) },
  { id: "habit-week", title: "Une semaine d’élan", icon: "🔥", description: "Tenir une habitude 7 jours de suite.", test: state => state.habits.some(habit => bestHabitStreak(state, habit.id) >= 7) },
  { id: "grand-slam", title: "Grand Chelem", icon: "🏆", description: "Compléter toutes les habitudes d’une journée.", test: state => Object.entries(state.habitLogs).some(([date, day]) => {
    const habits = state.habits.filter(habit => (habit.createdAtDate || habit.createdAt?.slice(0, 10) || "0000-00-00") <= date && date <= (habit.archivedAt || "9999-99-99"));
    return habits.length > 0 && habits.every(habit => day[habit.id]);
  }) },
  { id: "first-challenge", title: "Défi relevé", icon: "🎯", description: "Terminer un défi.", test: state => state.challenges.some(item => item.status === "completed") },
  { id: "first-capsule", title: "Curiosité en action", icon: "🎬", description: "Regarder une capsule.", test: state => state.capsules.some(item => item.watchedAt) },
  { id: "first-retro", title: "Prendre du recul", icon: "🔎", description: "Clôturer une rétrospective de Cap Hebdo.", test: state => state.weeks.some(item => item.retro) }
];

function bestHabitStreak(state, habitId) {
  const dates = Object.entries(state.habitLogs)
    .filter(([, day]) => day[habitId])
    .map(([date]) => date)
    .sort();
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of dates) {
    const [year, month, day] = date.split("-").map(Number);
    const [previousYear, previousMonth, previousDay] = previous.split("-").map(Number);
    const consecutive = previous && Date.UTC(year, month - 1, day) - Date.UTC(previousYear, previousMonth - 1, previousDay) === 86_400_000;
    current = consecutive ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

export function badgesFor(state) {
  return badgeCatalog.map(({ test, ...badge }) => ({ ...badge, unlocked: test(state) }));
}

export const themeRewards = [
  { id: "forest", name: "Forêt", level: 1 },
  { id: "dawn", name: "Aurore", level: 3 },
  { id: "lavender", name: "Lavande", level: 5 }
];
