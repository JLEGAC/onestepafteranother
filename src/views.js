import { identityCards, identityIndex, identityDetail, identityForm, actionDependencyField } from "./identity-views.js";
import { identityTitle, blockers, orderedActions } from "./identity.js";
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
  const tabs = [["home", "📊", "Accueil"], ["vision", "🏝️", "Vision"], ["cible", "🎯", "Identités"], ["week", "🧭", "Cap Hebdo"], ["tools", "🧰", "Outils"], ["reserve", "✅", "Réserve"]];
  const activePage = page.startsWith("identity/") ? "cible" : page === "stones" || page === "habits" ? "cible" : page;
  return `<header class="topbar"><a class="brand" href="#home" data-page="home" aria-label="Un pas après l’autre — Accueil"><img src="./logo.svg" alt="Un pas après l’autre"></a><div class="topbar-actions"><button class="xp-pill" data-page="profile" aria-label="Mes points d’expérience"><span>✨</span><span><b>${state.xp.total}</b><small>XP</small></span><span class="level-mini">Niv. ${level.level}</span></button><button class="header-icon" data-page="profile" aria-label="Ouvrir mon profil">👤</button><button class="header-icon" data-page="history" aria-label="Ouvrir l’historique">📅</button></div></header>
    <main id="page-content" class="page-content">${renderPage(state, page)}</main>
    <nav class="bottom-nav" aria-label="Navigation principale">${tabs.map(([id, icon, label]) => `<button type="button" data-page="${id}" class="nav-item ${activePage === id ? "active" : ""}" aria-current="${activePage === id ? "page" : "false"}"><span>${icon}</span><small>${label}</small></button>`).join("")}</nav>`;
}

export function renderPage(state, page) {
  if (page.startsWith("identity/")) return identityDetail(state, decodeURIComponent(page.slice(9)));
  if (page === "week") return renderWeek(state);
  if (page === "stones" || page === "cible") return identityIndex(state);
  if (page === "tools") return renderTools(state);
  if (page === "vision") return renderVision(state);
  if (page === "profile") return renderProfile(state);
  if (page === "habits") return renderHabitsPage(state);
  if (page === "history") return renderHistoryPage(state);
  if (page === "reserve") return renderReservePage(state);
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
  return `${state.preferences.gentleReminders && !daily.dismissedReminder && (!daily.energy || !daily.mood) ? `<div class="gentle-reminder"><span>🌤️</span><span>Un petit point avec toi-même ? Tu peux le faire quand tu en as envie.</span><button class="icon-button" data-action="dismiss-reminder" aria-label="Plus tard">×</button></div>` : ""}${pendingRetros.length ? `<div class="gentle-reminder retro-reminder"><span>✨</span><span>Un bilan de semaine t’attend. Choisis le moment qui te convient.</span><button type="button" class="text-button" data-action="retro" data-week="${pendingRetros[0].id}">Le faire →</button></div>` : ""}<section class="checkin-card dashboard-checkin"><div class="dashboard-checkin-block"><div class="checkin-heading"><h2>Batterie</h2><details class="checkin-help"><summary aria-label="Afficher la légende de la batterie" title="Légende de la batterie">ℹ️</summary><div class="checkin-legend">${[[25, "Énergie basse"], [50, "Énergie moyenne"], [75, "Énergie haute"], [100, "Énergie pleine"]].map(([value, label]) => `<span><b>${value}%</b> ${label}</span>`).join("")}</div></details></div><div class="energy-options">${[25, 50, 75, 100].map(n => `<button type="button" data-energy="${n}" class="energy-choice ${daily.energy === n ? "selected" : ""}" aria-label="Batterie ${n}%">${n}%</button>`).join("")}</div></div><div class="dashboard-checkin-block"><div class="checkin-heading"><h2>Humeur</h2><details class="checkin-help"><summary aria-label="Afficher la légende de l’humeur" title="Légende de l’humeur">ℹ️</summary><div class="checkin-legend">${[["🌪️", "Rien ne va"], ["🌩️", "C’est très compliqué"], ["🌦️", "C’est dur mais y’a du positif"], ["🌤️", "Les émotions sont équilibrées"], ["🌞", "Ça va à merveille, je me sens au top !"]].map(([emoji, label]) => `<span><b>${emoji}</b> ${label}</span>`).join("")}</div></details></div><div class="moods">${[["🌪️", "Rien ne va"], ["🌩️", "C’est très compliqué"], ["🌦️", "C’est dur mais y’a du positif"], ["🌤️", "Les émotions sont équilibrées"], ["🌞", "Ça va à merveille, je me sens au top !"]].map(([emoji, label]) => `<button type="button" data-mood="${emoji}" class="mood-choice ${daily.mood === emoji ? "selected" : ""}" aria-label="${label}">${emoji}</button>`).join("")}</div></div></section>
    <section class="vision-strip"><div class="vision-orb">✦</div><div><div class="eyebrow">MA VISION</div><p>« ${esc(vision)} »</p></div><button type="button" class="icon-button" data-page="vision" aria-label="Ouvrir ma vision">✎</button></section>
    ${renderHabitHome(state)}
    <section class="section"><div class="section-heading"><h2>Focus du jour</h2><button type="button" class="text-button" data-page="week">Voir la semaine complète 🧭</button></div>${focused.length ? focused.map(a => actionCard(state, a, true)).join("") : `<div class="empty-card slim"><p>Aucune action choisie pour aujourd’hui. Tu peux garder cette journée libre ou faire un tour dans ton cap hebdo.</p></div>`}</section>
    <section class="section win-section"><div class="section-heading"><h2>Mes victoires</h2><button type="button" class="text-button" data-page="wins">Voir toutes mes victoires 🏆</button></div><form class="victory-form" id="win-form"><div class="inline-add"><input name="win" maxlength="180" placeholder="De quoi es-tu fier·e aujourd’hui ?" aria-label="Ajouter une victoire" required></div><label class="victory-link-label">Quelle identité cette victoire nourrit-elle ? <small>(facultatif)</small><select name="related"><option value="">Je ne souhaite pas la lier</option>${state.stones.map(stone => `<option value="stone:${esc(stone.id)}">${esc(stone.icon || "🎯")} ${esc(stone.title.replace(/^\p{Extended_Pictographic}(?:\uFE0F)?\s*/u, ""))}</option>`).join("")}</select></label><button type="submit" class="button button-primary">Enregistrer ma victoire</button></form><div class="win-list">${(daily.wins || []).map((win, i) => renderVictoryItem(state, win, i)).join("")}</div></section>`;
}

