import { addXP, badgesFor, levelFor, milestoneFor, pointsForAction, themeRewards } from "./gamification.js";
import { createInitialState, exportObject, getCurrentWeek, loadState, newId, saveState, stoneProgress, todayISO, validateImport } from "./data.js";
import { actionForm, appShell, blockerForm, customToolForm, decisionForm, modal, retroForm, stoneForm, visionForm } from "./views.js";
import { changeHabitMonth, selectHabitDate, selectHabitFilter, habitForm, challengeForm, capsuleForm } from "./engagement-views.js";
import { createChallenge, expireChallenges, markCapsuleWatched, markChallengeDay, stopChallenge, toggleHabit } from "./engagement.js";

let state = await loadState();
if (expireChallenges(state)) await saveState(state);
let page = location.hash.slice(1) || "home";
let pendingAction = null;
let pendingImport = null;
let soundCtx = null;
let installPrompt = null;
let resumeDecisionAfterEssentials = false;
let pendingDecisionProposal = "";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

function render() {
  document.documentElement.dataset.theme = state.preferences.theme || "forest";
  app.innerHTML = appShell(state, page);
  if (installPrompt && page === "home" && !window.matchMedia("(display-mode: standalone)").matches) {
    const banner = document.createElement("div");
    banner.className = "install-banner";
    banner.innerHTML = `<span>📲</span><span><b>Emporte ton cap avec toi</b><small>Installe l’application sur ton téléphone.</small></span><button class="button button-primary button-small" data-action="install-app">Installer</button>`;
    document.querySelector("#page-content").prepend(banner);
  }
  bindPageInteractions();
}

function navigate(next, replace = false) {
  page = next;
  const url = `#${next}`;
  if (replace) history.replaceState({ page }, "", url); else history.pushState({ page }, "", url);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showModal(html) {
  modalRoot.innerHTML = html;
  const dialog = modalRoot.querySelector(".modal-card");
  dialog?.focus?.();
  bindModalInteractions();
}

function closeModal() { modalRoot.innerHTML = ""; pendingAction = null; }

function toast(message, emoji = "✨") {
  toastRoot.innerHTML = `<div class="toast"><span>${emoji}</span>${message}</div>`;
  window.setTimeout(() => { toastRoot.innerHTML = ""; }, 3200);
}

function celebrate(message) {
  toast(message, "🎉");
  if (state.preferences.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  for (let i = 0; i < 34; i++) {
    const bit = document.createElement("i");
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.animationDelay = `${Math.random() * 450}ms`;
    bit.style.setProperty("--spin", `${Math.random() * 500 - 250}deg`);
    layer.append(bit);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1900);
  if (state.preferences.sound) playChime();
}

function playChime() {
  try {
    soundCtx ||= new AudioContext();
    [523, 659, 784].forEach((frequency, i) => {
      const oscillator = soundCtx.createOscillator();
      const gain = soundCtx.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.001, soundCtx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.07, soundCtx.currentTime + i * 0.09 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + i * 0.09 + 0.22);
      oscillator.connect(gain); gain.connect(soundCtx.destination);
      oscillator.start(soundCtx.currentTime + i * 0.09); oscillator.stop(soundCtx.currentTime + i * 0.09 + 0.24);
    });
  } catch { /* audio remains optional */ }
}

async function persist() { await saveState(state); }

function bindPageInteractions() {
  document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault(); navigate(button.dataset.page);
  }));
  document.querySelectorAll("[data-energy]").forEach(button => button.addEventListener("click", async () => {
    const today = todayISO(); state.daily[today] ||= {}; state.daily[today].energy = Number(button.dataset.energy);
    const key = `energy:${today}`; if (addXP(state, 2, "daily check-in", key)) toast("+2 XP pour avoir pris un instant pour toi.");
    await persist(); render();
  }));
  document.querySelectorAll("[data-mood]").forEach(button => button.addEventListener("click", async () => {
    const today = todayISO(); state.daily[today] ||= {}; state.daily[today].mood = button.dataset.mood;
    const key = `mood:${today}`; if (addXP(state, 2, "daily check-in", key)) toast("+2 XP pour ce petit point avec toi-même.");
    await persist(); render();
  }));
  document.querySelector("#win-form")?.addEventListener("submit", async event => {
    event.preventDefault(); const input = new FormData(event.currentTarget).get("win")?.toString().trim();
    if (!input) return; const today = todayISO(); state.daily[today] ||= {}; state.daily[today].wins ||= []; state.daily[today].wins.unshift(input);
    if (addXP(state, 5, "victory", newId("win"))) celebrate("+5 XP · une victoire de plus dans ton livre d’or !");
    await persist(); render();
  });
  document.querySelectorAll("[data-remove-win]").forEach(button => button.addEventListener("click", async () => {
    const wins = state.daily[todayISO()]?.wins || []; wins.splice(Number(button.dataset.removeWin), 1); await persist(); render();
  }));
  document.querySelectorAll("[data-tool-filter]").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.toolFilter; const wasActive = button.classList.contains("selected");
    document.querySelectorAll("[data-tool-filter]").forEach(item => item.classList.remove("selected"));
    document.querySelectorAll("[data-categories]").forEach(card => card.hidden = false);
    if (!wasActive) {
      button.classList.add("selected");
      document.querySelectorAll("[data-categories]").forEach(card => card.hidden = !card.dataset.categories.split(" ").includes(category));
    }
  }));
  document.querySelectorAll("[data-capsule-filter]").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.capsuleFilter; const wasActive = button.classList.contains("selected");
    document.querySelectorAll("[data-capsule-filter]").forEach(item => item.classList.remove("selected"));
    document.querySelectorAll(".capsule-card").forEach(card => card.hidden = false);
    if (!wasActive) {
      button.classList.add("selected");
      document.querySelectorAll(".capsule-card").forEach(card => card.hidden = !card.dataset.categories.split(" ").includes(category));
    }
  }));
  document.querySelectorAll("[data-setting]").forEach(input => input.addEventListener("change", async () => {
    state.preferences[input.dataset.setting] = input.checked;
    await persist();
    toast(input.checked ? "Préférence activée." : "Préférence désactivée.");
  }));
  document.querySelectorAll("[data-theme-setting]").forEach(input => input.addEventListener("change", async () => {
    const theme = themeRewards.find(item => item.id === input.value);
    if (!theme || levelFor(state.xp.total).level < theme.level) return;
    state.preferences.theme = theme.id; await persist(); render(); celebrate(`Ambiance ${theme.name} activée !`);
  }));
  document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset)));
}

