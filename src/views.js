import { getCurrentWeek, mondayISO, stoneProgress, todayISO, weekEndISO } from "./data.js";
import { levelFor } from "./gamification.js";
import { activeHabits, habitStreak, isHabitDone, dateShift } from "./engagement.js";
import { renderCapsulesPage, renderChallengesPage, renderHabitHome, renderHabitsPage, renderRewardsPage } from "./engagement-views.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const safeHref = value => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
const effortMeta = { S: ["S", "⚡", "moins de 15 min"], M: ["M", "🐾", "15 à 30 min"], L: ["L", "💪", "une demi-journée à 2 jours"], XL: ["XL", "🗻", "une semaine"], XXL: ["XXL", "🪨", "un rocher à découper"] };
const slots = [["morning", "🌅", "Matin"], ["noon", "☀️", "Midi"], ["afternoon", "🌤️", "Après-midi"], ["evening", "🌙", "Soir"]];

export function appShell(state, page) {
  const level = levelFor(state.xp.total);
  const tabs = [["home", "📊", "Accueil"], ["vision", "🏝️", "Vision"], ["cible", "🎯", "Cible"], ["week", "🧭", "Cap Hebdo"], ["tools", "🧰", "Outils"]];
  const activePage = page === "stones" || page === "habits" ? "cible" : page;
  return `<header class="topbar"><a class="brand" href="#home" data-page="home" aria-label="Un pas après l’autre — Accueil"><img src="./logo.svg" alt="Un pas après l’autre"></a><div class="topbar-actions"><button class="xp-pill" data-page="profile" aria-label="Mes points d’expérience"><span>✨</span><span><b>${state.xp.total}</b><small>XP</small></span><span class="level-mini">Niv. ${level.level}</span></button><button class="header-icon" data-page="profile" aria-label="Ouvrir mon profil">👤</button><button class="header-icon" data-page="history" aria-label="Ouvrir l’historique">📅</button></div></header>
    <main id="page-content" class="page-content">${renderPage(state, page)}</main>
    <nav class="bottom-nav" aria-label="Navigation principale">${tabs.map(([id, icon, label]) => `<button type="button" data-page="${id}" class="nav-item ${activePage === id ? "active" : ""}" aria-current="${activePage === id ? "page" : "false"}"><span>${icon}</span><small>${label}</small></button>`).join("")}</nav>`;
}

export function renderPage(state, page) {
  if (page === "week") return renderWeek(state);
  if (page === "stones" || page === "cible") return renderCiblePage(state);
  if (page === "tools") return renderTools(state);
  if (page === "vision") return renderVision(state);
  if (page === "profile") return renderProfile(state);
  if (page === "habits") return renderHabitsPage(state);
  if (page === "history") return renderHistoryPage(state);
  if (page === "wins") return renderWinsPage(state);
  if (page === "challenges") return renderChallengesPage(state);
  if (page === "capsules") return renderCapsulesPage(state);
  if (page === "rewards") return renderRewardsPage(state);
  return renderHome(state);
}

function renderHome(state) {
  const week = getCurrentWeek(state);
  const today = todayISO();
  const daily = state.daily[today] || {};
  const focused = state.actions.filter(a => a.weekId === week.id && a.plannedDate === today && ["weekly", "done"].includes(a.status));
  const vision = state.profile.vision || "Ta vision commence par une phrase.";
  const pendingRetros = state.weeks.filter(item => item.id !== week.id && !item.retro).sort((a, b) => b.start.localeCompare(a.start));
  return `${state.preferences.gentleReminders && !daily.dismissedReminder && (!daily.energy || !daily.mood) ? `<div class="gentle-reminder"><span>🌤️</span><span>Un petit point avec toi-même ? Tu peux le faire quand tu en as envie.</span><button class="icon-button" data-action="dismiss-reminder" aria-label="Plus tard">×</button></div>` : ""}${pendingRetros.length ? `<div class="gentle-reminder retro-reminder"><span>✨</span><span>Un bilan de semaine t’attend. Choisis le moment qui te convient.</span><button type="button" class="text-button" data-action="retro" data-week="${pendingRetros[0].id}">Le faire →</button></div>` : ""}<section class="checkin-card dashboard-checkin"><div class="dashboard-checkin-block"><h2>Batterie</h2><div class="energy-options">${[25, 50, 75, 100].map(n => `<button type="button" data-energy="${n}" class="energy-choice ${daily.energy === n ? "selected" : ""}">${n}%</button>`).join("")}</div></div><div class="dashboard-checkin-block"><h2>Humeur</h2><div class="moods">${[["😣", "Difficile"], ["😔", "Bas"], ["😴", "Fatigué"], ["🙂", "Bien"], ["😄", "Joyeux"], ["🥰", "Très bien"]].map(([emoji, label]) => `<button type="button" data-mood="${emoji}" class="mood-choice ${daily.mood === emoji ? "selected" : ""}" aria-label="${label}">${emoji}</button>`).join("")}</div></div></section>
    <section class="vision-strip"><div class="vision-orb">✦</div><div><div class="eyebrow">MA VISION</div><p>« ${esc(vision)} »</p></div><button type="button" class="icon-button" data-page="vision" aria-label="Ouvrir ma vision">✎</button></section>
    ${renderHabitHome(state)}
    <section class="section"><div class="section-heading"><div><div class="eyebrow">FOCUS DU JOUR</div><h2>Mes actions du jour</h2></div><button type="button" class="text-button" data-page="week">Voir la semaine complète 🧭</button></div>${focused.length ? focused.map(a => actionCard(state, a, true)).join("") : `<div class="empty-card slim"><p>Aucune action choisie pour aujourd’hui. Tu peux garder cette journée libre.</p></div>`}</section>
    <section class="section win-section"><div class="section-heading"><div><div class="eyebrow">MES VICTOIRES</div><h2>De quoi es-tu fier·e aujourd’hui ?</h2></div><button type="button" class="text-button" data-page="wins">Voir toutes mes victoires 🏆</button></div><form class="victory-form" id="win-form"><div class="inline-add"><input name="win" maxlength="180" placeholder="De quoi es-tu fier·e aujourd’hui ?" aria-label="Ajouter une victoire" required><button type="submit" class="add-button" aria-label="Ajouter">+</button></div><label class="victory-link-label">Cette victoire te permettra-t-elle d’atteindre l’un de tes objectifs ? <small>(facultatif)</small><select name="related"><option value="">Je ne souhaite pas la lier</option>${state.stones.map(stone => `<option value="stone:${esc(stone.id)}">🎯 ${esc(stone.title)}</option>`).join("")}${state.actions.filter(action => action.status !== "abandoned" && action.status !== "split").map(action => `<option value="action:${esc(action.id)}">↳ ${esc(action.title)}</option>`).join("")}</select></label></form><div class="win-list">${(daily.wins || []).map((win, i) => renderVictoryItem(state, win, i)).join("")}</div></section>`;
}

