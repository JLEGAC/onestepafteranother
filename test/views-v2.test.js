import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/data.js";
import { renderPage } from "../src/views.js";

test("V2 navigation targets render their page titles and primary actions", () => {
  const state = createInitialState();
  const cases = [
    ["habits", "Habitudes", "new-habit"],
    ["challenges", "Défis", "new-challenge"],
    ["capsules", "Capsules", "new-capsule"],
    ["rewards", "Mes récompenses", "data-theme-setting"]
  ];

  for (const [page, title, action] of cases) {
    const html = renderPage(state, page);
    assert.ok(html.includes(`<h1>${title}</h1>`), `${page} should render its title`);
    assert.ok(html.includes(action), `${page} should render its primary control`);
  }
});
