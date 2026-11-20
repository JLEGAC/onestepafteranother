import { symbolPicker, symbolMark, symbolText } from "./ui/symbol-picker.js";
import { modal, actionCard } from './views.js';
import { identityTitle, stepActions, stepDone, blockers, activeAction } from './identity.js';
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (label, action, attrs='') => `<button type="button" class="button button-outline button-small" data-action="${action}" ${attrs}>${label}</button>`;
export function identityCards(state) {
  return `<div class="identity-grid">${state.stones.map(s=>{
    const pillars=state.pillars.filter(p=>p.stoneId===s.id);
    const next=state.steps.find(x=>x.id===s.nextStepId&&!stepDone(state,x.id)) || state.steps.find(x=>x.stoneId===s.id && !x.parentStepId && !stepDone(state,x.id));
    return `<article class="identity-card"><button class="identity-card-main" data-action="stone-detail" data-id="${esc(s.id)}">${symbolText(s,"icon","🎯") ? `<span class="identity-symbol">${symbolMark(s,"icon","🎯")}</span>` : ""}<h2>${esc(s.title)}</h2><p>${esc(s.description||'Ce que cette identité signifie pour moi…')}</p><span class="pillar-chips">${pillars.map(p=>`<span>${symbolMark(p)} ${esc(p.title)}</span>`).join('')}</span>${next?`<small>Prochaine étape · ${symbolMark(next)} ${esc(next.title)}</small>`:''}<b class="text-button">Ouvrir mon espace →</b></button></article>`;
  }).join('') || `<div class="empty-card"><h3>Qui ai-je envie de devenir ?</h3><p>Commence par une identité qui compte pour toi. Tu pourras en ajouter d’autres.</p>${button('Créer mon identité','new-stone')}</div>`}</div>`;
}
export function identityIndex(state) {
  return `<div class="page-title-row"><h1>${identityTitle(state)}</h1>${button('＋ Ajouter une identité','new-stone')}</div><p class="section-copy">Les différentes facettes de la personne que tu veux être, un pas après l’autre.</p>${identityCards(state)}`;
}
export function identityDetail(state,id) {
  const s=state.stones.find(x=>x.id===id);if(!s)return identityIndex(state);
  const pillars=state.pillars.filter(p=>p.stoneId===id);
  const habits=state.habits.filter(h=>h.linkedStoneId===id&&h.active!==false);
  function stepCard(step) {
    const actions=state.actions.filter(a=>a.stepId===step.id && activeAction(a));
    const children=state.steps.filter(x=>x.parentStepId===step.id);
    const all=stepActions(state,step.id), done=stepDone(state,step.id);
    const prerequisite=state.steps.find(x=>x.id===step.dependsOnStepId);
    return `<details class="identity-step" data-disclosure="${esc(step.id)}"><summary><span><strong>${symbolMark(step)} ${esc(step.title)}</strong>${step.description?`<small>${esc(step.description)}</small>`:''}<small>${done?'✓ Étape accomplie':all.length?`${all.filter(a=>a.status==='done').length}/${all.length} actions accomplies`:'Résultat à préparer'}</small></span><span aria-hidden="true">⌄</span></summary><div class="step-content">
      <div class="step-tools">${!step.parentStepId?button('＋ Ajouter une sous-étape <small>(facultatif)</small>','new-step',`data-stone="${esc(id)}" data-pillar="${esc(step.pillarId)}" data-parent="${esc(step.id)}"`):''}${button('Modifier l’étape','edit-step',`data-id="${esc(step.id)}" data-stone="${esc(id)}"`)}${!step.parentStepId&&!done?button(s.nextStepId===step.id?'★ Étape mise en avant':'☆ Mettre en avant','focus-step',`data-id="${esc(step.id)}"`):''}</div>
      ${prerequisite?`<p class="dependency-note">${stepDone(state,prerequisite.id)?'✓ Préalable accompli':'🔒 À terminer d’abord'} : ${esc(prerequisite.title)}</p>`:''}
      ${children.map(stepCard).join('')}${actions.map(a=>actionCard(state,a,true)).join('')}
      ${!actions.length&&!children.length?`<p class="form-hint">Quelles petites actions, précises et terminables, te permettront d’atteindre ce résultat ?</p>${button(done?'Rouvrir cette étape':'Ce résultat est déjà atteint','toggle-step',`data-id="${esc(step.id)}"`)}`:''}
      <div class="step-add">${button('＋ Ajouter une action','new-action',`data-stone="${esc(id)}" data-step="${esc(step.id)}"`)}</div></div></details>`;
  }
  const direct=state.actions.filter(a=>a.stoneId===id&&!a.stepId&&activeAction(a));
  return `<button class="text-button" data-page="cible">← ${identityTitle(state)}</button><section class="identity-intro"><div class="page-title-row"><h1>${symbolMark(s,"icon","🎯")} ${esc(s.title)}</h1>${button('Modifier','edit-stone',`data-id="${esc(id)}"`)}</div><p>${esc(s.description||'')}</p>${s.anchor?`<p class="form-hint">${esc(s.anchor)}</p>`:''}</section>
    <section class="section"><div class="section-heading"><h2>Mes habitudes aidantes</h2>${button('＋ Ajouter','new-habit',`data-stone="${esc(id)}"`)}</div><div class="identity-habits">${habits.map(h=>button(`${symbolMark(h,"emoji","🌱")} ${esc(h.title)}`,'edit-habit',`data-id="${esc(h.id)}"`)).join('')||'<p class="form-hint">Les gestes réguliers qui soutiennent cette identité restent aussi visibles sur l’accueil.</p>'}</div></section>
    <section class="section"><div class="section-heading"><h2>Mes piliers</h2>${button('＋ Ajouter un pilier','new-pillar',`data-stone="${esc(id)}"`)}</div><p class="section-copy">Quelles sont les grandes composantes de cette identité, sur lesquelles tu peux avancer de manière indépendante ?</p><p class="form-hint">Deux piliers peuvent suffire pour commencer. Trois à cinq donnent souvent un bon aperçu.</p>
    ${pillars.map(p=>`<details class="identity-pillar" data-disclosure="${esc(p.id)}" open><summary><span><strong>${symbolMark(p)} ${esc(p.title)}</strong>${p.description?`<small>${esc(p.description)}</small>`:''}</span><span aria-hidden="true">⌄</span></summary><div class="pillar-content"><div class="pillar-tools">${button('Modifier le pilier','edit-pillar',`data-id="${esc(p.id)}"`)}</div>${state.steps.filter(x=>x.pillarId===p.id&&!x.parentStepId).map(stepCard).join('')}${button('＋ Ajouter une étape','new-step',`data-stone="${esc(id)}" data-pillar="${esc(p.id)}"`)}</div></details>`).join('')}
    </section>${direct.length?`<section class="section"><h2>Actions à organiser</h2><p class="form-hint">Tes actions existantes sont conservées. Avec « Modifier », tu peux les rattacher à une étape.</p>${direct.map(a=>actionCard(state,a,true)).join('')}</section>`:''}`;
}
export function identityForm(stone=null) {
  return modal(stone?'Modifier mon identité':'Créer mon identité',`<form id="stone-form"><input type="hidden" name="id" value="${esc(stone?.id||'')}"><label>Qui ai-je envie de devenir ?<input name="title" required maxlength="120" placeholder="Je suis une super maman" value="${esc(stone?.title||'')}"></label>${symbolPicker(stone,"icon","🎯")}<label>Qu’est-ce que cette identité signifie pour moi ?<textarea name="description" rows="3" maxlength="600" placeholder="Je suis présente et je partage des moments de qualité avec mes enfants.">${esc(stone?.description||stone?.success||'')}</textarea></label><p class="form-hint">Ce texte apparaît avec ton identité, comme un rappel personnel. Une identité se cultive au fil du temps.</p>${stone?.anchor?`<label>Mon repère personnel<textarea name="anchor">${esc(stone.anchor)}</textarea></label>`:''}</form>`,`<button class="button button-primary wide" form="stone-form">${stone?'Enregistrer mon identité':'Créer mon identité'}</button>`);
}
export function pillarForm(state,stoneId,pillar=null) {
  return modal(pillar?'Modifier le pilier':'Ajouter un pilier',`<form id="pillar-form"><input type="hidden" name="id" value="${esc(pillar?.id||'')}"><input type="hidden" name="stoneId" value="${esc(stoneId)}"><p class="section-copy">Quelles sont les grandes composantes de cette identité, sur lesquelles tu peux avancer de manière indépendante ?</p><label>Nom du pilier<input name="title" required maxlength="100" value="${esc(pillar?.title||'')}" placeholder="Transmission"></label>${symbolPicker(pillar)}<label>Ce qu’il représente <small>(facultatif)</small><textarea name="description" rows="2" maxlength="400">${esc(pillar?.description||'')}</textarea></label></form>`,`<button class="button button-primary wide" form="pillar-form">Enregistrer le pilier</button>`);
}
export function identityStepForm(state,stoneId,step=null,pillarId='',parentId='') {
  pillarId=step?.pillarId||pillarId;parentId=step?.parentStepId||parentId;
  const parent=state.steps.find(s=>s.id===parentId);
  const pillars=state.pillars.filter(p=>p.stoneId===stoneId);
  const roots=state.steps.filter(s=>s.stoneId===stoneId && !s.parentStepId && s.id!==step?.id);
  const hasChildren=state.steps.some(s=>s.parentStepId===step?.id);
  return modal(step?'Modifier l’étape':parent?'Ajouter une sous-étape':'Ajouter une étape',`<form id="step-form"><input type="hidden" name="id" value="${esc(step?.id||'')}"><input type="hidden" name="stoneId" value="${esc(stoneId)}"><p class="section-copy">Quels résultats concrets veux-tu atteindre dans ce pilier pour te rapprocher de cette identité ?</p><p class="form-hint">Découpe ce pilier en résultats que tu peux atteindre pas à pas.</p>${parent?`<p class="context-badge">Dans l’étape : ${esc(parent.title)}</p>`:''}<label>Résultat à atteindre<input name="title" required maxlength="120" placeholder="Organiser les papiers du foyer" value="${esc(step?.title||'')}"></label>${symbolPicker(step)}<label>Précision <small>(facultatif)</small><textarea name="description" rows="2" maxlength="500" placeholder="Les documents utiles sont classés et faciles à retrouver.">${esc(step?.description||'')}</textarea></label><label>Pilier<select name="pillarId" required>${pillars.map(p=>`<option value="${esc(p.id)}" ${p.id===pillarId?'selected':''}>${esc(p.title)}</option>`).join('')}</select></label>
      ${step?`<label>Organisation<select name="parentStepId"><option value="">Étape directement dans le pilier</option>${hasChildren?'':roots.map(s=>`<option value="${esc(s.id)}" ${s.id===parentId?'selected':''}>Sous-étape de : ${esc(s.title)}</option>`).join('')}</select></label>`:`<input type="hidden" name="parentStepId" value="${esc(parentId)}">`}
      <label>À faire après <small>(facultatif)</small><select name="dependsOnStepId"><option value="">Cette étape est indépendante</option>${state.steps.filter(s=>s.stoneId===stoneId&&s.id!==step?.id&&s.id!==parentId).map(s=>`<option value="${esc(s.id)}" ${s.id===step?.dependsOnStepId?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label><p class="form-hint">Les actions attendront que cette étape préalable soit terminée. Tu peux les prévoir dans la même semaine en planifiant d’abord les actions préalables.</p></form>`,`<button class="button button-primary wide" form="step-form">${step?'Enregistrer les modifications':'Ajouter cette étape'}</button>${step?button('Supprimer cette étape…','delete-step',`data-id="${esc(step.id)}"`):''}`);
}
export function actionDependencyField(state,action) {
  return `<label>À faire après <small>(facultatif)</small><select name="dependsOnActionId"><option value="">Cette action est indépendante</option>${state.actions.filter(a=>a.id!==action?.id && activeAction(a)).map(a=>`<option value="${esc(a.id)}" ${a.id===action?.dependsOnActionId?'selected':''}>${esc(a.title)}</option>`).join('')}</select></label><p class="form-hint">Tu pourras la terminer après son préalable, et la prévoir dans la même semaine si le préalable y est prévu avant elle.</p>`;
}