function actionCard(state, action, compact = false, inWeekList = false) {
  const stone = state.stones.find(s => s.id === action.stoneId);
  const meta = effortMeta[action.effort] || effortMeta.M;
  const primaryButton = action.status === "unassigned"
    ? `<button class="button button-outline button-small" data-action="edit-action" data-id="${action.id}">Rattacher à une pierre</button>`
    : action.status === "reserve"
      ? `<button class="button button-soft button-small" data-action="plan-action" data-id="${action.id}">Embarquer</button>`
      : `<button class="button button-complete button-small" data-action="complete-action" data-id="${action.id}">✓ Terminer</button>`;
  const plannedDay = action.plannedDate ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${action.plannedDate}T12:00:00`)) : "";
  const scheduleHandle = inWeekList && action.status !== "done" ? `<button type="button" class="week-drag-handle" data-action="schedule-action" data-id="${esc(action.id)}" data-drag-action="${esc(action.id)}" aria-label="Déplacer ${esc(action.title)} vers un créneau" title="Glisser vers un créneau ou sélectionner pour choisir">⠿</button>` : "";
  return `<article class="action-card ${action.status === "done" ? "is-done" : ""} ${compact ? "compact" : ""}"><div class="action-top"><span class="stone-label">${stone ? `${esc(stone.icon || "💎")} ${esc(stone.title)}` : "À rattacher à une Grande Pierre"}</span><span class="effort-chip effort-${meta[0].toLowerCase()}">${meta[1]} ${meta[0]}</span>${scheduleHandle}</div><h3>${esc(action.title)}</h3>${action.criteria ? `<p class="criteria"><span>✓</span> Fait quand : ${esc(action.criteria)}</p>` : ""}${action.status === "done" ? `<div class="done-ribbon">✨ Bravo, ce pas est accompli !</div>` : `<div class="action-footer">${action.slot || plannedDay ? `<span class="slot-tag">${plannedDay ? `📅 ${plannedDay} · ` : ""}${action.slot ? `${slots.find(s => s[0] === action.slot)?.[1] || ""} ${slots.find(s => s[0] === action.slot)?.[2] || ""}` : ""}</span>` : `<span class="reserve-tag">${action.status === "unassigned" ? "À rattacher" : action.status === "weekly" ? "Dans mon Cap" : "Dans ma réserve"}</span>`}<div class="action-buttons">${primaryButton}${action.status === "weekly" && !action.plannedDate ? `<button class="block-button" data-action="plan-today" data-id="${action.id}">Aujourd’hui</button>` : ""}${action.status === "weekly" ? `<button class="block-button" data-action="blocked" data-id="${action.id}">Je bloque</button>` : ""}<button class="more-button" data-action="edit-action" data-id="${action.id}" aria-label="Modifier l’action">···</button></div></div>`}</article>`;
}

function renderWeek(state) {
  const week = getCurrentWeek(state);
  const actions = state.actions.filter(a => a.weekId === week.id);
  const done = actions.filter(a => a.status === "done").length;
  const percent = actions.length ? Math.round(done / actions.length * 100) : 0;
  const fmt = date => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
  const remaining = state.actions.filter(a => a.status === "reserve" || a.status === "unassigned");
  const unassigned = remaining.filter(a => a.status === "unassigned");
  const reserve = remaining.filter(a => a.status === "reserve");
  const pendingRetros = state.weeks.filter(item => item.id !== week.id && !item.retro).sort((a, b) => b.start.localeCompare(a.start));
  const weekNumber = isoWeekNumber(week.start);
  const days = Array.from({ length: 7 }, (_, index) => dateShift(week.start, index));
  return `<div class="page-title-row"><div><div class="eyebrow">TON RYTHME, TON CAP</div><h1>🧭 Cap Hebdo <small class="week-number">Semaine ${weekNumber}</small></h1></div><button type="button" class="round-add" data-action="new-action" aria-label="Ajouter une action">+</button></div>
    <section class="week-objective"><div class="week-objective-icon">🎯 ➜</div><div><div class="eyebrow">OBJECTIF DE LA SEMAINE</div><p>${esc(week.objective || "Quel cap prioritaire veux-tu garder cette semaine ?")}</p></div><button type="button" class="icon-button" data-action="edit-weekly-objective" aria-label="Définir l’objectif de la semaine">✎</button></section>
    <section class="week-progress"><div class="week-dates">Semaine du ${fmt(week.start)} au ${fmt(week.end)}</div><div class="progress-label"><span>${done}/${actions.length} actions accomplies</span><b>${percent}%</b></div><div class="progress-track"><span style="width:${percent}%"></span></div><p>Chaque petit pas compte. Ajuste ton cap selon ta vraie semaine.</p></section>
    ${pendingRetros.length ? `<section class="section"><div class="eyebrow">À TON RYTHME</div>${pendingRetros.map(item => `<div class="retro-callout"><div class="retro-icon">✦</div><div><b>Le bilan de la semaine du ${fmt(item.start)} attend ton regard.</b><p>Tu peux le faire maintenant ou plus tard.</p></div><button type="button" class="button button-soft" data-action="retro" data-week="${item.id}">Ouvrir</button></div>`).join("")}</section>` : ""}
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES ACTIONS À ACCOMPLIR</div><h2>Les actions de mon Cap</h2></div><span class="count-badge">${actions.length}</span></div>${actions.length ? actions.map(a => actionCard(state, a, false, true)).join("") : `<div class="empty-card slim"><span class="empty-icon">🧭</span><h3>Ton Cap est encore ouvert.</h3><p>Choisis une action dans un objectif, ou crée une nouvelle action.</p><button type="button" class="button button-primary" data-action="new-action">Ajouter une action <span>↗</span></button></div>`}</section>
    ${renderWeekCalendar(state, days)}
    ${unassigned.length ? `<section class="section"><div class="section-heading"><div><div class="eyebrow">INBOX</div><h2>À rattacher</h2></div><span class="count-badge muted">${unassigned.length}</span></div><p class="section-copy">Ces actions attendent leur Grande Pierre avant de rejoindre ton Cap.</p>${unassigned.map(a => actionCard(state, a)).join("")}</section>` : ""}
    <section class="section"><div class="section-heading"><div><div class="eyebrow">PROCHAINES POSSIBILITÉS</div><h2>Ma réserve</h2></div><span class="count-badge muted">${reserve.length}</span></div>${reserve.slice(0, 5).map(a => actionCard(state, a)).join("")}${reserve.length > 5 ? `<button class="text-button center" data-page="stones">Voir les ${reserve.length - 5} autres →</button>` : ""}</section>
    <div class="stack-buttons"><button type="button" class="button button-primary wide" data-action="new-action">＋ Ajouter une action</button><button type="button" class="button button-outline wide" data-page="cible">🎯 Choisir un objectif</button></div>
    <section class="retro-callout"><div class="retro-icon">✦</div><div><b>Une semaine à célébrer ?</b><p>Prends un instant pour voir tout le chemin parcouru.</p></div><button type="button" class="button button-soft" data-action="retro">Faire mon bilan</button></section>`;
}

function renderWeekCalendar(state, days) {
  const labels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const slotsByDay = [["morning", "🌅 Matin"], ["noon", "☀️ Midi"], ["afternoon", "🌤️ Après-midi"], ["evening", "🌙 Soir"]];
  return `<section class="section"><div class="section-heading"><div><div class="eyebrow">MON PLANNING HEBDOMADAIRE</div><h2>Mes blocs de temps</h2></div></div><p class="form-hint">Glisse une action vers un créneau. Sur téléphone, appuie sur ⠿ pour choisir le jour et le moment.</p><div class="week-calendar-viewport"><div class="week-calendar-track">${days.map((date, index) => `<article class="week-day-column"><h3>${labels[index]} <small>${date.slice(-2)}</small></h3>${slotsByDay.map(([slot, label]) => { const items = state.actions.filter(action => action.plannedDate === date && action.slot === slot && action.status !== "abandoned" && action.status !== "split"); return `<section class="week-time-slot" data-week-slot="true" data-date="${date}" data-slot="${slot}" tabindex="0" aria-label="${labels[index]}, ${label.replace(/[🌅☀️🌤️🌙]/gu, "")}"><b>${label}</b>${items.map(action => `<label class="week-slot-action ${action.status === "done" ? "is-done" : ""}"><input type="checkbox" data-action="complete-week-action" data-id="${esc(action.id)}" ${action.status === "done" ? "checked disabled" : ""} aria-label="Marquer ${esc(action.title)} comme faite"><span>${esc(action.title)}</span></label>`).join("") || `<small class="slot-empty">Déposer ici</small>`}</section>`; }).join("")}</article>`).join("")}</div></div></section>`;
}

function isoWeekNumber(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

function renderStones(state) {
  const hasAdminGoal = state.stones.some(stone => /gestion.*admin.*obligation/i.test(stone.title.replace(/[,&]/g, " ")));
  return `${state.stones.length ? `<div class="stone-grid">${state.stones.map(stone => stoneCard(state, stone)).join("")}</div>` : `<div class="empty-card"><span class="empty-icon">🎯</span><h3>Qu’est-ce qui compte vraiment pour toi ?</h3><p>Crée un objectif, puis découpe-le en actions concrètes.</p><button type="button" class="button button-primary" data-action="new-stone">Créer mon premier objectif <span>↗</span></button></div>`}
    ${!hasAdminGoal ? `<div class="soft-note"><span>🌱</span><p>Tu peux aussi créer un objectif <b>Gestion, admin & obligations</b> pour les tâches nécessaires à ton quotidien. <button type="button" class="text-button" data-action="new-admin-stone">Le créer maintenant →</button></p></div>` : ""}`;
}

function renderCiblePage(state) {
  const habits = activeHabits(state);
  const vision = state.profile.vision || "Ta vision commence par une phrase.";
  return `<div class="page-title-row"><div><div class="eyebrow">TES REPÈRES ET TES PAS</div><h1>Mes objectifs et habitudes</h1></div></div>
    <section class="vision-strip"><div class="vision-orb">✦</div><div><div class="eyebrow">MA VISION</div><p>« ${esc(vision)} »</p></div><button type="button" class="icon-button" data-page="vision" aria-label="Ouvrir ma vision">✎</button></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES RITUELS</div><h2>Mes habitudes</h2></div><button type="button" class="text-button" data-action="new-habit">＋ Ajouter une habitude</button></div>
    ${habits.length ? `<div class="cible-habits">${habits.map(habit => {
      const streak = habitStreak(state, habit.id);
      const linked = Boolean(habit.linkedStoneId || habit.linkedVision);
      const streakText = streak === 1 ? "Premier jour" : streak === 2 ? "Deuxième jour" : streak >= 3 ? `Série de ${streak} jours` : "À commencer quand tu veux";
      return `<article class="cible-habit-row"><button type="button" class="habit-check ${isHabitDone(state, habit.id) ? "checked" : ""}" data-action="toggle-habit" data-id="${esc(habit.id)}" aria-label="${isHabitDone(state, habit.id) ? "Décocher" : "Valider"} ${esc(habit.title)}">${isHabitDone(state, habit.id) ? "✓" : ""}</button><button type="button" class="cible-habit-copy" data-action="edit-habit" data-id="${esc(habit.id)}"><b>${esc(habit.emoji || "🌱")} ${esc(habit.title)} ${linked ? `<span class="linked-star" aria-label="Reliée à un objectif ou à la Vision">✨</span>` : ""}</b><small>${esc(streakText)}</small></button><button type="button" class="more-button" data-action="edit-habit" data-id="${esc(habit.id)}" aria-label="Modifier ${esc(habit.title)}">✎</button></article>`;
    }).join("")}</div>` : `<div class="empty-card slim"><p>Ajoute les habitudes qui te soutiennent, sans chercher à tout changer d’un coup.</p><button type="button" class="button button-primary" data-action="new-habit">＋ Ajouter une habitude</button></div>`}
    <button type="button" class="text-button" data-page="habits">Voir le calendrier des habitudes →</button></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">LES PROJETS QUI COMPTENT</div><h2>Mes objectifs</h2></div><button type="button" class="round-add" data-action="new-stone" aria-label="Créer un objectif">+</button></div>${renderStones(state)}</section>`;
}

