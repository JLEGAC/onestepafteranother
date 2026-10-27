import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, exportObject, mondayISO, stoneProgress, validateImport, weekEndISO } from "../src/data.js";
import { addXP, levelFor, pointsForAction } from "../src/gamification.js";

test("objective progress includes its reserve actions and rounds 8/13 to 62%", () => {
  const state = createInitialState();
  state.stones.push({ id: "stone-1" });
  for (let i = 0; i < 8; i++) state.actions.push({ id: `done-${i}`, stoneId: "stone-1", status: "done" });
  for (let i = 0; i < 5; i++) state.actions.push({ id: `reserve-${i}`, stoneId: "stone-1", status: "reserve" });
  assert.deepEqual(stoneProgress(state, "stone-1"), { done: 8, total: 13, percent: 62 });
});

test("split and abandoned parent actions do not inflate the stone denominator", () => {
  const state = createInitialState();
  state.actions = [
    { id: "done", stoneId: "s", status: "done" },
    { id: "reserve", stoneId: "s", status: "reserve" },
    { id: "split", stoneId: "s", status: "split" },
    { id: "abandoned", stoneId: "s", status: "abandoned" }
  ];
  assert.deepEqual(stoneProgress(state, "s"), { done: 1, total: 2, percent: 50 });
});

test("objective progress includes actions linked through its steps", () => {
  const state = createInitialState();
  state.steps = [{ id: "step-1", stoneId: "s", title: "Préparer" }];
  state.actions = [
    { id: "direct", stoneId: "s", status: "done" },
    { id: "step-done", stepId: "step-1", status: "done" },
    { id: "step-reserve", stepId: "step-1", status: "reserve" }
  ];
  assert.deepEqual(stoneProgress(state, "s"), { done: 2, total: 3, percent: 67 });
});

test("XP events are idempotent and levels advance every 100 XP", () => {
  const state = createInitialState();
  assert.equal(addXP(state, 20, "action", "a1"), true);
  assert.equal(addXP(state, 20, "action", "a1"), false);
  assert.equal(state.xp.total, 20);
  assert.equal(levelFor(100).level, 2);
  assert.equal(levelFor(100).into, 0);
});

test("action XP combines the 5 XP base with the effort bonus", () => {
  assert.equal(pointsForAction({ effort: "S" }), 15);
  assert.equal(pointsForAction({ effort: "M" }), 25);
  assert.equal(pointsForAction({ effort: "L" }), 40);
  assert.equal(pointsForAction({ effort: "XL" }), 55);
  assert.equal(pointsForAction({ effort: "XXL" }), 75);
});

test("week boundaries are Monday through Sunday", () => {
  assert.equal(mondayISO(new Date("2026-09-29T12:00:00")), "2026-09-28");
  assert.equal(weekEndISO("2026-09-28"), "2026-10-04");
});

test("JSON export can be validated and restored", () => {
  const state = createInitialState();
  state.stones.push({ id: "s", title: "Projet" });
  state.actions.push({ id: "a", stoneId: "s", title: "Un pas", status: "reserve" });
  const restored = validateImport(exportObject(state));
  assert.equal(restored.stones.length, 1);
  assert.equal(restored.actions[0].title, "Un pas");
  assert.throws(() => validateImport({ app: "wrong", data: {} }));
});
