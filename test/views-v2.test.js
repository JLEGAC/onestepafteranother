import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getCurrentWeek, todayISO } from "../src/data.js";
import { actionForm, appShell, renderPage, retroForm, scheduleActionForm, stoneForm, weeklyObjectiveForm, visionForm } from "../src/views.js";
import { habitForm, renderHabitsPage, selectHabitDate, selectHabitFilter } from "../src/engagement-views.js";
import { dateShift } from "../src/engagement.js";

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

test("weekly cap omits review and reserve sections while the review form remains available", () => {
  const state = createInitialState();
  const week = getCurrentWeek(state);
  const page = renderPage(state, "week");
  const dialog = retroForm(state);

  assert.equal(page.includes('data-action="retro"'), false);
  assert.equal(page.includes("Ma réserve"), false);
  assert.match(dialog, /<form id="retro-form">/);
  assert.match(dialog, new RegExp(`name="weekId" value="${week.id}"`));
  assert.match(dialog, /type="submit" class="button button-primary wide" form="retro-form">Clôturer ma semaine/);
});

test("new navigation and dashboard follow the requested screen order", () => {
  const state = createInitialState();
  const shell = appShell(state, "home");
  for (const label of ["Accueil", "Vision", "Objectifs", "Cap Hebdo", "Outils", "Réserve"]) assert.ok(shell.includes(label));
  assert.equal(shell.includes("Cible"), false);
  assert.ok(shell.includes("./logo.svg"));
  const home = renderPage(state, "home");
  const positions = ["Batterie", "MA VISION", "Mes habitudes", "Focus du jour", "Mes victoires"].map(label => home.indexOf(label));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(home.includes("De quoi es-tu fier·e aujourd’hui ?"));
  assert.ok(home.includes("Cette victoire te permettra-t-elle d’atteindre l’un de tes objectifs ?"));
});