function stoneCard(state, stone) {
  const progress = stoneProgress(state, stone.id);
  const reserve = state.actions.filter(a => a.stoneId === stone.id && a.status !== "done" && a.status !== "abandoned" && a.status !== "split").length;
  return `<article class="stone-card"><button type="button" class="stone-card-main" data-action="stone-detail" data-id="${stone.id}"><div class="stone-card-icon">${esc(stone.icon || "🎯")}</div><div class="stone-card-content"><h2>${esc(stone.title)}</h2><p>${progress.done} actions accomplies · ${reserve} à venir</p></div><div class="stone-percent">${progress.percent}%</div></button><div class="progress-track small"><span style="width:${progress.percent}%"></span></div><div class="stone-card-bottom"><span>${progress.total} action${progress.total > 1 ? "s" : ""}</span><button type="button" class="text-button" data-action="new-action" data-stone="${stone.id}">＋ Ajouter une action</button></div></article>`;
}

function renderVision(state) {
  const profile = state.profile;
  return `<div class="page-title-row"><div><div class="eyebrow">MA BOUSSOLE</div><h1>Ma Vision</h1></div><button class="icon-button larger" data-action="edit-vision" aria-label="Modifier ma vision">✎</button></div>
    <section class="vision-quote-card"><span class="quote-mark">“</span><p>${esc(profile.vision || "Ta phrase courte de vision apparaîtra ici.")}</p><small>MA VISION, EN QUELQUES MOTS</small></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES ESSENTIELS</div><h2>Ce qui guide mes choix</h2></div><button class="text-button" data-action="edit-essentials">Modifier</button></div>${profile.essentials.length ? `<div class="essential-list">${profile.essentials.map((item, i) => `<div class="essential-item"><span class="essential-number">0${i + 1}</span><span>${esc(item)}</span><span class="essential-spark">✦</span></div>`).join("")}</div>` : `<div class="empty-card slim"><p>Ajoute tes essentiels pour les retrouver dans l’outil « Éclairer un choix ».</p><button class="button button-soft" data-action="edit-essentials">＋ Ajouter mes essentiels</button></div>`}</section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MON RÉCIT</div><h2>La vie que je veux bâtir</h2></div><button class="icon-button" data-action="edit-story" aria-label="Modifier mon récit">✎</button></div><div class="story-card">${profile.story ? `<p>${esc(profile.story).replace(/\n/g, "<br>")}</p>` : `<p class="muted-copy">Quelques lignes pour imaginer les journées vers lesquelles tu avances. Tu pourras compléter ce récit quand tu le souhaites.</p>`}<button class="text-button" data-action="edit-story">${profile.story ? "Enrichir mon récit" : "Commencer mon récit"} →</button></div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES REPÈRES</div><h2>Ce qui résonne</h2></div><button type="button" class="text-button" data-action="edit-resonance">Modifier</button></div><div class="word-cloud">${profile.resonance.length ? profile.resonance.map((word, i) => `<span class="word-chip word-${i % 4}">${esc(word)}</span>`).join("") : `<span class="muted-copy">Les mots qui te ressemblent ou t’aident à avancer.</span>`}</div><div class="vision-media-actions"><button type="button" class="button button-outline" data-action="edit-resonance">＋ Ajouter des mots</button><label class="button button-outline">＋ Ajouter des images<input id="resonance-image-input" type="file" accept="image/*" multiple hidden></label></div>${profile.resonanceImages?.length ? `<div class="vision-image-grid">${profile.resonanceImages.map(image => `<figure><img src="${image.dataUrl}" alt="${esc(image.name || "Image liée à ma Vision")}" loading="lazy"><button type="button" class="remove-win" data-action="remove-resonance-image" data-id="${esc(image.id)}" aria-label="Retirer cette image">×</button></figure>`).join("")}</div>` : ""}</section>`;
}