function bindModalInteractions() {
  modalRoot.querySelectorAll('[data-action]:not(.modal-backdrop)').forEach(button => button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset)));
  modalRoot.querySelector(".modal-backdrop")?.addEventListener("click", event => { if (event.target === event.currentTarget) closeModal(); });
  modalRoot.querySelector("#action-form")?.addEventListener("change", event => {
    if (event.target.name === "effort") modalRoot.querySelector("#xxl-note").hidden = event.target.value !== "XXL";
  });
  modalRoot.querySelector("#action-form")?.addEventListener("submit", saveActionForm);
  modalRoot.querySelector("#stone-form")?.addEventListener("submit", saveStoneForm);
  modalRoot.querySelector("#vision-form")?.addEventListener("submit", saveVisionForm);
  modalRoot.querySelector("#story-form")?.addEventListener("submit", saveStoryForm);
  modalRoot.querySelector("#essentials-form")?.addEventListener("submit", saveEssentialsForm);
  modalRoot.querySelector("#resonance-form")?.addEventListener("submit", saveResonanceForm);
  modalRoot.querySelector("#guides-form")?.addEventListener("submit", saveGuidesForm);
  modalRoot.querySelector("#decision-form")?.addEventListener("submit", showDecisionResult);
  modalRoot.querySelector("#retro-form")?.addEventListener("submit", saveRetro);
  modalRoot.querySelector("#blocker-form")?.addEventListener("submit", saveBlockerChoice);
  modalRoot.querySelector("#custom-tool-form")?.addEventListener("submit", saveCustomTool);
  modalRoot.querySelector("#habit-form")?.addEventListener("submit", saveHabitForm);
  modalRoot.querySelector("#challenge-form")?.addEventListener("submit", saveChallengeForm);
  modalRoot.querySelector("#capsule-form")?.addEventListener("submit", saveCapsuleForm);
  modalRoot.querySelectorAll("[data-stone-template]").forEach(button => button.addEventListener("click", () => fillStoneTemplate(button.dataset.stoneTemplate)));
}

