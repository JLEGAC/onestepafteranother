import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,normalizeState,exportObject,validateImport} from '../src/data.js';
import {blockers,dependencyError,editError,scheduleIssue,stepDone,orderedActions} from '../src/identity.js';
import {renderPage,actionForm} from '../src/views.js';
import {identityStepForm} from '../src/identity-views.js';
function fixture(){const s=createInitialState();s.stones=[{id:'i',title:'Super maman',description:'Présente et attentive'}];s.pillars=[{id:'p',stoneId:'i',title:'Transmission'}];s.steps=[{id:'s1',stoneId:'i',pillarId:'p',title:'Organiser les papiers'},{id:'s2',stoneId:'i',pillarId:'p',title:'Préparer le dossier'}];s.actions=[{id:'a',stoneId:'i',stepId:'s1',title:'Rassembler les papiers de la corbeille',status:'reserve',effort:'S'},{id:'b',stoneId:'i',stepId:'s1',title:'Classer les factures',status:'reserve',dependsOnActionId:'a',effort:'S'},{id:'c',stoneId:'i',stepId:'s2',title:'Scanner les justificatifs',status:'reserve',effort:'S'}];return s;}
const planned=(a,date='2026-11-18',slot='morning')=>({...a,status:'weekly',weekId:'2026-11-16',plannedDate:date,slot});
test('v4 migration preserves IDs, schedules, completed work, habits, XP and victory text; repeated migration is stable',()=>{
 const old=fixture();old.schemaVersion=4;delete old.pillars;old.stones[0].success='Ma description';delete old.stones[0].description;old.steps.forEach(s=>delete s.pillarId);
 old.actions[0]={...planned(old.actions[0]),status:'done',completedAt:'2026-11-18'};old.habits=[{id:'h',linkedStoneId:'i',active:true}];old.xp={total:77,events:[{id:'reward'}]};old.daily={'2026-11-18':{wins:[{text:'Mes papiers sont rassemblés',relatedType:'action',relatedId:'a'},'Une victoire libre']}};
 const untouched=structuredClone(old),s=normalizeState(old);
 assert.deepEqual(old,untouched);assert.equal(s.schemaVersion,5);assert.equal(s.pillars.length,1);assert.equal(s.pillars[0].title,'À organiser');assert.equal(s.stones[0].description,'Ma description');assert.deepEqual(s.actions,old.actions);assert.deepEqual(s.habits,old.habits);assert.deepEqual(s.xp,old.xp);assert.equal(s.daily['2026-11-18'].wins[0].relatedId,'i');assert.equal(s.daily['2026-11-18'].wins[0].text,old.daily['2026-11-18'].wins[0].text);assert.deepEqual(normalizeState(s),s);assert.deepEqual(validateImport(exportObject(s)),s);assert.throws(()=>normalizeState({...s,schemaVersion:99}),/jour/);
});
test('direct dependencies block completion but allow ordered placement in the same week and block',()=>{
 const s=fixture();assert.equal(blockers(s,s.actions[1])[0].id,'a');assert.equal(scheduleIssue(s,planned(s.actions[1])).prerequisiteId,'a');
 s.actions[0]=planned(s.actions[0]);assert.equal(scheduleIssue(s,planned(s.actions[1])),null);
 assert.match(scheduleIssue(s,planned(s.actions[1],'2026-11-17')).message,/après/);
 assert.match(scheduleIssue(s,planned(s.actions[1],'2026-11-18','')).message,/après/);
 assert.deepEqual(orderedActions(s,[s.actions[1],s.actions[0]]).map(a=>a.id),['a','b']);
 s.actions[0].status='done';assert.deepEqual(blockers(s,s.actions[1]),[]);assert.equal(scheduleIssue(s,planned(s.actions[1])),null);
});
test('rescheduling or removing a prerequisite must not invalidate a planned dependent',()=>{
 const s=fixture();s.actions[0]=planned(s.actions[0]);s.actions[1]=planned(s.actions[1],'2026-11-19');
 const after=structuredClone(s);after.actions[0].status='reserve';after.actions[0].weekId='';assert.match(editError(s,after),/Planifie d’abord/);
 after.actions[0]=planned(after.actions[0],'2026-11-20');assert.match(editError(s,after),/après/);
 after.actions[0]=planned(after.actions[0],'2026-11-18');assert.equal(editError(s,after),'');
});
test('step prerequisite propagates to its substeps; completion and weekly inclusion require all prerequisite actions',()=>{
 const s=fixture();s.steps[1].dependsOnStepId='s1';s.steps.push({id:'sub',stoneId:'i',pillarId:'p',parentStepId:'s2',title:'Petite partie'});s.actions[2].stepId='sub';
 assert.equal(blockers(s,s.actions[2])[0].kind,'step');assert.equal(stepDone(s,'s1'),false);
 const emptySub={id:'empty-child',stoneId:'i',pillarId:'p',parentStepId:'s2',completedAt:'now'};s.steps.push(emptySub);assert.equal(stepDone(s,emptySub.id),false);s.steps.pop();
 s.actions[0]=planned(s.actions[0]);assert.equal(scheduleIssue(s,planned(s.actions[2])).prerequisiteId,'b');
 s.actions[1]=planned(s.actions[1]);assert.equal(scheduleIssue(s,planned(s.actions[2])),null);
 s.actions[0].status=s.actions[1].status='done';assert.equal(stepDone(s,'s1'),true);assert.deepEqual(blockers(s,s.actions[2]),[]);
});
test('cycles across action and step dependencies, self dependencies and nested substeps are refused',()=>{
 const s=fixture();s.actions[0].dependsOnActionId='b';assert.match(dependencyError(s),/boucle/);s.actions[0].dependsOnActionId='';
 s.steps[1].dependsOnStepId='s1';s.actions[0].dependsOnActionId='c';assert.match(dependencyError(s),/boucle/);
 s.actions[0].dependsOnActionId='';s.steps[0].dependsOnStepId='s2';assert.match(dependencyError(s),/boucle/);
 s.steps.forEach(x=>x.dependsOnStepId='');s.steps[1].parentStepId='s1';s.steps.push({id:'s3',pillarId:'p',parentStepId:'s2'});assert.match(dependencyError(s),/seul niveau/);
});
test('empty prerequisite requires explicit completion, and completed actions cannot acquire unfinished prerequisites',()=>{
 const s=fixture();s.steps.push({id:'empty',stoneId:'i',pillarId:'p',title:'Résultat externe'});s.steps[1].dependsOnStepId='empty';assert.match(scheduleIssue(s,planned(s.actions[2])).message,/étape/);s.steps[2].completedAt='now';assert.equal(scheduleIssue(s,planned(s.actions[2])),null);
 s.actions[2].status='done';const after=structuredClone(s);after.actions[2].dependsOnActionId='a';assert.match(editError(s,after),/déjà terminée/);
});
test('identity and step UI expose contextual editing, optional substep before actions and planning only on individual actions',()=>{
 const s=fixture();const html=renderPage(s,'identity/i');assert.ok(html.indexOf('Ajouter une sous-étape')<html.indexOf('Rassembler les papiers'));assert.ok(html.indexOf('Ajouter une action')>html.indexOf('Classer les factures'));assert.match(html,/Modifier l’étape/);assert.match(html,/Ajouter une étape/);assert.doesNotMatch(html,/stone-percent|%/);assert.match(html,/Présente et attentive/);
 const create=identityStepForm(s,'i',null,'p');assert.match(create,/value="p" selected/);assert.match(create,/Quels résultats concrets/);assert.match(create,/dependsOnStepId/);
 const edit=identityStepForm(s,'i',s.steps[0]);assert.match(edit,/Organiser les papiers/);assert.match(edit,/Supprimer cette étape/);assert.match(actionForm(s,s.actions[1]),/value="a" selected/);
 assert.match(renderPage(s,'cible'),/Mon identité/);s.stones.push({id:'i2',title:'Bâtisseuse'});assert.match(renderPage(s,'vision'),/Mes identités/);
});
test('victory form links only identities, submits after selector and profile alone contains public page links',()=>{
 const s=fixture();s.daily={};const home=renderPage(s,'home');const form=home.slice(home.indexOf('id="win-form"'),home.indexOf('<div class="win-list">'));
 assert.match(form,/stone:i/);assert.doesNotMatch(form,/value="action:/);assert.ok(form.indexOf('Enregistrer ma victoire')>form.indexOf('</select>'));
 assert.doesNotMatch(home,/href="\.\/confidentialite.html/);const profile=renderPage(s,'profile');assert.match(profile,/confidentialite.html/);assert.match(profile,/data-setting="autoUpdates" checked/);assert.match(profile,/Vérifier maintenant/);
});