function renderVictoryItem(state, value, index = null, date = "") {
  const win = typeof value === "string" ? { text: value } : (value || {});
  const linked = win.relatedType === "stone"
    ? state.stones.find(stone => stone.id === win.relatedId)
    : win.relatedType === "action" ? state.actions.find(action => action.id === win.relatedId) : null;
  const label = linked ? `${win.relatedType === "stone" ? "🎯" : "↳"} ${linked.title}` : "";
  const formattedDate = date ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "";
  return `<div class="win-item"><span>✦</span><span class="win-copy">${esc(win.text || "")}${label ? `<small class="victory-related">${esc(label)}</small>` : ""}${formattedDate ? `<small>${esc(formattedDate)}</small>` : ""}</span>${index !== null ? `<button type="button" class="remove-win" data-remove-win="${index}" aria-label="Supprimer cette victoire">×</button>` : ""}</div>`;
}

let selectedHistoryDate = todayISO();

export function shiftHistoryDate(days) {
  selectedHistoryDate = dateShift(selectedHistoryDate, days);
  if (selectedHistoryDate > todayISO()) selectedHistoryDate = todayISO();
}

export function selectHistoryDate(date) {
  if (date <= todayISO()) selectedHistoryDate = date;
}

function renderHistoryPage(state) {
  const date = selectedHistoryDate;
  const start = mondayISO(new Date(`${date}T12:00:00`));
  const end = weekEndISO(start);
  const dates = Array.from({ length: 7 }, (_, index) => dateShift(start, index));
  const day = state.daily[date] || {};
  const actions = state.actions.filter(action => action.plannedDate === date || action.completedAt?.slice(0, 10) === date);
  const habits = state.habits.filter(habit => {
    const created = habit.createdAtDate || habit.createdAt?.slice(0, 10) || "0000-00-00";
    return created <= date && (!habit.archivedAt || date <= habit.archivedAt);
  });
  const wins = day.wins || [];
  const weekActions = state.actions.filter(action => (action.plannedDate >= start && action.plannedDate <= end) || (action.completedAt?.slice(0, 10) >= start && action.completedAt?.slice(0, 10) <= end));
  const selectedLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
  const weekLabel = `${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${start}T12:00:00`))} – ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${end}T12:00:00`))}`;
  return `<div class="page-title-row"><div><div class="eyebrow">TES TRACES</div><h1>Historique</h1><p class="page-subtitle">Retrouve ce que tu as vécu et accompli.</p></div></div>
    <section class="history-week-card"><div class="history-week-heading"><button type="button" class="icon-button" data-action="history-shift" data-days="-7" aria-label="Semaine précédente">‹</button><b>Semaine du ${esc(weekLabel)}</b><button type="button" class="icon-button" data-action="history-shift" data-days="7" aria-label="Semaine suivante" ${end >= todayISO() ? "disabled" : ""}>›</button></div><div class="history-week-days">${dates.map(dayDate => { const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(`${dayDate}T12:00:00`)); const number = Number(dayDate.slice(-2)); return `<button type="button" data-action="history-date" data-date="${dayDate}" class="history-date ${dayDate === date ? "selected" : ""}" ${dayDate > todayISO() ? "disabled" : ""}><small>${esc(label)}</small><b>${number}</b></button>`; }).join("")}</div><div class="history-week-summary">${weekActions.filter(action => action.status === "done").length} action(s) terminée(s) · ${weekActions.length} planifiée(s) ou réalisée(s)</div></section>
    <div class="history-day-heading"><button type="button" class="icon-button" data-action="history-shift" data-days="-1" aria-label="Jour précédent">‹</button><h2>${esc(selectedLabel)}</h2><button type="button" class="icon-button" data-action="history-shift" data-days="1" aria-label="Jour suivant" ${date >= todayISO() ? "disabled" : ""}>›</button></div>
    <section class="section history-grid"><article class="history-card"><h3>Mon point du jour</h3><p>⚡ Batterie : ${day.energy ? `${day.energy} %` : "non renseignée"}</p><p>🙂 Humeur : ${day.mood ? esc(day.mood) : "non renseignée"}</p></article><article class="history-card"><h3>Mes habitudes</h3>${habits.length ? habits.map(habit => `<p>${isHabitDone(state, habit.id, date) ? "🟢" : "⚪"} ${esc(habit.title)}</p>`).join("") : `<p>Aucune habitude pour cette date.</p>`}</article></section>
    <section class="section"><div class="section-heading"><h2>Mes actions</h2><span class="count-badge">${actions.length}</span></div>${actions.length ? actions.map(action => `<article class="history-action ${action.status === "done" ? "is-done" : ""}"><b>${action.status === "done" ? "✓" : "○"} ${esc(action.title)}</b><small>${esc(state.stones.find(stone => stone.id === action.stoneId)?.title || "Sans objectif")} · ${action.status === "done" ? "Terminée" : "Prévue"}</small></article>`).join("") : `<div class="empty-card slim"><p>Aucune action prévue ou terminée ce jour-là.</p></div>`}</section>
    <section class="section"><div class="section-heading"><h2>Mes victoires</h2><button type="button" class="text-button" data-page="wins">Tout voir →</button></div>${wins.length ? wins.map(win => renderVictoryItem(state, win)).join("") : `<p class="muted-copy">Aucune victoire notée ce jour-là.</p>`}</section>`;
}