async function handleAction(action, data = {}) {
  if (action === "close-modal") return closeModal();
  if (action === "new-action") return showModal(actionForm(state, null, data.stone || ""));
  if (action === "edit-action") return showModal(actionForm(state, state.actions.find(item => item.id === data.id)));
  if (action === "complete-action") return completeAction(data.id);
  if (action === "plan-action") return planAction(data.id);
  if (action === "plan-today") return planToday(data.id);
  if (action === "new-stone") return showModal(stoneForm());
  if (action === "edit-stone") return showModal(stoneForm(state.stones.find(item => item.id === data.id)));
  if (action === "new-admin-stone") return createAdminStone();
  if (action === "blocked") return showModal(blockerForm(state.actions.find(item => item.id === data.id)));
  if (action === "dismiss-reminder") { state.daily[todayISO()] ||= {}; state.daily[todayISO()].dismissedReminder = true; persist().then(render); }
  if (action === "new-tool") return showModal(customToolForm());
  if (action === "remove-tool") return removeTool(data.id);
  if (action === "confirm-import") return confirmImport();
  if (action === "install-app") return installApp();
  if (action === "edit-vision") return showModal(visionForm(state, "vision"));
  if (action === "edit-story") return showModal(visionForm(state, "story"));
  if (action === "edit-essentials") { resumeDecisionAfterEssentials = data.resumeDecision === "true"; if (resumeDecisionAfterEssentials) pendingDecisionProposal = modalRoot.querySelector('[name="proposal"]')?.value || ""; return showModal(visionForm(state, "essentials")); }
  if (action === "edit-resonance") return showModal(visionForm(state, "resonance"));
  if (action === "edit-guides") return showModal(visionForm(state, "guides"));
  if (action === "decision") return showModal(decisionForm(state));
  if (action === "retro") return showModal(retroForm(state, data.week || ""));
  if (action === "split-action") return splitAction();
  if (action === "breathing") return startBreathing();
  if (action === "past-wins") return showPastWins();
  if (action === "export") return exportData();
  if (action === "import") return importData();
  if (action === "reset") return resetData();
  if (action === "stone-detail") return showStoneDetail(data.id);
  if (action === "new-habit") return showModal(modal("Ajouter une habitude", habitForm(), `<button class="button button-primary wide" form="habit-form">Ajouter à mon suivi</button>`));
  if (action === "edit-habit") return showModal(modal("Modifier mon habitude", habitForm(state.habits.find(item => item.id === data.id)), `<button class="button button-primary wide" form="habit-form">Enregistrer</button><button type="button" class="button button-outline" data-action="archive-habit" data-id="${data.id}">Archiver</button>`));
  if (action === "archive-habit") return archiveHabit(data.id);
  if (action === "habit-filter") { selectHabitFilter(data.id || ""); render(); }
  if (action === "habit-month") { changeHabitMonth(Number(data.offset) || 0); render(); }
  if (action === "habit-date") { selectHabitDate(data.date); render(); }
  if (action === "toggle-habit") return handleHabitToggle(data.id);
  if (action === "new-challenge") {
    if (state.challenges.filter(item => item.status === "active").length >= 1) return toast("Un seul défi actif à la fois. Termine-le ou mets-le de côté pour en choisir un autre.", "🎯");
    return showModal(modal("Choisir mon défi", challengeForm(state), `<button class="button button-primary wide" form="challenge-form">Lancer ce défi</button>`));
  }
  if (action === "challenge-template") {
    if (state.challenges.filter(item => item.status === "active").length >= 1) return toast("Un seul défi actif à la fois.", "🎯");
    return showModal(modal("Personnaliser mon défi", challengeForm(state, { title: data.title, description: data.description, targetDays: data.target }), `<button class="button button-primary wide" form="challenge-form">Lancer ce défi</button>`));
  }
  if (action === "challenge-today") return handleChallengeDay(data.id);
  if (action === "stop-challenge") return handleStopChallenge(data.id);
  if (action === "new-capsule") return showModal(modal("Ajouter une capsule vidéo", capsuleForm(), `<button class="button button-primary wide" form="capsule-form">Ajouter à ma collection</button>`));
  if (action === "edit-capsule") return showModal(modal("Modifier la capsule", capsuleForm(state.capsules.find(item => item.id === data.id)), `<button class="button button-primary wide" form="capsule-form">Enregistrer</button>`));
  if (action === "mark-capsule") return handleCapsuleWatched(data.id);
  if (action === "remove-capsule") return removeCapsule(data.id);
}

async function completeAction(id) {
  const action = state.actions.find(item => item.id === id);
  if (!action || action.status === "done") return;
  const before = previousBadges();
  const previousLevel = levelFor(state.xp.total).level;
  action.status = "done"; action.completedAt = new Date().toISOString();
  const points = pointsForAction(action); addXP(state, points, "action", id);
  const currentLevel = levelFor(state.xp.total).level;
  const badge = newBadgeMessage(before);
  const newThemes = themeRewards.filter(theme => theme.level > previousLevel && theme.level <= currentLevel).map(theme => `Ambiance ${theme.name} débloquée`).join(" · ");
  const message = [currentLevel > previousLevel ? `Niveau ${currentLevel} atteint !` : "", newThemes, milestoneFor(state, action), `+${points} XP`, badge].filter(Boolean).join(" · ");
  await persist(); render(); celebrate(message);
}

function previousBadges() { return new Set(badgesFor(state).filter(item => item.unlocked).map(item => item.id)); }

function newBadgeMessage(before) {
  const unlocked = badgesFor(state).filter(item => item.unlocked && !before.has(item.id));
  return unlocked.length ? `Badge obtenu : ${unlocked.map(item => item.title).join(", ")} !` : "";
}