export function actionCard(state, action, compact = false, inWeekList = false) {
  const stone = state.stones.find(s => s.id === action.stoneId) || state.stones.find(s => s.id === state.steps?.find(step => step.id === action.stepId)?.stoneId);
  const blocked = blockers(state, action);
  const step = state.steps.find(s=>s.id===action.stepId);
  const meta = effortMeta[action.effort] || effortMeta.M;
  const primaryButton = action.status === "unassigned"
    ? `<button class="button button-outline button-small" data-action="edit-action" data-id="${action.id}">Rattacher à une identité</button>`
    : action.status === "reserve"
      ? `<button class="button button-soft button-small" data-action="plan-action" data-id="${action.id}">Prévoir cette semaine</button><button class="button button-complete button-small" data-action="complete-action" data-id="${esc(action.id)}" ${blocked.length ? "disabled" : ""}>✓ Terminer</button>`
      : `<button class="button button-complete button-small" data-action="complete-action" data-id="${action.id}" ${blocked.length ? "disabled" : ""}>✓ Terminer</button>`;
  const plannedDay = action.plannedDate ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${action.plannedDate}T12:00:00`)) : "";
  const scheduleHandle = inWeekList && action.status !== "done" ? `<button type="button" class="week-drag-handle" data-action="schedule-action" data-id="${esc(action.id)}" data-drag-action="${esc(action.id)}" aria-label="Déplacer ${esc(action.title)} vers un créneau" title="Glisser vers un créneau ou sélectionner pour choisir">⠿</button>` : "";
  return `<article class="action-card ${action.status === "done" ? "is-done" : ""} ${compact ? "compact" : ""}"><div class="action-top"><span class="stone-label">${stone ? `${esc(stone.icon || "🎯")} ${esc(stone.title)}` : "À rattacher à une identité"}</span><span class="effort-chip effort-${meta[0].toLowerCase()}">${meta[1]} ${meta[0]}</span>${scheduleHandle}</div><h3>${esc(action.title)}</h3>${step ? `<small class="context-badge">${esc(step.title)}</small>` : ""}${blocked.length && action.status !== "done" ? `<p class="dependency-note">🔒 Termine d’abord : ${blocked.map(b=>esc(b.title)).join(" · ")}</p>` : ""}${action.criteria ? `<p class="criteria"><span>✓</span> Fait quand : ${esc(action.criteria)}</p>` : ""}${action.status === "done" ? `<div class="done-ribbon">✨ Bravo, ce pas est accompli !</div><button class="text-button" data-action="edit-action" data-id="${esc(action.id)}">Modifier l’action</button>` : `<div class="action-footer">${action.slot || plannedDay ? `<span class="slot-tag">${plannedDay ? `📅 ${plannedDay} · ` : ""}${action.slot ? `${slots.find(s => s[0] === action.slot)?.[1] || ""} ${slots.find(s => s[0] === action.slot)?.[2] || ""}` : ""}</span>` : `<span class="reserve-tag">${action.status === "unassigned" ? "À rattacher" : action.status === "weekly" ? "Dans mon Cap" : "Dans ma réserve"}</span>`}<div class="action-buttons">${primaryButton}${action.status === "weekly" ? `<button class="block-button" data-action="schedule-action" data-id="${esc(action.id)}">Modifier le créneau</button>` : ""}${action.status === "weekly" && !action.plannedDate ? `<button class="block-button" data-action="plan-today" data-id="${action.id}">Aujourd’hui</button>` : ""}${action.status === "weekly" ? `<button class="block-button" data-action="blocked" data-id="${action.id}">Je bloque</button>` : ""}<button class="more-button" data-action="edit-action" data-id="${action.id}" aria-label="Modifier l’action">Modifier</button></div></div>`}</article>`;
}

function renderWeek(state) {
  const week = getCurrentWeek(state);
  const actions = orderedActions(state, state.actions.filter(a => a.weekId === week.id));
  const done = actions.filter(a => a.status === "done").length;
  const percent = actions.length ? Math.round(done / actions.length * 100) : 0;
  const fmt = date => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`));
  const unassigned = state.actions.filter(a => a.status === "unassigned");
  const weekNumber = isoWeekNumber(week.start);
  const days = Array.from({ length: 7 }, (_, index) => dateShift(week.start, index));
  return `<div class="page-title-row"><div><h1>Cap Hebdo <small class="week-number">Semaine ${weekNumber}</small></h1></div></div>
    <section class="week-objective"><div class="week-objective-icon">🎯 ➜</div><div><div class="eyebrow">OBJECTIF DE LA SEMAINE</div><p>${esc(week.objective || "Quel cap prioritaire veux-tu garder cette semaine ?")}</p></div><button type="button" class="icon-button" data-action="edit-weekly-objective" aria-label="Définir l’objectif de la semaine">✎</button></section>
    <section class="week-progress"><div class="week-dates">Semaine du ${fmt(week.start)} au ${fmt(week.end)}</div><div class="progress-label"><span>${done}/${actions.length} actions accomplies</span><b>${percent}%</b></div><div class="progress-track"><span style="width:${percent}%"></span></div></section>
    <section class="section"><div class="section-heading"><div class="week-actions-heading"><h2>Mes actions de la semaine</h2><span class="count-badge">${actions.length}</span></div><button type="button" class="text-button" data-action="new-action">＋ Ajouter une action</button></div>${actions.length ? actions.map(a => actionCard(state, a, false, true)).join("") : `<div class="empty-card slim"><span class="empty-icon">🎯</span><h3>Ton Cap est encore ouvert.</h3><p>Choisis une action dans une identité, ou crée une nouvelle action.</p><button type="button" class="button button-primary" data-action="new-action">Ajouter une action <span>↗</span></button></div>`}</section>
    ${renderWeekCalendar(state, days)}
    ${unassigned.length ? `<section class="section"><div class="section-heading"><div><div class="eyebrow">INBOX</div><h2>À rattacher</h2></div><span class="count-badge muted">${unassigned.length}</span></div><p class="section-copy">Ces actions attendent une identité avant de rejoindre ton Cap.</p>${unassigned.map(a => actionCard(state, a)).join("")}</section>` : ""}
    `;
}

