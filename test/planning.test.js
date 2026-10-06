import test from "node:test";
import assert from "node:assert/strict";
import { canPlaceInTimeSlot } from "../src/planning.js";

const action = (id, effort, status = "weekly") => ({ id, effort, status, plannedDate: "2026-10-06", slot: "morning" });

test("a slot can contain several small actions and mix them with one larger action", () => {
  const placed = [action("s1", "S"), action("s2", "S")];
  assert.equal(canPlaceInTimeSlot(placed, action("s3", "S")), true);
  assert.equal(canPlaceInTimeSlot(placed, action("m1", "M")), true);
  placed.push(action("m1", "M"));
  assert.equal(canPlaceInTimeSlot(placed, action("s4", "S")), true);
  assert.equal(canPlaceInTimeSlot(placed, action("l1", "L")), false);
});

test("rescheduling ignores the action itself and completed items do not occupy capacity", () => {
  const placed = [action("m1", "M"), action("done", "L", "done")];
  assert.equal(canPlaceInTimeSlot(placed, action("m1", "M")), true);
  assert.equal(canPlaceInTimeSlot(placed, action("l1", "L")), false);
  assert.equal(canPlaceInTimeSlot([action("done", "L", "done")], action("m2", "M")), true);
});