async function handleHabitToggle(id) {
  const before = previousBadges();
  const result = toggleHabit(state, id);
  if (!result.changed) return;
  const reward = result.rewards.reduce((sum, item) => sum + item.amount, 0);
  const badge = newBadgeMessage(before);
  await persist(); render();
  if (result.completed && reward) celebrate([`+${reward} XP · ${result.rewards.map(item => item.label).join(" + ")}`, badge].filter(Boolean).join(" · "));
  else if (result.completed) toast("Habitude de nouveau cochée · les XP de cette date avaient déjà été gagnés.", "🌱");
  else toast("Habitude décochée. Tes XP déjà gagnés restent acquis.", "🌿");
}

async function saveHabitForm(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const id = fd.get("id");
  const existing = state.habits.find(item => item.id === id);
  const record = { id: id || newId("habit"), title: fd.get("title").trim(), description: fd.get("description").trim(), emoji: fd.get("emoji").trim() || "🌱", active: true, createdAt: existing?.createdAt || new Date().toISOString(), createdAtDate: existing?.createdAtDate || todayISO(), archivedAt: "" };
  if (existing) Object.assign(existing, record); else state.habits.unshift(record);
  await persist(); closeModal(); render(); celebrate(existing ? "Habitude mise à jour." : "Nouvelle habitude ajoutée · +1 XP à chaque pas tenu.");
}

async function archiveHabit(id) {
  const habit = state.habits.find(item => item.id === id);
  if (!habit) return;
  habit.active = false; habit.archivedAt = todayISO(); await persist(); closeModal(); render(); toast("Habitude archivée. Son historique reste dans ton calendrier.", "🌱");
}

async function saveChallengeForm(event) {
  event.preventDefault();
  if (state.challenges.filter(item => item.status === "active").length >= 1) return toast("Un seul défi actif à la fois.", "🎯");
  const fd = new FormData(event.currentTarget);
  const challenge = createChallenge(state, { title: fd.get("title"), description: fd.get("description"), targetDays: fd.get("targetDays"), linkedHabitId: fd.get("linkedHabitId"), linkedStoneId: fd.get("linkedStoneId") });
  await persist(); closeModal(); render(); celebrate(`Défi lancé : ${challenge.title} · à ton rythme !`);
}

async function handleChallengeDay(id) {
  const before = previousBadges();
  const result = markChallengeDay(state, id);
  if (!result.changed) return toast("Cette étape n’est pas disponible aujourd’hui.", "🗓️");
  const reward = result.rewards.reduce((sum, item) => sum + item.amount, 0);
  const badge = newBadgeMessage(before);
  await persist(); render();
  celebrate([result.completed ? `Défi accompli · +${reward} XP` : `Un jour de plus · +${reward} XP`, badge].filter(Boolean).join(" · "));
}

async function handleStopChallenge(id) {
  if (!stopChallenge(state, id)) return;
  await persist(); render(); toast("Défi mis de côté. Tu pourras en choisir un autre quand tu veux.", "🌿");
}

async function saveCapsuleForm(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const id = fd.get("id");
  const url = fd.get("url").trim();
  if (url) { try { if (new URL(url).protocol !== "https:") throw new Error(); } catch { toast("Saisis un lien vidéo HTTPS valide.", "🎬"); return; } }
  const existing = state.capsules.find(item => item.id === id);
  const record = { id: id || newId("capsule"), title: fd.get("title").trim(), description: fd.get("description").trim(), category: fd.get("category"), duration: fd.get("duration").trim(), url, watchedAt: existing?.watchedAt || "" };
  if (existing) Object.assign(existing, record); else state.capsules.unshift(record);
  await persist(); closeModal(); render(); toast(existing ? "Capsule mise à jour." : "Capsule ajoutée à ta collection !", "🎬");
}

async function handleCapsuleWatched(id) {
  const before = previousBadges();
  if (!markCapsuleWatched(state, id)) return;
  const badge = newBadgeMessage(before);
  await persist(); render(); celebrate(["Capsule regardée · +3 XP", badge].filter(Boolean).join(" · "));
}

async function removeCapsule(id) {
  state.capsules = state.capsules.filter(item => item.id !== id); await persist(); render(); toast("Capsule retirée de ta collection.", "🎬");
}

async function planAction(id) {
  const action = state.actions.find(item => item.id === id);
  if (!action) return;
  if (!action.stoneId) { toast("Rattache d’abord cette action à une Grande Pierre.", "💎"); return; }
  const week = getCurrentWeek(state); action.status = "weekly"; action.weekId = week.id; await persist(); render(); toast("Action embarquée dans ton Cap Hebdo.", "🧭");
}

