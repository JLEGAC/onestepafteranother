// Identity structure and dependency rules, shared by every UI entry point.
export const activeAction = a => !['abandoned', 'split'].includes(a.status);
export const identityTitle = state => state.stones.length > 1 ? 'Mes identités' : 'Mon identité';
export function migrateIdentities(state) {
  state.pillars = Array.isArray(state.pillars) ? state.pillars : [];
  state.stones = state.stones.map(s => ({...s, description: s.description ?? s.success ?? ''}));
  state.steps = state.steps.map(s => {
    if (state.pillars.some(p => p.id === s.pillarId && p.stoneId === s.stoneId)) return s;
    const id = `organiser:${s.stoneId}`;
    if (!state.pillars.some(p => p.id === id)) state.pillars.push({id, stoneId:s.stoneId,title:'À organiser',description:'Tes étapes existantes sont conservées ici. Renomme ce pilier ou déplace les étapes.'});
    return {...s, pillarId:id, parentStepId:s.parentStepId || ''};
  });
  for (const day of Object.values(state.daily)) if (Array.isArray(day?.wins)) day.wins = day.wins.map(win => {
    if (win?.relatedType !== 'action') return win;
    const action = state.actions.find(a => a.id === win.relatedId);
    const candidate = action?.stoneId || state.steps.find(s => s.id === action?.stepId)?.stoneId;
    const id = state.stones.some(s=>s.id===candidate) ? candidate : '';
    return {...win, legacyActionId:win.relatedId, relatedType:id ? 'stone' : '', relatedId:id || ''};
  });
  return state;
}
export function stepActions(state, id) {
  const ids = new Set([id, ...state.steps.filter(s => s.parentStepId === id).map(s => s.id)]);
  return state.actions.filter(a => ids.has(a.stepId) && activeAction(a));
}
export function stepDone(state, id, visited = new Set()) {
  if (visited.has(id)) return false;
  visited = new Set([...visited, id]);
  const step = state.steps.find(s => s.id === id);
  if (!step) return false;
  for (const p of prerequisites(state,{stepId:id})) if (p.kind==='step' && !stepDone(state,p.id,visited)) return false;
  const actions = state.actions.filter(a => a.stepId === id && activeAction(a));
  const children = state.steps.filter(s => s.parentStepId === id);
  if (!actions.length && !children.length) return Boolean(step.completedAt);
  return actions.every(a => a.status === 'done') && children.every(s => stepDone(state,s.id,visited));
}
export function prerequisites(state, action) {
  const result = [];
  if (action.dependsOnActionId) result.push({kind:'action', id:action.dependsOnActionId});
  let step = state.steps.find(s => s.id === action.stepId);
  const visited = new Set();
  while (step && !visited.has(step.id)) {
    visited.add(step.id);
    if (step.dependsOnStepId) result.push({kind:'step',id:step.dependsOnStepId});
    step = state.steps.find(s => s.id === step.parentStepId);
  }
  return result;
}
export function blockers(state, action) {
  return prerequisites(state,action).filter(p => p.kind === 'step' ? !stepDone(state,p.id) : state.actions.find(a=>a.id===p.id)?.status !== 'done')
    .map(p=>({...p,title:(p.kind==='step' ? state.steps : state.actions).find(x=>x.id===p.id)?.title || 'Élément préalable introuvable'}));
}
export function dependencyError(state) {
  const graph = new Map();
  for (const s of state.steps) {
    const parent = state.steps.find(x=>x.id===s.parentStepId);
    if (s.parentStepId && (!parent || parent.parentStepId || parent.id === s.id || parent.pillarId !== s.pillarId)) return 'Une sous-étape doit appartenir à une étape du même pilier, avec un seul niveau de découpage.';
    if (s.dependsOnStepId && !state.steps.some(x=>x.id===s.dependsOnStepId)) return 'Choisis une étape préalable existante.';
    graph.set('s:'+s.id, [s.dependsOnStepId ? 's:'+s.dependsOnStepId : '', ...state.steps.filter(x=>x.parentStepId===s.id).map(x=>'s:'+x.id), ...state.actions.filter(a=>a.stepId===s.id && activeAction(a)).map(a=>'a:'+a.id)].filter(Boolean));
  }
  for (const a of state.actions) {
    if (a.dependsOnActionId && !state.actions.some(x=>x.id===a.dependsOnActionId && activeAction(x))) return 'L’action préalable doit exister et ne pas être abandonnée ou découpée.';
    graph.set('a:'+a.id, prerequisites(state,a).map(p=>(p.kind==='step'?'s:':'a:')+p.id));
  }
  const visiting=new Set(), done=new Set();
  function cycle(id) { if(visiting.has(id))return true; if(done.has(id))return false; visiting.add(id); for(const next of graph.get(id)||[])if(cycle(next))return true; visiting.delete(id);done.add(id);return false; }
  return [...graph.keys()].some(cycle) ? 'Cette dépendance créerait une boucle : chaque élément doit pouvoir avancer sans attendre son propre résultat.' : '';
}
const slotRank = {'':0,morning:1,noon:2,afternoon:3,evening:4};
export function scheduleIssue(state, action, seen = new Set()) {
  if (seen.has(action.id)) return {message:'Dépendance circulaire.'};
  seen=new Set([...seen,action.id]);
  for (const p of blockers(state,action)) {
    let needed;
    if(p.kind==='action') needed=[state.actions.find(a=>a.id===p.id)];
    else {
      needed=stepActions(state,p.id).filter(a=>a.status!=='done');
      const step=state.steps.find(s=>s.id===p.id);
      const empty=[step,...state.steps.filter(s=>s.parentStepId===p.id)].filter(Boolean).find(s=>!stepActions(state,s.id).length && !stepDone(state,s.id));
      if(empty || !needed.length) return {message:`Termine d’abord l’étape « ${p.title} » ou ajoute ses actions.`};
    }
    for(const previous of needed) {
      if(!previous || !activeAction(previous)) return {message:`Le préalable « ${p.title} » n’est plus disponible.`};
      if(previous.status==='done')continue;
      if(previous.weekId!==action.weekId || previous.status!=='weekly' || !previous.plannedDate) return {message:`Planifie d’abord « ${previous.title} » dans cette semaine.`, prerequisiteId:previous.id};
      const nested=scheduleIssue(state,previous,seen); if(nested)return nested;
      if(!action.plannedDate || previous.plannedDate>action.plannedDate || (previous.plannedDate===action.plannedDate && (slotRank[previous.slot||'']>slotRank[action.slot||'']))) return {message:`Place « ${action.title} » après « ${previous.title} ». Le même bloc est possible : l’ordre sera indiqué.`, prerequisiteId:previous.id};
    }
  }
  return null;
}
// Validate the edit as a whole, including actions that depend on the edited record.
export function editError(before, after) {
  const error=dependencyError(after); if(error)return error;
  for(const a of after.actions.filter(a=>a.status==='done')) {
    const old=before.actions.find(x=>x.id===a.id);
    if(blockers(after,a).length && (!old || !blockers(before,old).length))return `« ${a.title} » est déjà terminée. Termine d’abord les nouveaux préalables ou choisis une autre dépendance.`;
  }
  for(const a of after.actions.filter(a=>a.status==='weekly')) {
    const issue=scheduleIssue(after,a); if(!issue)continue;
    const old=before.actions.find(x=>x.id===a.id);
    if(!old || old.status!=='weekly' || JSON.stringify(issue)!==JSON.stringify(scheduleIssue(before,old)))return issue.message;
  }
  return '';
}
export function orderedActions(state, actions) {
  const output=[], visited=new Set();
  function visit(a) { if(visited.has(a.id))return;visited.add(a.id);for(const p of prerequisites(state,a)){const ids=p.kind==='action'?[p.id]:stepActions(state,p.id).map(x=>x.id); for(const id of ids){const previous=actions.find(x=>x.id===id);if(previous)visit(previous);}}output.push(a); }
  actions.forEach(visit);return output;
}
