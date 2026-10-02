const DB_NAME = "un-pas-apres-lautre";
const DB_VERSION = 2;
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
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    profile: { vision: "", story: "", essentials: [], guides: [], resonance: [] },
    stones: [],
    actions: [],
    weeks: [{ id: weekStart, start: weekStart, end: weekEndISO(weekStart), retro: null }],
    daily: {},
    habits: [],
    habitLogs: {},
    challenges: [],
    capsules: [],
    xp: { total: 0, events: [] },
    preferences: { sound: false, reducedMotion: false, gentleReminders: true, theme: "forest" },
    tools: []
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("workspace")) db.createObjectStore("workspace", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadState() {
  try {
    const db = await openDB();
    const state = await new Promise((resolve, reject) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get(STATE_KEY);
      request.onsuccess = () => resolve(request.result?.state || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return state ? normalizeState(state) : createInitialState();
  } catch (error) {
    console.error("IndexedDB indisponible", error);
    const raw = localStorage.getItem("upa-fallback");
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
  }
}

export async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", "readwrite");
      tx.objectStore("workspace").put({ id: STATE_KEY, state });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("Sauvegarde IndexedDB impossible, repli localStorage", error);
    localStorage.setItem("upa-fallback", JSON.stringify(state));
  }
}

export function normalizeState(input) {
  const base = createInitialState();
  const state = { ...base, ...input, profile: { ...base.profile, ...(input.profile || {}) }, xp: { ...base.xp, ...(input.xp || {}) } };
  state.stones = Array.isArray(input.stones) ? input.stones : [];
  state.actions = Array.isArray(input.actions) ? input.actions : [];
  state.weeks = Array.isArray(input.weeks) && input.weeks.length ? input.weeks : base.weeks;
  state.daily = input.daily && typeof input.daily === "object" ? input.daily : {};
  state.habits = Array.isArray(input.habits) ? input.habits : [];
  state.habitLogs = input.habitLogs && typeof input.habitLogs === "object" ? input.habitLogs : {};
  state.challenges = Array.isArray(input.challenges) ? input.challenges : [];
  state.capsules = Array.isArray(input.capsules) ? input.capsules : [];
  state.tools = Array.isArray(input.tools) ? input.tools : [];
  state.preferences = { ...base.preferences, ...(input.preferences || {}) };
  state.xp.events = Array.isArray(state.xp.events) ? state.xp.events : [];
  state.profile.essentials = Array.isArray(state.profile.essentials) ? state.profile.essentials : [];
  state.profile.guides = Array.isArray(state.profile.guides) ? state.profile.guides : [];
  state.profile.resonance = Array.isArray(state.profile.resonance) ? state.profile.resonance : [];
  state.schemaVersion = 2;
  return state;
}

export function getCurrentWeek(state) {
  const start = mondayISO();
  let week = state.weeks.find(item => item.start === start);
  if (!week) {
    week = { id: start, start, end: weekEndISO(start), retro: null };
    state.weeks.unshift(week);
  }
  return week;
}

export function stoneProgress(state, stoneId) {
  const items = state.actions.filter(item => item.stoneId === stoneId && item.status !== "abandoned" && item.status !== "split");
  if (!items.length) return { done: 0, total: 0, percent: 0 };
  const done = items.filter(item => item.status === "done").length;
  return { done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

export function exportObject(state) {
  return { app: "un-pas-apres-lautre", exportVersion: 2, exportedAt: new Date().toISOString(), data: state };
}

export function validateImport(parsed) {
  if (!parsed || parsed.app !== "un-pas-apres-lautre" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Ce fichier ne semble pas être une sauvegarde valide de l’application.");
  }
  if (!Array.isArray(parsed.data.stones) || !Array.isArray(parsed.data.actions)) {
    throw new Error("La sauvegarde est incomplète : Grandes Pierres ou actions manquantes.");
  }
  if (parsed.exportVersion !== undefined && ![1, 2].includes(parsed.exportVersion)) {
    throw new Error("Cette sauvegarde provient d’une version plus récente de l’application.");
  }
  return normalizeState(parsed.data);
}