function renderWinsPage(state) {
  const allWins = Object.entries(state.daily).flatMap(([date, day]) => (day.wins || []).map(win => ({ date, win }))).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-title-row"><div><div class="eyebrow">LIVRE D’OR</div><h1>Mes victoires</h1><p class="page-subtitle">Tous ces petits pas méritent d’être gardés.</p></div><span class="count-badge">${allWins.length}</span></div>${allWins.length ? allWins.map(item => renderVictoryItem(state, item.win, null, item.date)).join("") : `<div class="empty-card"><span class="empty-icon">🏆</span><h3>Ton livre d’or commence ici</h3><p>Une fierté, un choix ou un moment important peut devenir une victoire à garder.</p><button type="button" class="button button-primary" data-page="home">Ajouter ma première victoire</button></div>`}<button type="button" class="button button-outline wide" data-page="home">← Retour à l’accueil</button>`;
}

function renderTools(state) {
  const level = levelFor(state.xp.total);
  return `<div class="page-title-row"><div><div class="eyebrow">TES RESSOURCES</div><h1>Boîte à outils</h1><p class="page-subtitle">Un petit coup de pouce quand tu en as besoin.</p></div><div class="tool-points">✨ ${state.xp.total}</div></div>
    <section class="section"><div class="eyebrow">DE QUOI AS-TU BESOIN ?</div><div class="need-grid"><button class="need-chip" data-tool-filter="serenity">🌿 Sérénité</button><button class="need-chip" data-tool-filter="focus">🎯 Focus</button><button class="need-chip" data-tool-filter="inspiration">💖 Inspiration</button><button class="need-chip" data-tool-filter="boost">🔋 Coup de boost</button></div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">OUTILS MINUTE</div><h2>À portée de main</h2></div><button class="text-button" data-action="new-tool">＋ Ajouter</button></div><div class="tool-card" data-categories="serenity"><div class="tool-icon green">〰</div><div class="tool-copy"><h3>Respiration carrée</h3><p>4 secondes pour inspirer, garder, expirer et faire une pause.</p><button class="button button-soft" data-action="breathing">Lancer l’exercice <span>↗</span></button></div></div><div class="tool-card" data-categories="focus inspiration"><div class="tool-icon gold">⚖</div><div class="tool-copy"><h3>Éclairer un choix</h3><p>Prends une décision en la confrontant à tes essentiels.</p><button class="button button-soft" data-action="decision">Ouvrir l’outil <span>↗</span></button></div></div><div class="tool-card" data-categories="boost"><div class="tool-icon coral"><span>✦</span></div><div class="tool-copy"><h3>Rappelle-toi tes victoires</h3><p>Relis un pas déjà accompli pour retrouver ton élan.</p><button class="button button-soft" data-action="past-wins">Retrouver mes victoires <span>↗</span></button></div></div>${(state.tools || []).map(tool => `<div class="tool-card custom-tool" data-categories="${esc(tool.category || "inspiration")}"><div class="tool-icon lilac">${esc(tool.emoji || "✦")}</div><div class="tool-copy"><h3>${esc(tool.title)}</h3><p>${esc(tool.description)}</p>${safeHref(tool.url) ? `<a class="button button-soft" href="${esc(safeHref(tool.url))}" target="_blank" rel="noopener">Ouvrir la ressource ↗</a>` : ""}</div><button class="remove-win" data-action="remove-tool" data-id="${tool.id}" aria-label="Supprimer l’outil">×</button></div>`).join("")}</section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES RESSOURCES V2</div><h2>Grandir à mon rythme</h2></div></div><div class="feature-links"><button data-page="habits"><span>🌱</span><b>Suivi des habitudes</b><small>${state.habits.filter(item => item.active !== false).length} active(s) · calendrier et séries</small><i>→</i></button><button data-page="challenges"><span>🎯</span><b>Défis du Cap</b><small>${state.challenges.filter(item => item.status === "active").length} en cours · sans pénalité</small><i>→</i></button><button data-page="capsules"><span>🎬</span><b>Capsules vidéo</b><small>${state.capsules.length} dans ma collection</small><i>→</i></button><button data-page="rewards"><span>🏆</span><b>Mes récompenses</b><small>Badges et ambiances débloquées</small><i>→</i></button></div></section>
    <section class="xp-card"><div class="xp-orbit">✦</div><div><div class="eyebrow">TON ÉLAN</div><h2>Niveau ${level.level} · ${level.title}</h2><p>${level.into} / 100 XP vers le prochain niveau</p><div class="level-track"><span style="width:${level.into}%"></span></div></div></section>`;
}

