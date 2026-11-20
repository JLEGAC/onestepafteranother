import { migrateIdentities } from "./identity.js";
import { readWorkspace, writeWorkspace, backupRecord, scope } from "./local-store.js";
const DB_NAME = "un-pas-apres-lautre";
const DB_VERSION = 4;
const STATE_KEY = "workspace";

export function mondayISO(date = new Date()) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - day);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function weekEndISO(start) {
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createInitialState() {
  const weekStart = mondayISO();
  return {
    schemaVersion: 5,
    createdAt: new Date().toISOString(),
    profile: { vision: "", story: "", essentials: [], guides: [], resonance: [], resonanceImages: [] },
    stones: [],
    pillars: [],
    steps: [],
    actions: [],
    weeks: [{ id: weekStart, start: weekStart, end: weekEndISO(weekStart), retro: null, objective: "" }],
    daily: {},
    habits: [],
    habitLogs: {},
    challenges: [],
    capsules: [],
    xp: { total: 0, events: [] },
    preferences: { autoUpdates: true, sound: false, reducedMotion: false, gentleReminders: true, theme: "forest", darkMode: false },
    reserveOrder: [],
    tools: []
  };
}

export async function loadState() {
  const state = await readWorkspace();
  if (state && (state.schemaVersion || 1) < 5) {
    await backupRecord(scope(), state);
    const migrated = normalizeState(state);
    await writeWorkspace(migrated);
    return migrated;
  }
  return state ? normalizeState(state) : createInitialState();
}
export async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  await writeWorkspace(state);
}

export function normalizeState(input) {
  if ((input.schemaVersion || 1) > 5) throw new Error("Mets à jour l’application pour ouvrir ces données.");
  input = structuredClone(input);
  const base = createInitialState();
  const state = { ...base, ...input, profile: { ...base.profile, ...(input.profile || {}) }, xp: { ...base.xp, ...(input.xp || {}) } };
  state.stones = (Array.isArray(input.stones) ? input.stones : []).map(stone => {
    const title = String(stone.title || "");
    const leadingEmoji = title.match(/^\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/u)?.[0];
    return leadingEmoji ? { ...stone, title: title.slice(leadingEmoji.length).trimStart(), icon: leadingEmoji } : { ...stone, icon: stone.icon ?? "🎯" };
  });
  state.steps = Array.isArray(input.steps) ? input.steps : [];
  state.actions = Array.isArray(input.actions) ? input.actions : [];
  state.weeks = Array.isArray(input.weeks) && input.weeks.length ? input.weeks : base.weeks;
  state.daily = input.daily && typeof input.daily === "object" ? input.daily : {};
  const legacyMood = { "😣": "🌪️", "😔": "🌩️", "😴": "🌦️", "🙂": "🌤️", "😄": "🌞", "🥰": "🌞" };
  for (const day of Object.values(state.daily)) if (legacyMood[day?.mood]) day.mood = legacyMood[day.mood];
  state.habits = Array.isArray(input.habits) ? input.habits : [];
  state.habitLogs = input.habitLogs && typeof input.habitLogs === "object" ? input.habitLogs : {};
  state.challenges = Array.isArray(input.challenges) ? input.challenges : [];
  state.capsules = Array.isArray(input.capsules) ? input.capsules : [];
  state.tools = Array.isArray(input.tools) ? input.tools : [];
  state.preferences = { ...base.preferences, ...(input.preferences || {}) };
  state.reserveOrder = Array.isArray(input.reserveOrder) ? input.reserveOrder : [];
  const stepIds = new Set(state.steps.map(step => step.id));
  state.actions = state.actions.map(action => action.stepId && !stepIds.has(action.stepId) ? { ...action, stepId: "" } : action);
  state.xp.events = Array.isArray(state.xp.events) ? state.xp.events : [];
  state.profile.essentials = Array.isArray(state.profile.essentials) ? state.profile.essentials : [];
  state.profile.guides = Array.isArray(state.profile.guides) ? state.profile.guides : [];
  state.profile.resonance = Array.isArray(state.profile.resonance) ? state.profile.resonance : [];
  state.profile.resonanceImages = (Array.isArray(state.profile.resonanceImages) ? state.profile.resonanceImages : [])
    .filter(image => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(image?.dataUrl || ""));
  state.schemaVersion = 5;
  return migrateIdentities(state);
}

export function getCurrentWeek(state) {
  const start = mondayISO();
  let week = state.weeks.find(item => item.start === start);
  if (!week) {
    week = { id: start, start, end: weekEndISO(start), retro: null, objective: "" };
    state.weeks.unshift(week);
  }
  if (typeof week.objective !== "string") week.objective = "";
  return week;
}

export function stoneProgress(state, stoneId) {
  const stepIds = new Set((state.steps || []).filter(step => step.stoneId === stoneId).map(step => step.id));
  const items = state.actions.filter(item => (item.stoneId === stoneId || stepIds.has(item.stepId)) && item.status !== "abandoned" && item.status !== "split");
  if (!items.length) return { done: 0, total: 0, percent: 0 };
  const done = items.filter(item => item.status === "done").length;
  return { done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

export function exportObject(state) {
  return { app: "un-pas-apres-lautre", exportVersion: 5, exportedAt: new Date().toISOString(), data: state };
}

export function validateImport(parsed) {
  if (!parsed || parsed.app !== "un-pas-apres-lautre" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Ce fichier ne semble pas être une sauvegarde valide de l’application.");
  }
  if (!Array.isArray(parsed.data.stones) || !Array.isArray(parsed.data.actions)) {
    throw new Error("La sauvegarde est incomplète : objectifs ou actions manquants.");
  }
  if (parsed.exportVersion !== undefined && ![1, 2, 3, 4, 5].includes(parsed.exportVersion)) {
    throw new Error("Cette sauvegarde provient d’une version plus récente de l’application.");
  }
  return normalizeState(parsed.data);
}