async function planToday(id) {
  const action = state.actions.find(item => item.id === id); if (!action) return;
  const week = getCurrentWeek(state); const date = todayISO();
  if (date < week.start || date > week.end) { toast("Le jour sélectionné doit être dans ton Cap actuel.", "📅"); return; }
  action.status = "weekly"; action.weekId = week.id; action.plannedDate = date;
  await persist(); render(); toast("Action posée sur ta journée.", "🌤️");
}

async function saveActionForm(event) {
  event.preventDefault(); const form = event.currentTarget; const fd = new FormData(form); const id = fd.get("id");
  const existing = state.actions.find(item => item.id === id);
  const shouldSplit = Boolean(pendingAction?.split && !existing);
  const inWeek = fd.get("inWeek") === "yes";
  const week = getCurrentWeek(state); const stoneId = fd.get("stoneId") || null;
  if (inWeek && !stoneId) { toast("Rattache cette action à une Grande Pierre avant de l’embarquer.", "💎"); form.elements.stoneId.focus(); return; }
  const slot = fd.get("slot") || "";
  const plannedDate = fd.get("plannedDate") || "";
  if (inWeek && slot && !plannedDate) { toast("Choisis un jour pour placer ce focus dans ta journée.", "📅"); return; }
  if (inWeek && plannedDate && (plannedDate < week.start || plannedDate > week.end)) { toast("Choisis un jour dans cette semaine.", "📅"); return; }
  if (inWeek && slot && plannedDate) {
    const conflict = state.actions.find(item => item.id !== id && item.weekId === week.id && item.plannedDate === plannedDate && item.slot === slot && item.status !== "done" && item.status !== "abandoned" && item.status !== "split");
    if (conflict) { toast("Ce bloc a déjà son focus. Déplace l’autre action ou choisis un autre moment.", "🧭"); return; }
  }
  const record = { ...(existing || {}), id: existing?.id || newId("action"), title: fd.get("title").trim(), stoneId, effort: fd.get("effort") || "M", criteria: fd.get("criteria").trim(), slot: inWeek ? slot : "", plannedDate: inWeek ? plannedDate : "", status: inWeek ? "weekly" : (stoneId ? "reserve" : "unassigned"), weekId: inWeek ? week.id : "" };
  if (existing) Object.assign(existing, record);
  else if (shouldSplit) {
    const lines = fd.get("criteria").split("\n").map(line => line.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean).slice(0, 5);
    if (lines.length < 2) { toast("Ajoute au moins deux étapes, une par ligne.", "🪨"); return; }
    pendingAction = null;
    record.status = "split"; record.weekId = ""; record.slot = ""; state.actions.unshift(record);
    for (const title of lines) state.actions.unshift({ id: newId("action"), title, stoneId, effort: record.effort === "XXL" ? "M" : record.effort, criteria: "", slot: "", status: stoneId ? "reserve" : "unassigned", weekId: "", parentId: record.id });
  } else { pendingAction = null; state.actions.unshift(record); }
  await persist(); closeModal(); render(); toast(shouldSplit ? "Action découpée en étapes plus petites." : existing ? "Micro-action mise à jour." : "Micro-action ajoutée à ton chemin.", "✨");
}

async function saveStoneForm(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const id = fd.get("id");
  const stone = { id: id || newId("stone"), title: fd.get("title").trim(), icon: fd.get("icon").trim() || "💎", success: fd.get("success").trim(), anchor: fd.get("anchor").trim(), due: fd.get("due").trim() };
  const existing = state.stones.find(item => item.id === id);
  if (existing) Object.assign(existing, stone); else state.stones.unshift(stone);
  await persist(); closeModal(); render(); celebrate(existing ? "Ta Grande Pierre est mise à jour." : "Une nouvelle Grande Pierre prend forme !");
}

function fillStoneTemplate(key) {
  const templates = {
    admin: { title: "Gestion, admin & obligations", icon: "📁", success: "Mes démarches importantes sont traitées et mes documents sont à jour.", anchor: "Libérer de l’espace mental et préserver ma tranquillité." },
    project: { title: "Faire avancer un projet important", icon: "💎", success: "Le résultat concret qui compte pour moi est terminé.", anchor: "Avancer vers ce qui me tient à cœur." },
    wellbeing: { title: "Prendre soin de moi", icon: "🌿", success: "J’ai installé des gestes qui soutiennent mon équilibre.", anchor: "Préserver mon énergie et mon bien-être." }
  };
  const item = templates[key]; if (!item) return;
  for (const [field, value] of Object.entries(item)) modalRoot.querySelector(`[name="${field}"]`).value = value;
  toast("Exemple ajouté : modifie-le comme tu le souhaites.", "✏️");
}