function renderProfile(state) {
  return `<div class="page-title-row"><div><div class="eyebrow">TON ESPACE, TES RÈGLES</div><h1>Profil</h1></div><span class="profile-orb">✦</span></div><section class="xp-profile-card"><div class="big-xp">✨ ${state.xp.total}</div><div class="eyebrow">POINTS D’ÉLAN</div><p>Chaque pas nourrit ta progression et débloque des options de personnalisation.</p><div class="level-track"><span style="width:${levelFor(state.xp.total).into}%"></span></div><b>Niveau ${levelFor(state.xp.total).level} · ${levelFor(state.xp.total).title}</b><button class="button button-soft rewards-link" data-page="rewards">Voir mes badges et récompenses →</button></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES PRÉFÉRENCES</div><h2>À mon rythme</h2></div></div><label class="preference-row"><span><b>Petit rappel dans l’application</b><small>Afficher un rappel doux au prochain passage si je n’ai pas encore fait mon point du jour.</small></span><input type="checkbox" data-setting="gentleReminders" ${state.preferences.gentleReminders ? "checked" : ""}></label><label class="preference-row"><span><b>Son de célébration</b><small>Une courte note quand un pas est accompli.</small></span><input type="checkbox" data-setting="sound" ${state.preferences.sound ? "checked" : ""}></label></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES DONNÉES</div><h2>À toi de les garder</h2></div></div><div class="settings-card"><div class="settings-icon">⬇</div><div><b>Exporter ma sauvegarde</b><p>Récupère toutes tes données dans un fichier JSON.</p></div><button class="button button-soft" data-action="export">Exporter</button></div><div class="settings-card"><div class="settings-icon">⬆</div><div><b>Importer une sauvegarde</b><p>Remplace les données de cet appareil après aperçu et confirmation.</p></div><button class="button button-outline" data-action="import">Importer</button></div><div class="local-note"><span>🔒</span><span>Tes données restent sur cet appareil. Aucun compte, aucune synchronisation.</span></div><p class="install-help">Installation : Android — menu du navigateur → Installer. iPhone — Safari → Partager → Sur l’écran d’accueil.</p></section>
    <section class="section"><button class="danger-link" data-action="reset">Effacer toutes mes données</button></section>`;
}

export function modal(title, body, footer = "") {
  return `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><button type="button" class="text-button" data-action="close-modal">Annuler</button><h2 id="modal-title">${esc(title)}</h2><span></span></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</section></div>`;
}

export function weeklyObjectiveForm(state) {
  const week = getCurrentWeek(state);
  const body = `<form id="weekly-objective-form"><label>Mon objectif prioritaire cette semaine<textarea name="objective" rows="3" maxlength="180" placeholder="Ex. Montrer une première version de l’appli">${esc(week.objective || "")}</textarea></label><p class="form-hint">Un cap simple t’aide à choisir les actions qui comptent cette semaine.</p></form>`;
  return modal("Mon objectif de la semaine", body, `<button type="submit" class="button button-primary wide" form="weekly-objective-form">Enregistrer mon cap</button>`);
}

