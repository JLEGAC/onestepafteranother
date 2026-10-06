import { badgesFor, themeRewards, levelFor } from "./gamification.js";
import { activeHabits, dateShift, habitDaySummary, habitStreak, isHabitDone, monthGrid, isoFromMonthDay, challengeProgress } from "./engagement.js";
import { mondayISO, todayISO } from "./data.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const categories = { serenity: ["🌿", "Sérénité"], focus: ["🎯", "Focus"], inspiration: ["💖", "Inspiration"], boost: ["🔋", "Coup de boost"] };
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedHabitId = "";
let selectedHabitDate = todayISO();

export function changeHabitMonth(offset) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
}

export function selectHabitFilter(id = "") { selectedHabitId = id; }
export function selectHabitDate(date) { selectedHabitDate = date; }

function habitCell(state, day, selected) {
  if (!day) return `<span class="habit-day-cell empty"></span>`;
  const date = isoFromMonthDay(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
  const today = date === todayISO();
  if (date > todayISO()) return `<span class="habit-day-cell future${today ? " is-today" : ""}">${day}</span>`;
  if (selected) {
    const done = isHabitDone(state, selected, date);
    return `<button class="habit-day-cell ${done ? "h100" : "h0"}${today ? " is-today" : ""}${selectedHabitDate === date ? " is-selected" : ""}" data-action="habit-date" data-date="${date}" aria-label="${day} : ${done ? "habitude tenue" : "non renseigné"}">${day}</button>`;
  }
  const summary = habitDaySummary(state, date);
  const tone = summary.total === 0 || summary.done === 0 ? "h0" : summary.percent === 100 ? "h100" : summary.percent >= 50 ? "h50" : "h1";
  return `<button class="habit-day-cell ${tone}${today ? " is-today" : ""}${selectedHabitDate === date ? " is-selected" : ""}" data-action="habit-date" data-date="${date}" title="${summary.done}/${summary.total} habitudes">${day}</button>`;
}

export function renderHabitsPage(state) {
  const habits = activeHabits(state);
  const summary = habitDaySummary(state, todayISO());
  const filter = habits.some(habit => habit.id === selectedHabitId) ? selectedHabitId : "";
  selectedHabitId = filter;
  const currentHabit = habits.find(habit => habit.id === filter);
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(calendarMonth);
  const cells = monthGrid(year, month);
  const filteredLogs = currentHabit ? Object.entries(state.habitLogs).filter(([, day]) => day[currentHabit.id]).length : 0;
  const streak = currentHabit ? habitStreak(state, currentHabit.id) : 0;
  const totalPoints = state.xp.events.filter(item => item.reason === "habit" || item.reason === "habit-grand-slam").reduce((sum, item) => sum + item.amount, 0);
  const selectedSummary = habitDaySummary(state, selectedHabitDate);
  const selectedHabits = currentHabit ? [currentHabit] : habits;
  const dateEvents = state.xp.events.filter(item => item.reason === "habit" && item.key.endsWith(`:${selectedHabitDate}`));
  const basePoints = dateEvents.reduce((sum, item) => sum + item.amount, 0);
  const grandSlam = state.xp.events.find(item => item.reason === "habit-grand-slam" && item.key.endsWith(`:${selectedHabitDate}`));
  const detailDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${selectedHabitDate}T12:00:00`));
  return `<div class="page-title-row"><div><div class="eyebrow">TES PETITS RITUELS</div><h1>Habitudes</h1><p class="page-subtitle">Chaque retour compte. Tu peux reprendre quand tu veux.</p></div><button class="round-add" data-action="new-habit" aria-label="Ajouter une habitude">+</button></div>
    <section class="habit-today-card"><div><div class="eyebrow">AUJOURD’HUI</div><h2>${summary.done}/${summary.total} habitudes</h2></div><strong>✨ ${state.xp.total} XP</strong><div class="progress-track"><span style="width:${summary.percent}%"></span></div><small>+1 XP par habitude · +10 XP pour le Grand Chelem${state.habits.length ? " · bonus doublé après 7 jours d’affilée" : ""}</small></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">MES HABITUDES</div><h2>Mon rythme, mes repères</h2></div><span class="count-badge">${habits.length}</span></div>
    ${habits.length ? habits.map(habit => `<article class="habit-row"><button class="habit-check ${isHabitDone(state, habit.id) ? "checked" : ""}" data-action="toggle-habit" data-id="${habit.id}" aria-label="${isHabitDone(state, habit.id) ? "Décocher" : "Valider"} ${esc(habit.title)}">${isHabitDone(state, habit.id) ? "✓" : ""}</button><button class="habit-row-copy" data-action="habit-filter" data-id="${habit.id}"><b>${esc(habit.emoji || "🌱")} ${esc(habit.title)}</b><small>${esc(habit.description || "")}${habit.description ? " · " : ""}🔥 ${habitStreak(state, habit.id)} j.</small></button><button class="more-button" data-action="edit-habit" data-id="${habit.id}" aria-label="Modifier">···</button></article>`).join("") : `<div class="empty-card slim"><h3>Choisis un petit rituel</h3><p>Une habitude peut soutenir une Grande Pierre ou simplement te faire du bien.</p><button class="button button-primary" data-action="new-habit">＋ Ajouter ma première habitude</button></div>`}</section>
    <section class="section habit-calendar-section"><div class="section-heading"><div><div class="eyebrow">TON HISTOIRE EN COULEURS</div><h2>Calendrier</h2></div></div>
      <div class="habit-filters"><button class="need-chip ${!filter ? "selected" : ""}" data-action="habit-filter" data-id="">Toutes</button>${habits.map(habit => `<button class="need-chip ${filter === habit.id ? "selected" : ""}" data-action="habit-filter" data-id="${habit.id}">${esc(habit.emoji || "🌱")} ${esc(habit.title)}</button>`).join("")}</div>
      <div class="calendar-heading"><button class="icon-button" data-action="habit-month" data-offset="-1" aria-label="Mois précédent">‹</button><b>${esc(monthName)}</b><button class="icon-button" data-action="habit-month" data-offset="1" aria-label="Mois suivant">›</button></div>
      <div class="habit-calendar"><div class="weekday">L</div><div class="weekday">M</div><div class="weekday">M</div><div class="weekday">J</div><div class="weekday">V</div><div class="weekday">S</div><div class="weekday">D</div>${cells.map(day => habitCell(state, day, filter)).join("")}</div>
      <div class="habit-legend"><span><i class="h0"></i> Vide</span><span><i class="h1"></i> Quelques habitudes</span><span><i class="h50"></i> ≥ 50 %</span><span><i class="h100"></i> 100 %</span></div>
      <div class="habit-day-detail"><b>Détail du ${esc(detailDate)}</b><span>Habitudes : ${currentHabit ? (isHabitDone(state, currentHabit.id, selectedHabitDate) ? "1/1" : "0/1") : `${selectedSummary.done}/${selectedSummary.total}`} (${currentHabit ? (isHabitDone(state, currentHabit.id, selectedHabitDate) ? "100" : "0") : selectedSummary.percent} %)</span>${selectedHabits.map(habit => `<small>${isHabitDone(state, habit.id, selectedHabitDate) ? "✓" : "○"} ${esc(habit.title)}</small>`).join("") || `<small>Aucune habitude active à cette date.</small>`}<span>Gain de base : +${basePoints} XP</span>${grandSlam ? `<span>Bonus Grand Chelem : +${grandSlam.amount} XP</span>` : ""}</div>
      ${currentHabit ? `<div class="habit-streak-card"><div><span>🔥</span><b>${streak} jour${streak > 1 ? "s" : ""} de suite</b></div><p>${filteredLogs} jours cochés dans l’historique · ${totalPoints} XP gagnés avec tes habitudes</p><small>Le multiplicateur x2 s’active à partir de 7 jours consécutifs.</small></div>` : `<p class="form-hint">Choisis une habitude pour voir sa série et son historique individuel.</p>`}
    </section>
    <button class="button button-outline wide" data-page="cible">← Retour à mes objectifs et habitudes</button>`;
}

export function renderHabitHome(state) {
  const habits = activeHabits(state);
  if (!habits.length) return `<section class="section habit-home-card"><div class="section-heading"><div><div class="eyebrow">MES HABITUDES</div><h2>Un rituel à la fois</h2></div><button type="button" class="text-button" data-page="cible">Configurer →</button></div><div class="empty-card slim"><p>Choisis une habitude pour célébrer les gestes qui te font du bien.</p><button type="button" class="button button-soft" data-action="new-habit">＋ Ajouter une habitude</button></div></section>`;
  const start = mondayISO(new Date());
  const weekdays = ["L", "M", "M", "J", "V", "S", "D"];
  return `<section class="section habit-home-card"><div class="section-heading"><div><div class="eyebrow">MES HABITUDES</div><h2>Cette semaine</h2></div><button type="button" class="text-button" data-page="cible">Voir mes habitudes →</button></div><div class="habit-carousel">${habits.map(habit => `<article class="habit-week-card"><div class="habit-week-title"><button type="button" class="habit-week-check ${isHabitDone(state, habit.id) ? "checked" : ""}" data-action="toggle-habit" data-id="${esc(habit.id)}" aria-label="${isHabitDone(state, habit.id) ? "Décocher" : "Valider"} ${esc(habit.title)}">${isHabitDone(state, habit.id) ? "✓" : ""}</button><button type="button" class="habit-week-name" data-action="edit-habit" data-id="${esc(habit.id)}">${esc(habit.emoji || "🌱")} ${esc(habit.title)}</button></div><div class="habit-week-dots">${weekdays.map((label, index) => { const date = dateShift(start, index); return `<span class="habit-week-day"><i class="${isHabitDone(state, habit.id, date) ? "done" : ""}" title="${date}"></i><small>${label}</small></span>`; }).join("")}</div></article>`).join("")}</div></section>`;
}

export function habitForm(habit = null, state = null) {
  const objectives = (state?.stones || []).map(stone => `<option value="${esc(stone.id)}" ${habit?.linkedStoneId === stone.id ? "selected" : ""}>🎯 ${esc(stone.title)}</option>`).join("");
  return `<form id="habit-form"><label>Nom de l’habitude<input name="title" required maxlength="70" placeholder="Ex. Boire 1,5 L d’eau" value="${esc(habit?.title || "")}"></label><label>Repère ou intention <small>(facultatif)</small><input name="description" maxlength="100" placeholder="Ex. Garder ma gourde près de moi" value="${esc(habit?.description || "")}"></label><label>Symbole<input name="emoji" maxlength="4" value="${esc(habit?.emoji || "🌱")}"></label><label class="form-check-line"><input type="checkbox" name="linkedVision" ${habit?.linkedVision ? "checked" : ""}> Cette habitude est liée à ma Vision ✨</label>${objectives ? `<label>Objectif associé <small>(facultatif)</small><select name="linkedStoneId"><option value="">Aucun</option>${objectives}</select></label>` : ""}<input type="hidden" name="id" value="${esc(habit?.id || "")}"></form>`;
}

export function renderChallengesPage(state) {
  const active = state.challenges.filter(item => item.status === "active");
  const done = state.challenges.filter(item => item.status === "completed");
  const fmt = date => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
  const cards = state.challenges.map(challenge => {
    const progress = challengeProgress(challenge);
    const linkedHabit = state.habits.find(habit => habit.id === challenge.linkedHabitId);
    const linkedStone = state.stones.find(stone => stone.id === challenge.linkedStoneId);
    const inWindow = todayISO() >= challenge.startDate && todayISO() <= challenge.endDate;
    const statusLabel = challenge.status === "completed" ? "Défi relevé" : challenge.status === "stopped" ? "Mis de côté" : challenge.status === "expired" ? "Période terminée" : `Jusqu’au ${fmt(challenge.endDate)}`;
    return `<article class="challenge-card ${challenge.status !== "active" ? "is-complete" : ""}"><div class="challenge-top"><span>🎯 ${statusLabel}</span><strong>${progress.completed}/${progress.target} jours</strong></div><h3>${esc(challenge.title)}</h3><p>${esc(challenge.description)}</p>${linkedHabit ? `<small>🌱 Habitude : ${esc(linkedHabit.title)}</small>` : linkedStone ? `<small>${esc(linkedStone.icon || "💎")} Grande Pierre : ${esc(linkedStone.title)}</small>` : ""}<div class="progress-track"><span style="width:${progress.percent}%"></span></div>${challenge.status === "active" ? `<div class="challenge-actions"><button class="button button-primary button-small" data-action="challenge-today" data-id="${challenge.id}" ${!inWindow || challenge.completedDates.includes(todayISO()) ? "disabled" : ""}>${challenge.completedDates.includes(todayISO()) ? "✓ Fait aujourd’hui" : inWindow ? "Valider aujourd’hui" : "Période terminée"}</button><button class="text-button" data-action="stop-challenge" data-id="${challenge.id}">Mettre de côté</button></div>` : `<small>${challenge.status === "completed" ? "+3 XP par jour · +15 XP à la fin" : "Tes XP gagnés restent acquis."}</small>`}</article>`;
  }).join("");
  return `<div class="page-title-row"><div><div class="eyebrow">UN PETIT ÉLAN CHOISI</div><h1>Défis</h1><p class="page-subtitle">Un défi t’invite. Tu gardes toujours la main.</p></div><button class="round-add" data-action="new-challenge" aria-label="Créer un défi">+</button></div>
    <section class="challenge-summary"><strong>${active.length} défi${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""}</strong><span>🏅 ${done.length} accompli${done.length > 1 ? "s" : ""}</span><p>Tu reçois des XP quand tu avances. Aucun point n’est retiré si tu fais une pause.</p></section>
    ${cards || `<div class="empty-card"><span class="empty-icon">🎯</span><h3>Choisis un défi à ta mesure</h3><p>Commence petit, puis ajuste ton défi à ta vraie semaine.</p><button class="button button-primary" data-action="new-challenge">＋ Créer un défi</button></div>`}
    ${active.length < 1 ? `<section class="section"><div class="section-heading"><div><div class="eyebrow">POUR T’AIDER À COMMENCER</div><h2>Quelques idées</h2></div></div><div class="challenge-ideas"><button data-action="challenge-template" data-title="Noter 3 gratitudes" data-description="Écrire trois choses pour lesquelles je suis reconnaissant·e." data-target="3">🌟 Noter 3 gratitudes · 3 jours sur 7</button><button data-action="challenge-template" data-title="Lire 10 minutes" data-description="M’accorder dix minutes de lecture pour le plaisir." data-target="4">📖 Lire 10 minutes · 4 jours sur 7</button><button data-action="challenge-template" data-title="Faire un petit pas vers ma vision" data-description="Choisir une action qui fait avancer une Grande Pierre." data-target="3">💎 Avancer une Grande Pierre · 3 jours sur 7</button></div></section>` : `<p class="form-hint">Un seul défi actif à la fois. Termine-le ou mets-le de côté pour en choisir un autre.</p>`}
    <button class="button button-outline wide" data-page="tools">← Retour à la Boîte à outils</button>`;
}

export function challengeForm(state, preset = {}) {
  const habits = activeHabits(state);
  const habitOptions = habits.map(item => `<option value="${item.id}" ${preset.linkedHabitId === item.id ? "selected" : ""}>${esc(item.title)}</option>`).join("");
  const stoneOptions = state.stones.map(item => `<option value="${item.id}" ${preset.linkedStoneId === item.id ? "selected" : ""}>${esc(item.icon || "💎")} ${esc(item.title)}</option>`).join("");
  return `<form id="challenge-form"><label>Intitulé du défi<input name="title" required maxlength="80" placeholder="Ex. Noter 3 gratitudes" value="${esc(preset.title || "")}"></label><label>Ce que je vais faire<textarea name="description" required rows="2" placeholder="Une consigne simple et concrète">${esc(preset.description || "")}</textarea></label><label>Mon objectif sur les 7 prochains jours<select name="targetDays">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${Number(preset.targetDays || 3) === n ? "selected" : ""}>${n} jour${n > 1 ? "s" : ""}</option>`).join("")}</select></label>${habits.length ? `<label>Habitude associée <small>(facultatif)</small><select name="linkedHabitId"><option value="">Aucune</option>${habitOptions}</select></label>` : ""}${stoneOptions ? `<label>Grande Pierre associée <small>(facultatif)</small><select name="linkedStoneId"><option value="">Aucune</option>${stoneOptions}</select></label>` : ""}<p class="form-hint">Tu recevras 3 XP chaque jour validé et 15 XP lorsque tu atteins ton objectif. Une journée manquée n’enlève aucun XP.</p></form>`;
}

export function renderCapsulesPage(state) {
  const capsules = state.capsules || [];
  const watched = capsules.filter(item => item.watchedAt).length;
  return `<div class="page-title-row"><div><div class="eyebrow">UNE MINUTE POUR TOI</div><h1>Capsules</h1><p class="page-subtitle">Des idées courtes à retrouver au bon moment.</p></div><button class="round-add" data-action="new-capsule" aria-label="Ajouter une capsule vidéo">+</button></div>
    <section class="capsule-intro"><span>🎬</span><div><b>À regarder quand tu en as besoin</b><p>Ajoute tes vidéos ou ressources favorites. Elles restent disponibles dans ta collection sur cet appareil.</p></div><strong>${watched}/${capsules.length} vues</strong></section>
    <div class="need-grid capsule-filters">${Object.entries(categories).map(([key, [emoji, label]]) => `<button class="need-chip" data-capsule-filter="${key}">${emoji} ${label}</button>`).join("")}</div>
    <section class="section capsule-list">${capsules.length ? capsules.map(capsule => {
      const [emoji, label] = categories[capsule.category] || categories.inspiration;
      return `<article class="capsule-card" data-categories="${esc(capsule.category || "inspiration")}"><div class="capsule-icon">${emoji}</div><div class="capsule-copy"><small>${label}${capsule.duration ? ` · ${esc(capsule.duration)}` : ""}</small><h3>${esc(capsule.title)}</h3><p>${esc(capsule.description)}</p><div class="capsule-actions">${safeVideoUrl(capsule.url) ? `<a class="button button-soft button-small" href="${esc(safeVideoUrl(capsule.url))}" target="_blank" rel="noopener noreferrer">▶ Regarder</a>` : `<span class="form-hint">Ajoute un lien vidéo pour la lancer.</span>`}${capsule.watchedAt ? `<span class="watched-label">✓ Vue</span>` : `<button class="text-button" data-action="mark-capsule" data-id="${capsule.id}">Marquer comme vue · +3 XP</button>`}</div></div><div class="capsule-manage"><button class="more-button" data-action="edit-capsule" data-id="${capsule.id}" aria-label="Modifier la capsule">✎</button><button class="remove-win" data-action="remove-capsule" data-id="${capsule.id}" aria-label="Supprimer la capsule">×</button></div></article>`;
    }).join("") : `<div class="empty-card"><span class="empty-icon">🎬</span><h3>Ta collection commence ici</h3><p>Ajoute un titre, une courte intention et un lien vers une vidéo de 1 à 2 minutes.</p><button class="button button-primary" data-action="new-capsule">＋ Ajouter une capsule</button></div>`}</section>
    <p class="offline-hint">Les fiches sont enregistrées sur cet appareil. Les vidéos en ligne demandent une connexion Internet.</p><button class="button button-outline wide" data-page="tools">← Retour à la Boîte à outils</button>`;
}

function safeVideoUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

export function capsuleForm(capsule = null) {
  const values = Object.entries(categories).map(([key, [emoji, label]]) => `<option value="${key}" ${capsule?.category === key ? "selected" : ""}>${emoji} ${label}</option>`).join("");
  return `<form id="capsule-form"><label>Titre<input name="title" required maxlength="80" placeholder="Ex. Sortir du stress" value="${esc(capsule?.title || "")}"></label><label>Ce que cette capsule peut t’apporter<textarea name="description" required rows="2" placeholder="Une idée à retenir ou un exercice à essayer">${esc(capsule?.description || "")}</textarea></label><label>Catégorie<select name="category">${values}</select></label><label>Durée estimée <small>(facultatif)</small><input name="duration" maxlength="12" placeholder="1 min 30" value="${esc(capsule?.duration || "")}"></label><label>Lien vers la vidéo<input name="url" type="url" placeholder="https://…" value="${esc(capsule?.url || "")}"></label><p class="form-hint">Ajoute un lien HTTPS. La capsule et son lien restent enregistrés localement ; la lecture nécessite Internet.</p><input type="hidden" name="id" value="${esc(capsule?.id || "")}"></form>`;
}

export function renderRewardsPage(state) {
  const badges = badgesFor(state);
  const level = levelFor(state.xp.total);
  const themes = themeRewards.map(theme => {
    const locked = level.level < theme.level;
    return `<label class="theme-option ${state.preferences.theme === theme.id ? "selected" : ""} ${locked ? "locked" : ""}"><input type="radio" name="theme" data-theme-setting value="${theme.id}" ${state.preferences.theme === theme.id ? "checked" : ""} ${locked ? "disabled" : ""}><span class="theme-swatch theme-${theme.id}">✦</span><b>${theme.name}</b><small>${locked ? `Niveau ${theme.level}` : "Débloqué"}</small></label>`;
  }).join("");
  return `<div class="page-title-row"><div><div class="eyebrow">TES TRACES ET TES TROPHÉES</div><h1>Mes récompenses</h1><p class="page-subtitle">Les XP célèbrent tes pas et ouvrent des options de personnalisation.</p></div><span class="tool-points">✨ ${state.xp.total}</span></div>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">COLLECTION DE BADGES</div><h2>${badges.filter(item => item.unlocked).length}/${badges.length} obtenus</h2></div></div><div class="badge-grid">${badges.map(badge => `<article class="badge-card ${badge.unlocked ? "unlocked" : "locked"}"><span>${badge.unlocked ? badge.icon : "🔒"}</span><b>${esc(badge.title)}</b><small>${esc(badge.description)}</small></article>`).join("")}</div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">APPARENCE</div><h2>Choisis ton ambiance</h2></div></div><div class="theme-grid">${themes}</div><p class="form-hint">De nouvelles ambiances se dévoilent avec les niveaux. Tes données et tes fonctions ne dépendent jamais de ces choix.</p></section>
    <button class="button button-outline wide" data-page="profile">← Retour au Profil</button>`;
}