function renderWeekCalendar(state, days) {
  const labels = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const timeSlots = [["morning", "🌅 Matin"], ["noon", "☀️ Midi"], ["afternoon", "🌤️ Après-midi"], ["evening", "🌙 Soir"]];
  const renderSlot = (date, label, slot) => {
    const items = orderedActions(state, state.actions.filter(action => action.plannedDate === date && (action.slot || "") === slot && action.status !== "abandoned" && action.status !== "split"));
    return `<section class="week-time-slot ${slot ? "timed-slot" : "all-day-slot"}" data-week-slot="true" data-date="${date}" data-slot="${slot}" tabindex="0" aria-label="${label}"><b>${label}</b>${items.map(action => `<label class="week-slot-action ${action.status === "done" ? "is-done" : ""}"><input type="checkbox" data-action="complete-week-action" data-id="${esc(action.id)}" ${action.status === "done" ? "checked disabled" : blockers(state,action).length ? "disabled" : ""} aria-label="Marquer ${esc(action.title)} comme faite"><span>${esc(action.title)}<small class="context-badge">${esc(state.stones.find(s=>s.id===action.stoneId)?.title || "")}</small>${blockers(state,action).length ? `<small>🔒 Après : ${blockers(state,action).map(b=>esc(b.title)).join(" · ")}</small>` : ""}</span></label>`).join("") || `<small class="slot-empty">Déposer ici</small>`}</section>`;
  };
  return `<section class="section"><div class="section-heading"><div><h2>Mes blocs de temps</h2></div></div><p class="form-hint">Glisse une action vers un créneau. Sur téléphone, appuie sur ⠿ pour choisir le jour et le moment.</p><div class="week-calendar-viewport"><div class="week-calendar-track">${days.map((date, index) => {
    const activeSlots = timeSlots.filter(([slot]) => state.actions.some(action => action.plannedDate === date && action.slot === slot && action.status !== "abandoned" && action.status !== "split"));
    const timedSlotHtml = activeSlots.map(([slot, label]) => renderSlot(date, label, slot)).join("");
    return `<article class="week-day-column"><h3>${labels[index]} <small>${date.slice(-2)}</small></h3>${renderSlot(date, "Toute la journée", "")}${timedSlotHtml}</article>`;
  }).join("")}</div></div></section>`;
}

