import { addXP } from "./gamification.js";
import { newId, todayISO } from "./data.js";

export function dateShift(date, amount) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function isHabitDone(state, habitId, date = todayISO()) {
  return Boolean(state.habitLogs?.[date]?.[habitId]);
}

export function activeHabits(state) {
  return (state.habits || []).filter(habit => habit.active !== false);
}

function habitsForDate(state, date) {
  return (state.habits || []).filter(habit => {
    const created = habit.createdAtDate || habit.createdAt?.slice(0, 10) || "0000-00-00";
    const archived = habit.archivedAt || "9999-99-99";
    return created <= date && date <= archived;
  });
}

export function habitDaySummary(state, date) {
  const habits = habitsForDate(state, date);
  const done = habits.filter(habit => isHabitDone(state, habit.id, date)).length;
  return { done, total: habits.length, percent: habits.length ? Math.round(done / habits.length * 100) : 0 };
}

function fullDayStreak(state, date) {
  const habits = activeHabits(state);
  if (!habits.length) return 0;
  let count = 0;
  for (let cursor = date; habitDaySummary(state, cursor).percent === 100; cursor = dateShift(cursor, -1)) count += 1;
  return count;
}

export function habitStreak(state, habitId, fromDate = todayISO()) {
  let count = 0;
  for (let cursor = fromDate; isHabitDone(state, habitId, cursor); cursor = dateShift(cursor, -1)) count += 1;
  return count;
}

export function bestHabitStreak(state, habitId) {
  const dates = Object.entries(state.habitLogs || {})
    .filter(([, day]) => day[habitId])
    .map(([date]) => date)
    .sort();
  let best = 0;
  let count = 0;
  let previous = "";
  for (const date of dates) {
    count = previous && dateShift(previous, 1) === date ? count + 1 : 1;
    best = Math.max(best, count);
    previous = date;
  }
  return best;
}

export function toggleHabit(state, habitId, date = todayISO()) {
  const habit = state.habits.find(item => item.id === habitId && item.active !== false);
  if (!habit) return { changed: false, completed: false, rewards: [] };
  state.habitLogs[date] ||= {};
  const completed = !state.habitLogs[date][habitId];
  if (!completed) {
    delete state.habitLogs[date][habitId];
    return { changed: true, completed: false, rewards: [] };
  }

  state.habitLogs[date][habitId] = true;
  const rewards = [];
  if (addXP(state, 1, "habit", `${habitId}:${date}`)) rewards.push({ amount: 1, label: "Habitude validée" });
  const summary = habitDaySummary(state, date);
  if (summary.total && summary.done === summary.total) {
    const bonus = fullDayStreak(state, date) >= 7 ? 20 : 10;
    if (addXP(state, bonus, "habit-grand-slam", date)) rewards.push({ amount: bonus, label: "Grand Chelem" });
  }
  return { changed: true, completed: true, summary, rewards };
}

export function createChallenge(state, fields) {
  const startDate = fields.startDate || todayISO();
  const challenge = {
    id: newId("challenge"),
    title: fields.title.trim(),
    description: fields.description.trim(),
    targetDays: Math.max(1, Math.min(7, Number(fields.targetDays) || 3)),
    startDate,
    endDate: dateShift(startDate, 6),
    linkedHabitId: fields.linkedHabitId || "",
    linkedStoneId: fields.linkedStoneId || "",
    completedDates: [],
    status: "active",
    createdAt: new Date().toISOString()
  };
  state.challenges.unshift(challenge);
  return challenge;
}

export function challengeProgress(challenge) {
  const completed = (challenge.completedDates || []).length;
  return { completed, target: challenge.targetDays, percent: Math.min(100, Math.round(completed / challenge.targetDays * 100)) };
}

export function markChallengeDay(state, challengeId, date = todayISO()) {
  const challenge = state.challenges.find(item => item.id === challengeId && item.status === "active");
  if (!challenge || date < challenge.startDate || date > challenge.endDate) return { changed: false, completed: false, rewards: [] };
  challenge.completedDates ||= [];
  if (challenge.completedDates.includes(date)) return { changed: false, completed: false, rewards: [] };
  challenge.completedDates.push(date);
  challenge.completedDates.sort();
  const rewards = [];
  if (addXP(state, 3, "challenge-day", `${challengeId}:${date}`)) rewards.push({ amount: 3, label: "Étape du défi" });
  const completed = challengeProgress(challenge).completed >= challenge.targetDays;
  if (completed) {
    challenge.status = "completed";
    if (addXP(state, 15, "challenge-complete", challengeId)) rewards.push({ amount: 15, label: "Défi accompli" });
  }
  return { changed: true, completed, challenge, rewards };
}

export function stopChallenge(state, challengeId) {
  const challenge = state.challenges.find(item => item.id === challengeId && item.status === "active");
  if (!challenge) return false;
  challenge.status = "stopped";
  return true;
}

export function expireChallenges(state, date = todayISO()) {
  let changed = false;
  for (const challenge of state.challenges || []) {
    if (challenge.status === "active" && challenge.endDate < date) {
      challenge.status = "expired";
      changed = true;
    }
  }
  return changed;
}

export function markCapsuleWatched(state, capsuleId) {
  const capsule = state.capsules.find(item => item.id === capsuleId);
  if (!capsule || capsule.watchedAt) return false;
  capsule.watchedAt = new Date().toISOString();
  addXP(state, 3, "capsule", capsuleId);
  return true;
}

export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function isoFromMonthDay(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
