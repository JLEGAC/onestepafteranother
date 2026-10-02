import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, normalizeState } from "../src/data.js";
import { createChallenge, expireChallenges, markCapsuleWatched, markChallengeDay, monthGrid, toggleHabit } from "../src/engagement.js";

test("V1 data upgrades without dropping existing profile or gains", () => {
  const old = { schemaVersion: 1, profile: { vision: "Avancer" }, stones: [], actions: [], xp: { total: 12, events: [] } };
  const state = normalizeState(old);
  assert.equal(state.profile.vision, "Avancer");
  assert.equal(state.xp.total, 12);
  assert.deepEqual(state.habits, []);
  assert.deepEqual(state.habitLogs, {});
  assert.equal(state.preferences.theme, "forest");
  assert.equal(state.schemaVersion, 2);
});

test("habit checks award XP once and the seventh Grand Chelem doubles its bonus", () => {
  const state = createInitialState();
  state.habits = ["a", "b", "c"].map(id => ({ id, title: id, createdAtDate: "2026-10-01", active: true }));
  let result;
  for (let day = 1; day <= 7; day += 1) {
    const date = `2026-10-0${day}`;
    for (const habit of state.habits) result = toggleHabit(state, habit.id, date);
  }
  assert.deepEqual(result.rewards.map(item => item.amount), [1, 20]);
  assert.equal(state.xp.total, 101);
  toggleHabit(state, "a", "2026-10-07");
  const repeated = toggleHabit(state, "a", "2026-10-07");
  assert.equal(repeated.rewards.length, 0);
  assert.equal(state.xp.total, 101);
});

test("challenge dates award progress once and an end bonus on completion", () => {
  const state = createInitialState();
  const challenge = createChallenge(state, { title: "Gratitude", description: "Écrire trois choses positives", targetDays: 2, startDate: "2026-10-01" });
  const first = markChallengeDay(state, challenge.id, "2026-10-01");
  assert.deepEqual(first.rewards.map(item => item.amount), [3]);
  assert.equal(markChallengeDay(state, challenge.id, "2026-10-01").changed, false);
  const final = markChallengeDay(state, challenge.id, "2026-10-03");
  assert.equal(final.completed, true);
  assert.deepEqual(final.rewards.map(item => item.amount), [3, 15]);
  assert.equal(challenge.status, "completed");
  assert.equal(state.xp.total, 21);
});

test("expired challenges stop blocking a new challenge without losing earned XP", () => {
  const state = createInitialState();
  const challenge = createChallenge(state, { title: "Gratitude", description: "Écrire", targetDays: 5, startDate: "2026-10-01" });
  markChallengeDay(state, challenge.id, "2026-10-01");
  assert.equal(expireChallenges(state, "2026-10-08"), true);
  assert.equal(challenge.status, "expired");
  assert.equal(state.xp.total, 3);
  assert.equal(expireChallenges(state, "2026-10-08"), false);
});

test("capsule watch reward cannot be collected twice", () => {
  const state = createInitialState();
  state.capsules.push({ id: "video-1", title: "Respirer" });
  assert.equal(markCapsuleWatched(state, "video-1"), true);
  assert.equal(markCapsuleWatched(state, "video-1"), false);
  assert.equal(state.xp.total, 3);
});

test("month grid begins on Monday and includes every date", () => {
  assert.deepEqual(monthGrid(2026, 1).slice(0, 7), [null, null, null, null, null, null, 1]);
  assert.equal(monthGrid(2026, 1).filter(Boolean).length, 28);
});