async function createAdminStone() {
  const exists = state.stones.find(item => item.title.toLocaleLowerCase("fr") === "gestion, admin & obligations");
  if (exists) { toast("Cette Grande Pierre existe déjà.", "📁"); return; }
  state.stones.unshift({ id: newId("stone"), title: "Gestion, admin & obligations", icon: "📁", success: "Mes démarches importantes sont traitées et mes documents sont à jour.", anchor: "Libérer de l’espace mental.", due: "" });
  await persist(); render(); celebrate("Pierre Admin créée · tu peux y rattacher tes tâches.");
}

async function saveCustomTool(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget);
  state.tools.unshift({ id: newId("tool"), title: fd.get("title").trim(), description: fd.get("description").trim(), category: fd.get("category"), emoji: fd.get("emoji").trim() || "✨", url: fd.get("url").trim() });
  await persist(); closeModal(); render(); toast("Outil ajouté à ta boîte.", "🧰");
}

async function removeTool(id) {
  state.tools = state.tools.filter(item => item.id !== id); await persist(); render(); toast("Outil retiré de ta boîte.");
}

function splitRecord(action, source = "blocker") {
  action.status = "split"; action.weekId = ""; action.slot = ""; action.plannedDate = "";
  const childEffort = action.effort === "XXL" ? "L" : action.effort === "XL" ? "M" : "S";
  const children = [1, 2].map(number => ({
    id: newId("action"), title: `${action.title} — étape ${number}`, stoneId: action.stoneId,
    effort: childEffort, criteria: "", slot: "", plannedDate: "", status: "reserve", weekId: "", parentId: action.id,
    splitSource: source
  }));
  state.actions.unshift(...children);
}

async function saveBlockerChoice(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const action = state.actions.find(item => item.id === fd.get("id"));
  if (!action) return;
  const choice = event.submitter?.value || "reserve"; action.blockerReason = fd.get("reason").trim();
  if (choice === "reduce") {
    const order = ["S", "M", "L", "XL", "XXL"]; const index = order.indexOf(action.effort); action.effort = order[Math.max(index - 1, 0)];
    toast("Effort réajusté. Tu peux reprendre à ton rythme.", "🌱");
  } else if (choice === "split") {
    splitRecord(action); toast("Deux étapes plus légères ont rejoint ta réserve.", "🪨");
  } else if (choice === "reserve") {
    action.status = "reserve"; action.weekId = ""; action.slot = ""; action.plannedDate = ""; toast("Action remise dans ta réserve, sans pénalité.", "🌿");
  } else {
    toast("Action gardée dans ton Cap. Tu peux demander de l’aide ou la réajuster plus tard.", "🧭");
  }
  await persist(); closeModal(); render();
}

async function saveVisionForm(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); state.profile.vision = fd.get("vision").trim(); const earned = addXP(state, 10, "vision", "first"); await persist(); closeModal(); render(); celebrate(earned ? "Ta boussole est posée · +10 XP" : "Ta vision est mise à jour.");
}
async function saveStoryForm(event) { event.preventDefault(); state.profile.story = new FormData(event.currentTarget).get("story").trim(); await persist(); closeModal(); render(); toast("Ton récit est gardé précieusement."); }
async function saveEssentialsForm(event) { event.preventDefault(); state.profile.essentials = new FormData(event.currentTarget).get("items").split("\n").map(x => x.trim()).filter(Boolean); await persist(); closeModal(); render(); toast("Tes essentiels sont à jour.", "🧭"); if (resumeDecisionAfterEssentials && state.profile.essentials.length) { resumeDecisionAfterEssentials = false; showModal(decisionForm(state, pendingDecisionProposal)); pendingDecisionProposal = ""; } }
async function saveResonanceForm(event) { event.preventDefault(); state.profile.resonance = new FormData(event.currentTarget).get("items").split("\n").map(x => x.trim()).filter(Boolean); await persist(); closeModal(); render(); toast("Tes mots-repères sont enregistrés."); }
async function saveGuidesForm(event) {
  event.preventDefault(); state.profile.guides = new FormData(event.currentTarget).get("items").split("\n").map(line => line.split("|").map(x => x.trim())).filter(parts => parts[1]).map(([emoji, name, qualities]) => ({ emoji: emoji || "✨", name, qualities: qualities || "" }));
  await persist(); closeModal(); render(); toast("Tes figures guides sont enregistrées.");
}

function splitAction() {
  const title = modalRoot.querySelector('[name="title"]')?.value || "";
  pendingAction = { split: true };
  modalRoot.querySelector('[name="effort"][value="L"]') && (modalRoot.querySelector('[name="effort"][value="L"]').checked = true);
  const criteria = modalRoot.querySelector('[name="criteria"]');
  if (criteria && !criteria.value) criteria.value = `1. Première étape de : ${title}\n2. Étape suivante\n3. Finaliser et vérifier`;
  modalRoot.querySelector("#xxl-note").innerHTML = "🪨 Ajuste ces étapes (une par ligne). À l’enregistrement, chacune deviendra une micro-action dans ta réserve.";
  if (criteria) criteria.placeholder = "Une étape par ligne";
  toast("Ajuste les étapes, puis enregistre pour créer les micro-actions.", "🪨");
}