test("dashboard hides check-in captions behind accessible legends and aligns the choice rows", () => {
  const home = renderPage(createInitialState(), "home");
  assert.equal((home.match(/data-energy="/g) || []).length, 4);
  assert.equal((home.match(/data-mood="/g) || []).length, 5);
  assert.ok(home.includes("<b>25%</b> Énergie basse"));
  assert.ok(home.includes("<b>50%</b> Énergie moyenne"));
  assert.ok(home.includes("<b>75%</b> Énergie haute"));
  assert.ok(home.includes("<b>100%</b> Énergie pleine"));
  assert.ok(home.includes('aria-label="Afficher la légende de la batterie"'));
  assert.ok(home.includes('aria-label="Afficher la légende de l’humeur"'));
  assert.equal(home.includes("<small>Rien ne va</small>"), false);
  assert.equal(home.includes('class="checkin-heading"'), true);
});

test("past habit controls are available without a 10-day unlock", () => {
  const state = createInitialState();
  state.habits.push({ id: "past-check", title: "Marcher", createdAtDate: dateShift(todayISO(), -20), active: true });
  selectHabitFilter("past-check");
  selectHabitDate(dateShift(todayISO(), -1));
  const html = renderHabitsPage(state);
  assert.ok(html.includes('data-action="toggle-habit-history"'));
  assert.ok(html.includes(">Ajouter</button>"));
  assert.equal(html.includes("🔒 10 jours"), false);
  assert.equal(html.includes("Après 10 jours"), false);
  selectHabitFilter("");
  selectHabitDate(todayISO());
});

test("Objectives page combines habits and objectives and hides the admin helper once the goal exists", () => {
  const state = createInitialState();
  state.habits.push({ id: "walk", title: "Marcher", active: true, linkedStoneId: "goal" });
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
  const form = habitForm(state.habits[0], state);
  assert.ok(form.includes("Déclencheur"));
  assert.equal(form.includes("linkedVision"), false);
  assert.ok(form.includes("🎯 Écrire"));
  assert.ok(visionForm(state, "essentials").includes("Mes importants"));
});

test("Vision has resonance images; weekly cap, history, and accessible planning expose their controls", () => {
  const state = createInitialState();
  state.profile.resonanceImages.push({ id: "image-1", name: "repere.jpg", dataUrl: "data:image/jpeg;base64,AA==" });
  const vision = renderPage(state, "vision");
  assert.ok(vision.includes("Ce qui résonne"));
  assert.ok(vision.includes("Ajouter des images"));
  assert.ok(vision.includes("repere.jpg"));
  assert.ok(vision.includes('data-action="view-resonance-image"'));
  assert.equal(vision.includes("Les énergies qui m’inspirent"), false);
  assert.ok(vision.indexOf("Ajouter des images") < vision.indexOf("word-cloud"));
  assert.equal(vision.includes("MES ESSENTIELS"), false);
  assert.ok(renderPage(state, "week").includes("OBJECTIF DE LA SEMAINE"));
  assert.ok(renderPage(state, "history").includes("Historique"));
  state.stones.push({ id: "goal", title: "Objectif test", icon: "🧭" });
  state.actions.push({ id: "reserve-1", title: "Action réservée", stoneId: "goal", status: "reserve" }, { id: "unassigned-1", title: "Tâche non planifiée", status: "unassigned" });
  const reserve = renderPage(state, "reserve");
  assert.ok(reserve.includes("<h1>Réserve</h1>"));
  assert.ok(reserve.includes("Action réservée"));
  assert.equal(reserve.includes("Tâche non planifiée"), false);
  const week = getCurrentWeek(state);
  week.objective = "Un cap libre";
  assert.ok(weeklyObjectiveForm(state).includes("Un cap libre"));
  state.actions.push({ id: "task-s", title: "Appeler le fournisseur", effort: "S", weekId: week.id, plannedDate: week.start, slot: "morning", status: "weekly" });
  const weeklyPage = renderPage(state, "week");
  assert.ok(weeklyPage.includes('data-drag-action="task-s"'));
  assert.ok(weeklyPage.includes('data-week-slot="true"'));
  assert.ok(weeklyPage.includes('data-action="complete-week-action"'));
  assert.ok(scheduleActionForm(state, state.actions[0]).includes("schedule-action-form"));
  assert.ok(scheduleActionForm(state, state.actions[0]).includes("Toute la journée"));
  assert.ok(weeklyPage.includes("Toute la journée"));
  assert.ok(weeklyPage.includes("＋ Ajouter une action"));
  assert.ok(weeklyPage.includes("Matin"));
  assert.equal(weeklyPage.includes("Midi"), false);
  assert.equal(weeklyPage.includes("Après-midi"), false);
  assert.equal(weeklyPage.includes("Soir"), false);
  assert.ok(weeklyPage.includes(`data-date="${week.start}" data-slot=""`));
});

test("weekly review safely renders structured victories", () => {
  const state = createInitialState();
  const week = state.weeks[0];
  state.daily[week.start] = { wins: [{ text: "J’ai avancé", relatedType: "stone", relatedId: "goal-1" }] };
  const html = retroForm(state, week.id);
  assert.ok(html.includes("J’ai avancé"));
  assert.equal(html.includes("[object Object]"), false);
});

test("latest interface choices keep objective symbol in its title and clean page headings", () => {
  const state = createInitialState();
  state.stones.push({ id: "goal", icon: "🏃", title: "Courir un 10 km" });
  state.steps.push({ id: "step", stoneId: "goal", title: "Préparation" });
  const form = stoneForm(state.stones[0]);
  assert.ok(form.includes('name="title"'));
  assert.equal(form.includes('name="icon"'), false);
  assert.ok(form.includes('name="due" type="date"'));
  assert.ok(form.includes("Bénéfice"));
  assert.ok(actionForm(state, null, "goal", "step").includes('value="step" selected'));
  const tools = renderPage(state, "tools");
  for (const removed of ["TES RESSOURCES", "Un petit coup de pouce", "OUTILS MINUTE", "MES RESSOURCES V2"]) assert.equal(tools.includes(removed), false);
  const week = renderPage(state, "week");
  assert.equal(week.includes("Mon planning hebdomadaire"), false);
  assert.equal(week.includes("🧭 Cap Hebdo"), false);
  assert.ok(renderPage(state, "profile").includes('data-setting="darkMode"'));
});