function isoWeekNumber(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

function renderReservePage(state) {
  const actions = state.actions.filter(action => action.status === "reserve");
  const rank = new Map((state.reserveOrder || []).map((id, index) => [id, index]));
  actions.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  return `<div class="page-title-row"><div><h1>Réserve</h1></div></div>
    <section class="section"><div class="section-heading"><h2>Mes actions en réserve</h2><span class="count-badge">${actions.length}</span></div>${actions.length ? `<p class="form-hint">Fais glisser une action pour changer sa priorité. Les flèches permettent aussi de la déplacer.</p><div class="reserve-list">${actions.map((action, index) => `<div class="reserve-row" draggable="true" data-reserve-id="${esc(action.id)}"><span class="reserve-grip" aria-hidden="true">⠿</span><div class="reserve-position"><button type="button" class="icon-button" data-action="reserve-move" data-id="${esc(action.id)}" data-delta="-1" aria-label="Monter ${esc(action.title)}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="icon-button" data-action="reserve-move" data-id="${esc(action.id)}" data-delta="1" aria-label="Descendre ${esc(action.title)}" ${index === actions.length - 1 ? "disabled" : ""}>↓</button></div>${actionCard(state, action)}</div>`).join("")}</div>` : `<div class="empty-card slim"><p>Aucune action dans ta réserve pour le moment.</p></div>`}</section>`;
}


function renderVision(state) {
  const profile = state.profile;
  return `<div class="page-title-row"><div><h1>Ma Vision</h1></div><button class="icon-button larger" data-action="edit-vision" aria-label="Modifier ma vision">✎</button></div>
    <section class="vision-quote-card"><span class="quote-mark">“</span><p>${esc(profile.vision || "Ta phrase courte de vision apparaîtra ici.")}</p><small>MA VISION, EN QUELQUES MOTS</small></section>
    <section class="section"><div class="section-heading"><h2>${identityTitle(state)}</h2><button class="text-button" data-action="new-stone">＋ Ajouter une identité</button></div>${identityCards(state)}</section>
    <section class="section"><div class="section-heading"><h2>Mes importants</h2><button class="text-button" data-action="edit-essentials">Modifier</button></div>${profile.essentials.length ? `<div class="essential-list">${profile.essentials.map((item, i) => `<div class="essential-item"><span class="essential-number">0${i + 1}</span><span>${esc(item)}</span><span class="essential-spark">✦</span></div>`).join("")}</div>` : `<div class="empty-card slim"><p>Ajoute les choses qui te donnent de l’énergie et t’aident à te sentir pleinement toi.</p><button class="button button-soft" data-action="edit-essentials">＋ Ajouter mes importants</button></div>`}</section>
    <section class="section"><div class="section-heading"><h2>La vie que je veux bâtir</h2><button class="icon-button" data-action="edit-story" aria-label="Modifier mon récit">✎</button></div><div class="story-card">${profile.story ? `<p>${esc(profile.story).replace(/\n/g, "<br>")}</p>` : `<p class="muted-copy">Quelques lignes pour imaginer les journées que tu rêverais de vivre. N’hésite pas à rêver grand et à donner un maximum de détails ! La précision augmente les résultats. Tu pourras compléter ce récit quand tu le souhaites.</p>`}<button class="text-button" data-action="edit-story">${profile.story ? "Enrichir mon récit" : "Commencer mon récit"} →</button></div></section>
    <section class="section"><div class="section-heading"><h2>Ce qui résonne</h2><button type="button" class="text-button" data-action="edit-resonance">Modifier</button></div><div class="vision-media-actions"><button type="button" class="button button-outline" data-action="edit-resonance">＋ Ajouter des mots</button><label class="button button-outline">＋ Ajouter des images<input id="resonance-image-input" type="file" accept="image/*" multiple hidden></label></div><div class="word-cloud">${profile.resonance.length ? profile.resonance.map((word, i) => `<span class="word-chip word-${i % 4}">${esc(word)}</span>`).join("") : `<span class="muted-copy">Les mots qui te ressemblent ou t’aident à avancer.</span>`}</div>${profile.resonanceImages?.length ? `<div class="vision-image-grid">${profile.resonanceImages.map(image => `<figure><button type="button" class="vision-image-open" data-action="view-resonance-image" data-id="${esc(image.id)}" aria-label="Afficher ${esc(image.name || "cette image")} en grand"><img src="${image.dataUrl}" alt="${esc(image.name || "Image liée à ma Vision")}" loading="lazy"></button><button type="button" class="remove-win" data-action="remove-resonance-image" data-id="${esc(image.id)}" aria-label="Retirer cette image">×</button></figure>`).join("")}</div>` : ""}</section>`;
}

function renderVictoryItem(state, value, index = null, date = "") {
  const win = typeof value === "string" ? { text: value } : (value || {});
  const linked = win.relatedType === "stone"
    ? state.stones.find(stone => stone.id === win.relatedId)
    : win.relatedType === "action" ? state.actions.find(action => action.id === win.relatedId) : null;
  const label = linked ? `${linked.icon || "🎯"} ${linked.title}` : "";
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
  return `<div class="page-title-row"><div><h1>Historique</h1></div></div>
    <section class="history-week-card"><div class="history-week-heading"><button type="button" class="icon-button" data-action="history-shift" data-days="-7" aria-label="Semaine précédente">‹</button><b>Semaine du ${esc(weekLabel)}</b><button type="button" class="icon-button" data-action="history-shift" data-days="7" aria-label="Semaine suivante" ${end >= todayISO() ? "disabled" : ""}>›</button></div><div class="history-week-days">${dates.map(dayDate => { const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(`${dayDate}T12:00:00`)); const number = Number(dayDate.slice(-2)); return `<button type="button" data-action="history-date" data-date="${dayDate}" class="history-date ${dayDate === date ? "selected" : ""}" ${dayDate > todayISO() ? "disabled" : ""}><small>${esc(label)}</small><b>${number}</b></button>`; }).join("")}</div><div class="history-week-summary">${weekActions.filter(action => action.status === "done").length} action(s) terminée(s) · ${weekActions.length} planifiée(s) ou réalisée(s)</div></section>
    <div class="history-day-heading"><button type="button" class="icon-button" data-action="history-shift" data-days="-1" aria-label="Jour précédent">‹</button><h2>${esc(selectedLabel)}</h2><button type="button" class="icon-button" data-action="history-shift" data-days="1" aria-label="Jour suivant" ${date >= todayISO() ? "disabled" : ""}>›</button></div>
    <section class="section history-grid"><article class="history-card"><h3>Mon point du jour</h3><p>⚡ Batterie : ${day.energy ? `${day.energy} %` : "non renseignée"}</p><p>Humeur : ${day.mood ? `${esc(day.mood)} ${esc(({"🌪️":"Rien ne va","🌪":"Rien ne va","🌩️":"C’est très compliqué","🌩":"C’est très compliqué","🌦️":"C’est dur mais y’a du positif","🌦":"C’est dur mais y’a du positif","🌤️":"Les émotions sont équilibrées","🌤":"Les émotions sont équilibrées","🌞":"Ça va à merveille, je me sens au top !"})[day.mood] || "")}` : "non renseignée"}</p></article><article class="history-card"><h3>Mes habitudes</h3>${habits.length ? habits.map(habit => `<p>${isHabitDone(state, habit.id, date) ? "🟢" : "⚪"} ${esc(habit.title)}</p>`).join("") : `<p>Aucune habitude pour cette date.</p>`}</article></section>
    <section class="section"><div class="section-heading"><h2>Mes actions</h2><span class="count-badge">${actions.length}</span></div>${actions.length ? actions.map(action => `<article class="history-action ${action.status === "done" ? "is-done" : ""}"><b>${action.status === "done" ? "✓" : "○"} ${esc(action.title)}</b><small>${esc(state.stones.find(stone => stone.id === action.stoneId)?.title || "Sans identité")} · ${action.status === "done" ? "Terminée" : "Prévue"}</small></article>`).join("") : `<div class="empty-card slim"><p>Aucune action prévue ou terminée ce jour-là.</p></div>`}</section>
    <section class="section"><div class="section-heading"><h2>Mes victoires</h2><button type="button" class="text-button" data-page="wins">Tout voir →</button></div>${wins.length ? wins.map(win => renderVictoryItem(state, win)).join("") : `<p class="muted-copy">Aucune victoire notée ce jour-là.</p>`}</section>`;
}

function renderWinsPage(state) {
  const allWins = Object.entries(state.daily).flatMap(([date, day]) => (day.wins || []).map(win => ({ date, win }))).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-title-row"><div><h1>Mes victoires</h1></div><span class="count-badge">${allWins.length}</span></div>${allWins.length ? allWins.map(item => renderVictoryItem(state, item.win, null, item.date)).join("") : `<div class="empty-card"><span class="empty-icon">🏆</span><h3>Ton livre d’or commence ici</h3><p>Une fierté, un choix ou un moment important peut devenir une victoire à garder.</p><button type="button" class="button button-primary" data-page="home">Ajouter ma première victoire</button></div>`}<button type="button" class="button button-outline wide" data-page="home">← Retour à l’accueil</button>`;
}

function renderTools(state) {
  const level = levelFor(state.xp.total);
  return `<div class="page-title-row"><div><h1>Boîte à outils</h1></div><div class="tool-points">✨ ${state.xp.total}</div></div>
    <section class="section"><div class="eyebrow">DE QUOI AS-TU BESOIN ?</div><div class="need-grid"><button class="need-chip" data-tool-filter="serenity">🌿 Sérénité</button><button class="need-chip" data-tool-filter="focus">🎯 Focus</button><button class="need-chip" data-tool-filter="inspiration">💖 Inspiration</button><button class="need-chip" data-tool-filter="boost">🔋 Coup de boost</button></div></section>
    <section class="section"><div class="section-heading"><div><h2>À portée de main</h2></div><button class="text-button" data-action="new-tool">＋ Ajouter</button></div><div class="tool-card" data-categories="serenity"><div class="tool-icon green">🌿</div><div class="tool-copy"><h3>Respiration carrée</h3><p>4 secondes pour inspirer, garder, expirer et faire une pause.</p><button class="button button-soft" data-action="breathing">Lancer l’exercice <span>↗</span></button></div></div><div class="tool-card" data-categories="focus inspiration"><div class="tool-icon gold">🎯</div><div class="tool-copy"><h3>Éclairer un choix</h3><p>Prends une décision en la confrontant à ce qui est important pour toi.</p><button class="button button-soft" data-action="decision">Ouvrir l’outil <span>↗</span></button></div></div><div class="tool-card" data-categories="boost"><div class="tool-icon coral">🔋</div><div class="tool-copy"><h3>Rappelle-toi tes victoires</h3><p>Relis un pas déjà accompli pour retrouver ton élan.</p><button class="button button-soft" data-action="past-wins">Retrouver mes victoires <span>↗</span></button></div></div>${(state.tools || []).map(tool => `<div class="tool-card custom-tool" data-categories="${esc(tool.category || "inspiration")}"><div class="tool-icon lilac">${({serenity:"🌿",focus:"🎯",inspiration:"💖",boost:"🔋"}[tool.category] || "✦")}</div><div class="tool-copy"><h3>${esc(tool.title)}</h3><p>${esc(tool.description)}</p>${safeHref(tool.url) ? `<a class="button button-soft" href="${esc(safeHref(tool.url))}" target="_blank" rel="noopener">Ouvrir la ressource ↗</a>` : ""}</div><button class="remove-win" data-action="remove-tool" data-id="${tool.id}" aria-label="Supprimer l’outil">×</button></div>`).join("")}</section>
    <section class="section"><div class="section-heading"><div><h2>Grandir à mon rythme</h2></div></div><div class="feature-links"><button data-page="habits"><span>🌱</span><b>Suivi des habitudes</b><small>${state.habits.filter(item => item.active !== false).length} active(s) · calendrier et séries</small><i>→</i></button><button data-page="challenges"><span>🎯</span><b>Défis du Cap</b><small>${state.challenges.filter(item => item.status === "active").length} en cours · sans pénalité</small><i>→</i></button><button data-page="capsules"><span>🎬</span><b>Capsules vidéo</b><small>${state.capsules.length} dans ma collection</small><i>→</i></button><button data-page="rewards"><span>🏆</span><b>Mes récompenses</b><small>Badges et ambiances débloquées</small><i>→</i></button></div></section>
    <section class="xp-card"><div class="xp-orbit">✦</div><div><div class="eyebrow">TON ÉLAN</div><h2>Niveau ${level.level} · ${level.title}</h2><p>${level.into} / 100 XP vers le prochain niveau</p><div class="level-track"><span style="width:${level.into}%"></span></div></div></section>`;
}

function renderProfile(state) {
  return `<div class="page-title-row"><div><h1>Profil</h1></div><span class="profile-orb">✦</span></div><section id="provider-settings" class="section"></section><section id="dropbox-account" class="section cloud-account"></section><section id="cloud-account" class="section cloud-account"></section><section class="xp-profile-card"><div class="big-xp">✨ ${state.xp.total}</div><div class="eyebrow">POINTS D’ÉLAN</div><p>Chaque pas nourrit ta progression et débloque des options de personnalisation.</p><div class="level-track"><span style="width:${levelFor(state.xp.total).into}%"></span></div><b>Niveau ${levelFor(state.xp.total).level} · ${levelFor(state.xp.total).title}</b><button class="button button-soft rewards-link" data-page="rewards">Voir mes badges et récompenses →</button></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES PRÉFÉRENCES</div><h2>À mon rythme</h2></div></div><label class="preference-row"><span><b>Petit rappel dans l’application</b><small>Afficher un rappel doux au prochain passage si je n’ai pas encore fait mon point du jour.</small></span><input type="checkbox" data-setting="gentleReminders" ${state.preferences.gentleReminders ? "checked" : ""}></label><label class="preference-row"><span><b>Thème sombre</b><small>Choisir une apparence plus douce dans les environnements peu éclairés.</small></span><input type="checkbox" data-setting="darkMode" ${state.preferences.darkMode ? "checked" : ""}></label><label class="preference-row"><span><b>Son de célébration</b><small>Une courte note quand un pas est accompli.</small></span><input type="checkbox" data-setting="sound" ${state.preferences.sound ? "checked" : ""}></label></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES DONNÉES</div><h2>À toi de les garder</h2></div></div><div class="settings-card"><div class="settings-icon">⬇</div><div><b>Exporter ma sauvegarde</b><p>Récupère toutes tes données dans un fichier JSON.</p></div><button class="button button-soft" data-action="export">Exporter</button></div><div class="settings-card"><div class="settings-icon">⬆</div><div><b>Importer une sauvegarde</b><p>Remplace les données de cet appareil après aperçu et confirmation.</p></div><button class="button button-outline" data-action="import">Importer</button></div><div class="local-note"><span>🔒</span><span>Une copie reste sur cet appareil. Connecte-toi dans Mon compte pour la sauvegarde cloud.</span></div><p class="install-help">Installation : Android — menu du navigateur → Installer. iPhone — Safari → Partager → Sur l’écran d’accueil.</p></section>
    <section class="section update-settings"><h2>Mises à jour</h2><label class="preference-row"><span><b>Vérifier automatiquement les mises à jour à l’ouverture</b><small>La vérification automatique ne t’impose pas d’installer une nouvelle version.</small></span><input type="checkbox" data-setting="autoUpdates" ${state.preferences.autoUpdates !== false ? "checked" : ""}></label><button class="button button-outline" data-action="check-update">Vérifier maintenant</button><p id="update-check-status" role="status" aria-live="polite"></p><p class="form-hint">Le navigateur peut aussi rechercher une mise à jour de son côté.</p></section>
    <section class="section profile-links"><a href="./presentation.html">À propos</a> · <a href="./confidentialite.html">Confidentialité</a></section>
    <section class="section"><button class="danger-link" data-action="reset">Effacer toutes mes données</button></section>`;
}

export function modal(title, body, footer = "") {
  return `<div class="modal-backdrop"><section class="modal-card" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><button type="button" class="text-button" data-action="close-modal">Annuler</button><h2 id="modal-title">${esc(title)}</h2><span></span></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ""}</section></div>`;
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
  const body = `<form id="schedule-action-form"><input type="hidden" name="id" value="${esc(action.id)}"><p class="form-hint">${esc(action.title)}</p><label>Jour<select name="date" required><option value="" disabled ${action.plannedDate ? "" : "selected"}>Choisir un jour</option>${dayOptions}</select></label><label>Moment<select name="slot"><option value="" ${action.slot ? "" : "selected"}>Toute la journée</option>${slotOptions}</select></label><p class="form-hint">Tu peux aussi glisser l’action vers un créneau du planning.</p></form>`;
  return modal("Choisir un créneau", body, `<button type="submit" class="button button-primary wide" form="schedule-action-form">Placer l’action</button>`);
}

export function actionForm(state, action = null, preselectedStone = "", preselectedStep = "") {
  const selected = action?.stoneId || preselectedStone;
  const stoneOptions = state.stones.map(s => `<option value="${s.id}" ${selected === s.id ? "selected" : ""}>${esc(s.icon || "💎")} ${esc(s.title.replace(/^\p{Extended_Pictographic}(?:\uFE0F)?\s*/u, ""))}</option>`).join("");
  const selectedStep = action?.stepId || preselectedStep;
  const stepOptions = (state.steps || []).filter(step => step.stoneId === selected).map(step => `<option value="${esc(step.id)}" ${selectedStep === step.id ? "selected" : ""}>${esc(step.title)}</option>`).join("");
  const week = getCurrentWeek(state);
  const body = `<form id="action-form"><p class="form-hint">Une petite action précise et terminable : environ 15 minutes si possible, avec un résultat clair.</p><label>Intitulé concret<input name="title" required maxlength="120" placeholder="Ex. Écrire 300 mots d’introduction" value="${esc(action?.title || "")}"></label><label>Identité <select name="stoneId"><option value="">À rattacher plus tard</option>${stoneOptions}</select></label><label>Étape <small>(facultatif)</small><select name="stepId"><option value="">Rattacher directement à l’identité</option>${stepOptions}</select></label><p class="form-hint">Tu peux rattacher l’action à l’identité ou à l’une de ses étapes.</p>${actionDependencyField(state, action)}<fieldset><legend>Taille d’effort</legend><div class="effort-options">${Object.entries(effortMeta).map(([key, meta]) => `<label class="effort-option"><input type="radio" name="effort" value="${key}" ${((action?.effort || "S") === key) ? "checked" : ""}><span class="effort-choice"><b>${meta[1]} ${key}</b><small>${meta[2]}</small></span></label>`).join("")}</div><div class="xxl-note" id="xxl-note" hidden>🪨 C’est un rocher ! Découpons-le en quelques actions plus légères. <button type="button" class="text-button" data-action="split-action">Découper cette action</button></div></fieldset><label>Critère de réussite <textarea name="criteria" rows="2" placeholder="Comment sauras-tu que c’est fait ?">${esc(action?.criteria || "")}</textarea></label><fieldset><legend>Dans mon Cap Hebdo</legend><div class="segmented"><label><input type="radio" name="inWeek" value="yes" ${action?.weekId === week.id ? "checked" : ""}><span>Oui, cette semaine</span></label><label><input type="radio" name="inWeek" value="no" ${!action || action.weekId !== week.id ? "checked" : ""}><span>Non, dans ma réserve</span></label></div></fieldset><label>Jour prévu <small>(facultatif)</small><input name="plannedDate" type="date" min="${week.start}" max="${week.end}" value="${esc(action?.plannedDate || "")}"></label><fieldset><legend>Bloc de journée <small>(facultatif)</small></legend><div class="slot-options"><label><input type="radio" name="slot" value="" ${!action?.slot ? "checked" : ""}><span>◌<small>Toute la journée</small></span></label>${slots.map(([key, icon, name]) => `<label><input type="radio" name="slot" value="${key}" ${action?.slot === key ? "checked" : ""}><span>${icon}<small>${name}</small></span></label>`).join("")}</div></fieldset><input type="hidden" name="id" value="${action?.id || ""}"></form>`;
  return modal(action ? "Modifier la micro-action" : "Créer une micro-action", body, `<button class="button button-primary wide" form="action-form">${action ? "Enregistrer" : "Poser cette action"}</button>`);
}

export const stoneForm = identityForm;

export function stepForm(stoneId, step = null) {
  const body = `<form id="step-form"><input type="hidden" name="stoneId" value="${esc(stoneId)}"><input type="hidden" name="id" value="${esc(step?.id || "")}"><label>Nom de l’étape<input name="title" required maxlength="80" placeholder="Ex. Préparer le plan" value="${esc(step?.title || "")}"></label></form>`;
  return modal(step ? "Modifier l’étape" : "Ajouter une étape", body, `<button class="button button-primary wide" form="step-form">${step ? "Enregistrer" : "Ajouter l’étape"}</button>`);
}

export function visionForm(state, mode = "vision") {
  const p = state.profile;
  let body = "";
  let title = "Ma Vision";
  if (mode === "vision") body = `<form id="vision-form"><label>Ma vision, en une phrase courte<input name="vision" required maxlength="180" placeholder="Ex. Créer dans la joie, préserver ma paix d’esprit et rayonner." value="${esc(p.vision)}"></label><p class="form-hint">Cette phrase est le point de départ. Tu pourras compléter les autres éléments de ta Vision plus tard.</p></form>`;
  if (mode === "story") { title = "Mon récit de vie idéal"; body = `<form id="story-form"><label>Quelques lignes pour imaginer ta vie<textarea name="story" rows="8" placeholder="Mes journées commencent dans le calme…">${esc(p.story)}</textarea></label></form>`; }
  if (mode === "essentials") { title = "Mes importants"; body = `<form id="essentials-form"><p class="form-hint">Ce sont les choses qui te donnent de l’énergie et te permettent de te sentir 100 % toi. Elles serviront de boussole quand tu auras des décisions à prendre. Une ligne par important.</p><label>Ce que je veux préserver ou faire grandir<textarea name="items" rows="6" placeholder="Authenticité = moi sans limite&#10;Profondeur = intensité + présence">${esc(p.essentials.join("\n"))}</textarea></label></form>`; }
  if (mode === "resonance") { title = "Mes mots-repères"; body = `<form id="resonance-form"><label>Un mot ou une valeur par ligne<textarea name="items" rows="5" placeholder="Liberté&#10;Douceur&#10;Créativité">${esc(p.resonance.join("\n"))}</textarea></label></form>`; }
  if (mode === "guides") { title = "Mes figures guides"; body = `<form id="guides-form"><p class="form-hint">Une figure par ligne, au format : emoji | nom | énergie ou qualité.</p><label>Mes inspirations<textarea name="items" rows="6" placeholder="🌞 | L’Audacieuse | Confiance, élan&#10;🌿 | La Sereine | Calme, enracinement">${esc(p.guides.map(g => `${g.emoji} | ${g.name} | ${g.qualities}`).join("\n"))}</textarea></label></form>`; }
  return modal(title, body, `<button class="button button-primary wide" form="${mode}-form">Enregistrer</button>`);
}

export function decisionForm(state, proposal = "") {
  const essentials = state.profile.essentials;
  const body = `<form id="decision-form"><label>Quelle proposition hésites-tu à accepter ?<input name="proposal" required maxlength="180" placeholder="Ex. Animer un atelier samedi matin" value="${esc(proposal)}"></label>${essentials.length ? `<div class="decision-values"><p>Passe-la au crible de ce qui est important pour toi :</p>${essentials.map((item, i) => `<fieldset><legend>${i + 1}. Est-ce aligné avec « ${esc(item)} » ?</legend><div class="segmented"><label><input type="radio" name="value-${i}" value="yes" required><span>Oui</span></label><label><input type="radio" name="value-${i}" value="mixed"><span>Non / mitigé</span></label></div></fieldset>`).join("")}</div>` : `<div class="empty-card slim"><p>Pour éclairer ce choix, note d’abord une ou deux choses importantes pour toi.</p><button type="button" class="button button-soft" data-action="edit-essentials" data-resume-decision="true">Ajouter mes importants</button></div>`}</form>`;
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