function showDecisionResult(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const answers = state.profile.essentials.map((_, i) => fd.get(`value-${i}`));
  const yes = answers.filter(a => a === "yes").length; const allYes = yes === answers.length;
  const proposal = fd.get("proposal"); closeModal(); pendingDecisionProposal = "";
  showModal(modal("Ton éclairage", `<div class="decision-result ${allYes ? "aligned" : "pause"}"><div class="decision-result-icon">${allYes ? "🌿" : "🧭"}</div><h3>${allYes ? "Un oui qui semble aligné." : "Prends un instant avant de répondre."}</h3><p>Tu as choisi ${yes} réponse(s) « oui » sur ${answers.length} pour : <b>${escapeHTML(proposal)}</b>.</p><p>${allYes ? "Si tu en as envie, tu peux avancer en confiance." : "Tu peux demander un délai, ajuster la proposition ou la décliner avec sérénité."}</p></div>`, `<button class="button button-primary wide" data-action="close-modal">Je garde ça en tête</button>`));
}

async function saveRetro(event) {
  event.preventDefault(); const fd = new FormData(event.currentTarget); const week = state.weeks.find(item => item.id === fd.get("weekId")) || getCurrentWeek(state); const summary = { mirror: fd.get("mirror").trim(), closedAt: new Date().toISOString(), decisions: {} };
  const before = previousBadges();
  const retroWin = fd.get("win")?.trim();
  if (retroWin) { state.daily[todayISO()] ||= {}; state.daily[todayISO()].wins ||= []; state.daily[todayISO()].wins.unshift(retroWin); addXP(state, 5, "retro victory", week.id); }
  for (const action of state.actions.filter(a => a.weekId === week.id && a.status !== "done")) {
    const decision = fd.get(`remaining-${action.id}`) || "reserve"; const reason = fd.get(`reason-${action.id}`) || ""; summary.decisions[action.id] = { decision, reason };
    action.blockerReason = reason;
    if (decision === "drop") { action.status = "abandoned"; action.weekId = ""; }
    else if (decision === "split") splitRecord(action, "retro");
    else { action.status = "reserve"; action.weekId = ""; action.slot = ""; action.blockerReason = reason; }
  }
  week.retro = summary; addXP(state, 15, "retro", week.id); const badge = newBadgeMessage(before); await persist(); closeModal(); navigate("week"); celebrate(["Cap clôturé · +15 XP pour avoir pris du recul !", badge].filter(Boolean).join(" · "));
}

function showStoneDetail(id) {
  const stone = state.stones.find(s => s.id === id); if (!stone) return;
  const progress = stoneProgress(state, id); const actions = state.actions.filter(a => a.stoneId === id);
  const reserve = actions.filter(a => a.status === "reserve" || a.status === "unassigned"); const done = actions.filter(a => a.status === "done");
  showModal(modal(`${stone.icon || "💎"} ${stone.title}`, `<div class="stone-detail"><div class="progress-label"><span>${progress.done}/${progress.total} actions accomplies</span><b>${progress.percent}%</b></div><div class="progress-track"><span style="width:${progress.percent}%"></span></div><p class="form-hint">Calcul : actions accomplies ÷ toutes les actions rattachées, réserve comprise.</p>${stone.due ? `<p>Échéance : ${escapeHTML(stone.due)}</p>` : ""}${stone.success ? `<h3>Critère de succès</h3><p>${escapeHTML(stone.success)}</p>` : ""}${stone.anchor ? `<h3>Mon ancrage émotionnel</h3><p>${escapeHTML(stone.anchor)}</p>` : ""}<h3>Réservoir d’actions</h3>${reserve.length ? reserve.map(a => `<div class="detail-action"><b>${escapeHTML(a.title)}</b><small>${a.effort} · ${escapeHTML(a.criteria || "")}</small><button class="button button-soft button-small" data-action="plan-action" data-id="${a.id}">＋ Embarquer dans mon Cap</button></div>`).join("") : `<p class="muted-copy">Aucune action en réserve pour le moment.</p>`}<h3>Ce qui est déjà bâti (${done.length})</h3>${done.map(a => `<div class="detail-done">✓ ${escapeHTML(a.title)}</div>`).join("")}</div>`, `<button class="button button-outline" data-action="edit-stone" data-id="${stone.id}">Modifier</button><button class="button button-primary" data-action="new-action" data-stone="${stone.id}">＋ Ajouter une micro-action</button>`));
}

function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