export function scheduleActionForm(state, action) {
  const week = getCurrentWeek(state);
  const days = Array.from({ length: 7 }, (_, index) => dateShift(week.start, index));
  const dayOptions = days.map(date => {
    const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
    return `<option value="${date}" ${action.plannedDate === date ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
  const slotOptions = slots.map(([id, icon, label]) => `<option value="${id}" ${action.slot === id ? "selected" : ""}>${icon} ${label}</option>`).join("");
  const body = `<form id="schedule-action-form"><input type="hidden" name="id" value="${esc(action.id)}"><p class="form-hint">${esc(action.title)}</p><label>Jour<select name="date" required><option value="" disabled ${action.plannedDate ? "" : "selected"}>Choisir un jour</option>${dayOptions}</select></label><label>Moment<select name="slot" required><option value="" disabled ${action.slot ? "" : "selected"}>Choisir un moment</option>${slotOptions}</select></label><p class="form-hint">Tu peux aussi glisser l’action vers un créneau du planning.</p></form>`;
  return modal("Choisir un créneau", body, `<button type="submit" class="button button-primary wide" form="schedule-action-form">Placer l’action</button>`);
}

export function actionForm(state, action = null, preselectedStone = "") {
  const selected = action?.stoneId || preselectedStone;
  const stoneOptions = state.stones.map(s => `<option value="${s.id}" ${selected === s.id ? "selected" : ""}>${esc(s.icon || "💎")} ${esc(s.title)}</option>`).join("");
  const week = getCurrentWeek(state);
  const body = `<form id="action-form"><label>Intitulé concret<input name="title" required maxlength="120" placeholder="Ex. Écrire 300 mots d’introduction" value="${esc(action?.title || "")}"></label><label>Grande Pierre <select name="stoneId"><option value="">À rattacher plus tard</option>${stoneOptions}</select></label><p class="form-hint">Chaque action s’inscrit dans une Grande Pierre. Tu pourras la rattacher plus tard si besoin.</p><fieldset><legend>Taille d’effort</legend><div class="effort-options">${Object.entries(effortMeta).map(([key, meta]) => `<label class="effort-option"><input type="radio" name="effort" value="${key}" ${((action?.effort || "M") === key) ? "checked" : ""}><span class="effort-choice"><b>${meta[1]} ${key}</b><small>${meta[2]}</small></span></label>`).join("")}</div><div class="xxl-note" id="xxl-note" hidden>🪨 C’est un rocher ! Découpons-le en quelques actions plus légères. <button type="button" class="text-button" data-action="split-action">Découper cette action</button></div></fieldset><label>Critère de réussite <textarea name="criteria" rows="2" placeholder="Comment sauras-tu que c’est fait ?">${esc(action?.criteria || "")}</textarea></label><fieldset><legend>Dans mon Cap Hebdo</legend><div class="segmented"><label><input type="radio" name="inWeek" value="yes" ${action?.weekId === week.id ? "checked" : ""}><span>Oui, cette semaine</span></label><label><input type="radio" name="inWeek" value="no" ${!action || action.weekId !== week.id ? "checked" : ""}><span>Non, dans ma réserve</span></label></div></fieldset><label>Jour prévu <small>(facultatif)</small><input name="plannedDate" type="date" min="${week.start}" max="${week.end}" value="${esc(action?.plannedDate || "")}"></label><fieldset><legend>Bloc de journée <small>(facultatif)</small></legend><div class="slot-options"><label><input type="radio" name="slot" value="" ${!action?.slot ? "checked" : ""}><span>◌<small>Aucun</small></span></label>${slots.map(([key, icon, name]) => `<label><input type="radio" name="slot" value="${key}" ${action?.slot === key ? "checked" : ""}><span>${icon}<small>${name}</small></span></label>`).join("")}</div></fieldset><input type="hidden" name="id" value="${action?.id || ""}"></form>`;
  return modal(action ? "Modifier la micro-action" : "Créer une micro-action", body, `<button class="button button-primary wide" form="action-form">${action ? "Enregistrer" : "Poser cette action"}</button>`);
}

export function stoneForm(stone = null) {
  const body = `<form id="stone-form"><label>Nom de la Grande Pierre<input name="title" required maxlength="80" placeholder="Ex. Écrire mon premier livre" value="${esc(stone?.title || "")}"></label><label>Symbole<input name="icon" maxlength="4" value="${esc(stone?.icon || "💎")}" aria-label="Symbole de la Grande Pierre"></label><div class="template-picks"><span class="form-hint">Besoin d’un exemple ?</span><button type="button" class="template-pick" data-stone-template="admin">📁 Admin & obligations</button><button type="button" class="template-pick" data-stone-template="project">💎 Projet important</button><button type="button" class="template-pick" data-stone-template="wellbeing">🌿 Prendre soin de moi</button></div><label>Critère de succès<textarea name="success" rows="3" placeholder="Quel résultat tangible te dira que c’est réussi ?">${esc(stone?.success || "")}</textarea></label><label>Mon ancrage émotionnel<textarea name="anchor" rows="2" placeholder="Pourquoi est-ce important pour toi ?">${esc(stone?.anchor || "")}</textarea></label><label>Échéance <small>(facultative)</small><input name="due" placeholder="Ex. Décembre 2026 ou au long cours" value="${esc(stone?.due || "")}"></label><input type="hidden" name="id" value="${stone?.id || ""}"></form>`;
  return modal(stone ? "Modifier ma Grande Pierre" : "Créer une Grande Pierre", body, `<button class="button button-primary wide" form="stone-form">${stone ? "Enregistrer" : "Créer ma pierre"}</button>`);
}

export function visionForm(state, mode = "vision") {
  const p = state.profile;
  let body = "";
  let title = "Ma Vision";
  if (mode === "vision") body = `<form id="vision-form"><label>Ma vision, en une phrase courte<input name="vision" required maxlength="180" placeholder="Ex. Créer dans la joie, préserver ma paix d’esprit et rayonner." value="${esc(p.vision)}"></label><p class="form-hint">Cette phrase est le point de départ. Tu pourras compléter les autres éléments de ta Vision plus tard.</p></form>`;
  if (mode === "story") { title = "Mon récit de vie idéal"; body = `<form id="story-form"><label>Quelques lignes pour imaginer ta vie<textarea name="story" rows="8" placeholder="Mes journées commencent dans le calme…">${esc(p.story)}</textarea></label></form>`; }
  if (mode === "essentials") { title = "Mes essentiels"; body = `<form id="essentials-form"><p class="form-hint">Ils serviront de boussole dans « Éclairer un choix ». Une ligne par essentiel.</p><label>Ce que je veux préserver ou faire grandir<textarea name="items" rows="6" placeholder="Préserver mon énergie vitale&#10;Être pleinement présent avec mes proches">${esc(p.essentials.join("\n"))}</textarea></label></form>`; }
  if (mode === "resonance") { title = "Mes mots-repères"; body = `<form id="resonance-form"><label>Un mot ou une valeur par ligne<textarea name="items" rows="5" placeholder="Liberté&#10;Douceur&#10;Créativité">${esc(p.resonance.join("\n"))}</textarea></label></form>`; }
  if (mode === "guides") { title = "Mes figures guides"; body = `<form id="guides-form"><p class="form-hint">Une figure par ligne, au format : emoji | nom | énergie ou qualité.</p><label>Mes inspirations<textarea name="items" rows="6" placeholder="🌞 | L’Audacieuse | Confiance, élan&#10;🌿 | La Sereine | Calme, enracinement">${esc(p.guides.map(g => `${g.emoji} | ${g.name} | ${g.qualities}`).join("\n"))}</textarea></label></form>`; }
  return modal(title, body, `<button class="button button-primary wide" form="${mode}-form">Enregistrer</button>`);
}

export function decisionForm(state, proposal = "") {
  const essentials = state.profile.essentials;
  const body = `<form id="decision-form"><label>Quelle proposition hésites-tu à accepter ?<input name="proposal" required maxlength="180" placeholder="Ex. Animer un atelier samedi matin" value="${esc(proposal)}"></label>${essentials.length ? `<div class="decision-values"><p>Passe-la au crible de tes essentiels :</p>${essentials.map((item, i) => `<fieldset><legend>${i + 1}. Est-ce aligné avec « ${esc(item)} » ?</legend><div class="segmented"><label><input type="radio" name="value-${i}" value="yes" required><span>Oui</span></label><label><input type="radio" name="value-${i}" value="mixed"><span>Non / mitigé</span></label></div></fieldset>`).join("")}</div>` : `<div class="empty-card slim"><p>Pour éclairer ce choix, définis d’abord un ou deux essentiels qui te servent de boussole.</p><button type="button" class="button button-soft" data-action="edit-essentials" data-resume-decision="true">Ajouter mes essentiels</button></div>`}</form>`;
  return modal("Éclairer un choix", body, `<button class="button button-primary wide" form="decision-form" ${essentials.length ? "" : "disabled"}>Voir ce qui résonne</button>`);
}

export function retroForm(state, weekId = "") {
  const week = state.weeks.find(item => item.id === weekId) || getCurrentWeek(state);
  const actions = state.actions.filter(a => a.weekId === week.id && a.status !== "done");
  const wins = Object.entries(state.daily).filter(([date, d]) => date >= week.start && date <= week.end).flatMap(([, d]) => d.wins || []);
  const completed = state.actions.filter(a => a.weekId === week.id && a.status === "done").length;
  const prompt = completed ? "Qu’est-ce qui t’a aidé à avancer cette semaine ?" : "Même une semaine sans action terminée peut t’apprendre quelque chose. Qu’est-ce qui t’aurait aidé ?";
  const body = `<form id="retro-form"><input type="hidden" name="weekId" value="${week.id}"><div class="retro-celebrate"><span>🎉</span><h3>${completed ? "Regarde le chemin parcouru." : "Merci d’avoir pris ce temps."}</h3><p>${completed} micro-action(s) terminée(s) · ${state.xp.total} XP cumulés</p></div>${wins.length ? `<div class="retro-wins"><b>Déjà noté dans ton livre d’or</b>${wins.slice(0, 4).map(win => `<p>✦ ${esc(typeof win === "string" ? win : win?.text || "")}</p>`).join("")}</div>` : ""}<label>Une victoire oubliée ?<textarea name="win" rows="2" placeholder="Un moment, une avancée, un choix…"></textarea></label><label>${prompt}<textarea name="mirror" rows="3" placeholder="Quelques mots, sans chercher la bonne réponse.">${esc(week.retro?.mirror || "")}</textarea></label>${actions.length ? `<div class="retro-remaining"><b>Que souhaites-tu faire des actions restantes ?</b>${actions.map(a => `<div class="remaining-row"><span>${esc(a.title)}</span><select name="remaining-${a.id}"><option value="reserve">Reporter dans ma réserve</option><option value="split">Découper en actions plus petites</option><option value="drop">Abandonner</option></select><select name="reason-${a.id}" aria-label="Raison du report"><option value="">Raison (facultatif)</option><option value="blocked">J’ai été bloqué·e</option><option value="too-big">Action trop grande</option><option value="less-important">Moins prioritaire</option><option value="unexpected">Imprévu</option></select></div>`).join("")}</div>` : `<p class="form-hint">Aucune action ne reste en suspens. Savoure cette avancée.</p>`}</form>`;
  return modal("Rétrospective du Cap Hebdo", body, `<button type="submit" class="button button-primary wide" form="retro-form">Clôturer ma semaine ✨</button>`);
}

export function blockerForm(action) {
  const body = `<form id="blocker-form"><div class="blocker-intro"><span>🧭</span><p>Un blocage est une information, pas un échec. Qu’est-ce qui t’aiderait le plus ?</p></div><label>Qu’est-ce qui coince ? <small>(facultatif)</small><textarea name="reason" rows="2" placeholder="Manque de temps, besoin d’aide, étape floue…">${esc(action.blockerReason || "")}</textarea></label><input type="hidden" name="id" value="${action.id}"><div class="blocker-choices"><button type="submit" name="choice" value="reduce">Réduire l’effort</button><button type="submit" name="choice" value="split">Découper l’action</button><button type="submit" name="choice" value="help">Garder dans mon Cap</button><button type="submit" name="choice" value="reserve">Reporter dans ma réserve</button></div></form>`;
  return modal("On ajuste le pas ?", body);
}

export function customToolForm() {
  const body = `<form id="custom-tool-form"><label>Nom de l’outil<input name="title" required maxlength="70" placeholder="Ex. Marcher 5 minutes"></label><label>Comment l’utiliser ?<textarea name="description" required rows="3" placeholder="Une consigne courte, une phrase qui aide…"></textarea></label><label>Catégorie<select name="category"><option value="serenity">Sérénité</option><option value="focus">Focus</option><option value="inspiration">Inspiration</option><option value="boost">Coup de boost</option></select></label><label>Emoji<input name="emoji" maxlength="4" value="✨"></label><label>Lien facultatif<input name="url" type="url" placeholder="https://…"></label></form>`;
  return modal("Ajouter un outil minute", body, `<button class="button button-primary wide" form="custom-tool-form">Ajouter à ma boîte</button>`);
}
