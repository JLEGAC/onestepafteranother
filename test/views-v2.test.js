import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getCurrentWeek } from "../src/data.js";
import { appShell, renderPage, retroForm, scheduleActionForm, weeklyObjectiveForm } from "../src/views.js";

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

test("weekly review button opens a form whose footer submits that form", () => {
  const state = createInitialState();
  const week = getCurrentWeek(state);
  const page = renderPage(state, "week");
  const dialog = retroForm(state);

  assert.match(page, /type="button" class="button button-soft" data-action="retro">Faire mon bilan<\/button>/);
  assert.match(dialog, /<form id="retro-form">/);
  assert.match(dialog, new RegExp(`name="weekId" value="${week.id}"`));
  assert.match(dialog, /type="submit" class="button button-primary wide" form="retro-form">Clôturer ma semaine/);
});

test("new navigation and dashboard follow the requested screen order", () => {
  const state = createInitialState();
  const shell = appShell(state, "home");
  for (const label of ["Accueil", "Vision", "Cible", "Cap Hebdo", "Outils"]) assert.ok(shell.includes(label));
  assert.equal(shell.includes("Réserve"), false);
  assert.ok(shell.includes("./logo.svg"));
  const home = renderPage(state, "home");
  const positions = ["Batterie", "MA VISION", "MES HABITUDES", "FOCUS DU JOUR", "MES VICTOIRES"].map(label => home.indexOf(label));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(home.includes("De quoi es-tu fier·e aujourd’hui ?"));
  assert.ok(home.includes("Cette victoire te permettra-t-elle d’atteindre l’un de tes objectifs ?"));
});

test("Cible combines habits and objectives and hides the admin helper once the goal exists", () => {
  const state = createInitialState();
  state.habits.push({ id: "walk", title: "Marcher", active: true, linkedVision: true });
  state.stones.push({ id: "goal", title: "Écrire" });
  let html = renderPage(state, "cible");
  assert.ok(html.includes("Mes objectifs et habitudes"));
  assert.ok(html.includes("Marcher"));
  assert.ok(html.includes("linked-star"));
  assert.ok(html.includes("Ajouter une action"));
  assert.ok(html.includes("Gestion, admin & obligations"));
  state.stones.push({ id: "admin", title: "Gestion admin et obligations" });
  html = renderPage(state, "cible");
  assert.equal(html.includes("Tu peux aussi créer un objectif"), false);
});

test("Vision has resonance images; weekly cap, history, and accessible planning expose their controls", () => {
  const state = createInitialState();
  state.profile.resonanceImages.push({ id: "image-1", name: "repere.jpg", dataUrl: "data:image/jpeg;base64,AA==" });
  const vision = renderPage(state, "vision");
  assert.ok(vision.includes("Ce qui résonne"));
  assert.ok(vision.includes("Ajouter des images"));
  assert.ok(vision.includes("repere.jpg"));
  assert.equal(vision.includes("Les énergies qui m’inspirent"), false);
  assert.ok(renderPage(state, "week").includes("OBJECTIF DE LA SEMAINE"));
  assert.ok(renderPage(state, "history").includes("Historique"));
  assert.equal(renderPage(state, "reserve").includes("<h1>Réserve</h1>"), false);
  const week = getCurrentWeek(state);
  week.objective = "Un cap libre";
  assert.ok(weeklyObjectiveForm(state).includes("Un cap libre"));
  state.actions.push({ id: "task-s", title: "Appeler le fournisseur", effort: "S", weekId: week.id, plannedDate: week.start, slot: "morning", status: "weekly" });
  const weeklyPage = renderPage(state, "week");
  assert.ok(weeklyPage.includes('data-drag-action="task-s"'));
  assert.ok(weeklyPage.includes('data-week-slot="true"'));
  assert.ok(weeklyPage.includes('data-action="complete-week-action"'));
  assert.ok(scheduleActionForm(state, state.actions[0]).includes("schedule-action-form"));
});

test("weekly review safely renders structured victories", () => {
  const state = createInitialState();
  const week = state.weeks[0];
  state.daily[week.start] = { wins: [{ text: "J’ai avancé", relatedType: "stone", relatedId: "goal-1" }] };
  const html = retroForm(state, week.id);
  assert.ok(html.includes("J’ai avancé"));
  assert.equal(html.includes("[object Object]"), false);
});