function startBreathing() {
  closeModal();
  showModal(modal("Respiration carrée", `<div class="breathing-exercise"><div class="breathing-orb" id="breathing-orb"><span id="breathing-instruction">Prêt·e ?</span></div><p id="breathing-count">4 cycles · environ 1 minute</p></div>`, `<button class="button button-primary wide" id="breathing-start">Commencer</button>`));
  modalRoot.querySelector("#breathing-start")?.addEventListener("click", async event => {
    event.currentTarget.disabled = true; let count = 0;
    const instruction = modalRoot.querySelector("#breathing-instruction"); const orb = modalRoot.querySelector("#breathing-orb");
    const phases = [["Inspire", "expand"], ["Garde", "hold"], ["Expire", "shrink"], ["Pause", "hold"]];
    for (let cycle = 0; cycle < 4; cycle++) for (const [text, css] of phases) {
      if (!modalRoot.contains(orb)) return;
      instruction.textContent = text; orb.dataset.phase = css;
      for (let second = 4; second > 0; second--) { modalRoot.querySelector("#breathing-count").textContent = `${second} · cycle ${cycle + 1} / 4`; await new Promise(resolve => setTimeout(resolve, 1000)); }
      count++;
    }
    if (count) { addXP(state, 5, "breathing", todayISO()); await persist(); instruction.textContent = "Bien joué !"; modalRoot.querySelector("#breathing-count").textContent = "+5 XP · un instant pour toi"; event.currentTarget.textContent = "Terminer"; event.currentTarget.disabled = false; }
  });
}

function showPastWins() {
  const wins = Object.entries(state.daily).sort(([a], [b]) => b.localeCompare(a)).flatMap(([date, day]) => (day.wins || []).map(win => ({ date, win }))).slice(0, 12);
  showModal(modal("Mes victoires", wins.length ? `<div class="past-wins">${wins.map(item => `<div class="win-item"><span>✦</span><div>${escapeHTML(item.win)}<small>${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(`${item.date}T12:00:00`))}</small></div></div>`).join("")}</div>` : `<div class="empty-card slim"><p>Ton livre d’or se remplit au fil de tes journées. Note une petite victoire depuis l’accueil.</p></div>`));
}

function exportData() {
  const blob = new Blob([JSON.stringify(exportObject(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `un-pas-apres-lautre-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url); toast("Ta sauvegarde est prête.", "⬇");
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  render();
}

function importData() {
  const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      pendingImport = validateImport(JSON.parse(await file.text()));
      const stoneCount = pendingImport.stones.length;
      const actionCount = pendingImport.actions.length;
      const xpCount = pendingImport.xp.total;
      showModal(modal("Vérifier la sauvegarde", `<div class="import-preview"><span class="import-icon">⬆</span><p>Cette sauvegarde contient :</p><ul><li><b>${stoneCount}</b> Grande(s) Pierre(s)</li><li><b>${actionCount}</b> micro-action(s)</li><li><b>${xpCount}</b> XP</li></ul><p class="warning-copy">L’import remplacera toutes les données actuellement enregistrées sur cet appareil.</p></div>`, `<button class="button button-outline" data-action="close-modal">Annuler</button><button class="button button-primary" data-action="confirm-import">Remplacer et importer</button>`));
    } catch (error) { alert(error.message || "Impossible de lire cette sauvegarde."); }
  });
  input.click();
}

async function confirmImport() {
  if (!pendingImport) return;
  state = pendingImport; pendingImport = null; await persist(); closeModal(); render(); navigate("home", true); toast("Sauvegarde importée.", "⬆");
}

function resetData() {
  if (!confirm("Cette action effacera toutes tes données de cet appareil. As-tu d’abord exporté une sauvegarde ?")) return;
  state = createInitialState(); localStorage.removeItem("upa-fallback"); persist().then(() => { render(); closeModal(); navigate("home", true); });
}

function addOnboarding() {
  if (!state.profile.vision) {
    showModal(modal("Un premier pas, à toi", `<div class="onboarding-mark">✦</div><p class="onboarding-copy">Avant de remplir ton espace, pose quelques mots sur la direction qui compte pour toi.</p><form id="vision-form"><label>Ma vision, en une phrase courte<input name="vision" required maxlength="180" autofocus placeholder="Ex. Créer dans la joie, préserver ma paix d’esprit et rayonner."></label><p class="form-hint">Tu pourras enrichir ta Vision au fil du temps.</p></form>`, `<button class="button button-primary wide" form="vision-form">Poser ma boussole <span>↗</span></button>`));
    bindModalInteractions();
  }
}

window.addEventListener("popstate", () => { page = location.hash.slice(1) || "home"; render(); });
window.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; render(); });
window.addEventListener("appinstalled", () => { installPrompt = null; render(); toast("Un pas après l’autre est installé sur ton appareil.", "📲"); });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker non disponible", error));
render();
addOnboarding();
