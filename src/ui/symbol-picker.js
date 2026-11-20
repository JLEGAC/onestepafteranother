const emojis = {
  'Famille et liens': '🤍 cœur amour|❤️ amour cœur|🤝 accord alliance partenariat|🫂 câlin soutien|👥 groupe équipe|👶 bébé enfant|🏡 maison foyer|💬 échange discussion|💌 lettre affection',
  'Projets et travail': '🎯 cible objectif|🧱 brique bâtir pilier|🏗️ construction|🏢 immeuble immobilier|🔑 clé logement|💼 travail|💰 argent épargne|📈 finances croissance|🧩 puzzle|🛠️ outils bricolage',
  'Créativité et apprentissage': '📖 livre lecture|📚 livres apprentissage|✍️ écrire écriture|🎨 dessin art|🎤 micro parole oratrice|💡 idée|🎵 musique|📷 photo|🎓 études',
  'Habitudes et bien-être': '🌱 pousse graine|🌿 feuille nature|🧘 méditation yoga|🏃 course sport|💧 eau|🥗 repas|😴 sommeil|🪥 hygiène|☕ café|🧹 ménage rangement',
  'Repères et étapes': '🧭 boussole direction|🗓️ calendrier|⏰ horloge|✅ fait terminé|🏁 départ arrivée|🏆 victoire|⭐ étoile|✨ étincelles|🔁 répétition boucle|🪜 échelle étape|🌍 monde ouverture'
};
const symbols = '♡ cœur|☆ étoile|◇ losange|○ cercle|◎ cible|☐ case à cocher|✓ coche|↗ progression|→ flèche|↻ boucle|♪ musique|✎ crayon|☀ soleil|☾ lune|✦ éclat|⚑ drapeau|♧ trèfle|⌂ maison|≡ niveaux'.split('|');
const palette = { auto: 'Couleur du thème', gold: 'Or', green: 'Vert', blue: 'Bleu', purple: 'Violet', rose: 'Rose' };
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold = value => value.toLowerCase().replaceAll('œ','oe').replaceAll('æ','ae').normalize('NFD').replace(/\p{M}/gu,'');
const split = entry => { const i=entry.indexOf(' '); return [entry.slice(0,i),entry.slice(i+1)]; };
const monochrome = value => symbols.some(entry => split(entry)[0] === value);
const colorKey = value => Object.hasOwn(palette,value) ? value : 'auto';
export const symbolText = (item, field = 'icon', fallback = '') => item?.[field] ?? fallback;
export function symbolMark(item, field = 'icon', fallback = '') {
  const value = symbolText(item,field,fallback);
  if (!value) return '';
  return `<span aria-hidden="true" class="chosen-symbol${monochrome(value) ? ` symbol-ink-${colorKey(item?.iconColor)}` : ''}">${esc(value)}</span>`;
}
export const symbolFields = (fd, field = 'icon') => {
  const value = fd.get(field) || '';
  return { [field]: value, iconColor: monochrome(value) ? colorKey(fd.get('iconColor')) : '' };
};
export function symbolPicker(item, field = 'icon', fallback = '') {
  const value = symbolText(item,field,fallback);
  return `<div class="symbol-picker" data-symbol-picker>
    <input hidden name="${field}" value="${esc(value)}">
    <input hidden name="iconColor" value="${colorKey(item?.iconColor)}">
    <p class="symbol-label">Icône <small>(facultatif)</small></p>
    <div class="symbol-toolbar"><button type="button" class="button button-outline" data-symbol-open aria-expanded="false" aria-controls="symbol-panel"><span data-symbol-preview>${symbolMark(item,field,fallback)}</span> <span data-symbol-label>${value ? 'Changer l’icône' : 'Choisir un émoji ou un symbole'}</span></button>
    <button type="button" class="text-button" data-symbol-remove ${value ? '' : 'hidden'}>Retirer l’icône</button></div>
    <div class="symbol-panel" id="symbol-panel" hidden>
      <label>Type<select data-symbol-type><option value="emoji">Émojis</option><option value="mono" ${monochrome(value) ? 'selected' : ''}>Symboles monochromes</option></select></label>
      <label data-symbol-category>Catégorie<select><option value="">Toutes</option><option>Récents</option>${Object.keys(emojis).map(k=>`<option>${k}</option>`).join('')}</select></label>
      <label>Rechercher<input type="search" data-symbol-search placeholder="Ex. maison, cœur, calendrier"></label>
      <div class="symbol-grid" data-symbol-grid></div>
    </div>
    <label data-symbol-color ${monochrome(value) ? '' : 'hidden'}>Couleur du symbole<select>${Object.entries(palette).map(([key,label])=>`<option value="${key}" ${key===colorKey(item?.iconColor) ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
  </div>`;
}
const recentKey = 'upa-recent-emojis';
const readRecent = () => {
  try { const values = JSON.parse(localStorage.getItem(recentKey)); return Array.isArray(values) ? values : []; }
  catch { return []; }
};
export function bindSymbolPicker(root) {
  const picker = root.querySelector('[data-symbol-picker]');
  if (!picker) return;
  const find = key => picker.querySelector(`[data-symbol-${key}]`);
  const value = picker.querySelector('input[hidden]:not([name="iconColor"])');
  const color = picker.querySelector('[name="iconColor"]');
  const open = find('open'), panel = picker.querySelector('.symbol-panel');
  const type = find('type'), category = find('category'), search = find('search'), grid = find('grid');
  const colorControl = find('color'), colorSelect = colorControl.querySelector('select');
  const all = Object.values(emojis).flatMap(entries=>entries.split('|'));
  const refresh = () => {
    const item = { icon:value.value, iconColor:color.value };
    find('preview').innerHTML = symbolMark(item);
    find('label').textContent = value.value ? 'Changer l’icône' : 'Choisir un émoji ou un symbole';
    find('remove').hidden = !value.value;
    colorControl.hidden = !monochrome(value.value);
    colorSelect.value = colorKey(color.value);
  };
  const draw = () => {
    const mono = type.value === 'mono', cat = category.querySelector('select').value;
    category.hidden = mono;
    const entries = mono ? symbols : cat === 'Récents' ? readRecent().map(icon=>all.find(e=>split(e)[0]===icon)).filter(Boolean) : cat ? emojis[cat].split('|') : all;
    const query = fold(search.value.trim());
    grid.innerHTML = entries.filter(e=>fold(e).includes(query)).map(e=>{
      const [icon,label]=split(e);
      return `<button type="button" data-choice="${esc(icon)}" aria-label="${esc(label.split(' ')[0])}" title="${esc(label)}" aria-pressed="${icon===value.value}">${esc(icon)}</button>`;
    }).join('') || '<p>Aucun résultat.</p>';
  };
  const show = visible => { panel.hidden=!visible; open.setAttribute('aria-expanded',String(visible)); if(visible) draw(); };
  open.onclick = () => show(panel.hidden);
  type.onchange = draw;
  category.onchange = draw;
  search.oninput = draw;
  search.onkeydown = event => { if(event.key==='Enter') event.preventDefault(); };
  grid.onclick = event => {
    const choice=event.target.closest('[data-choice]');
    if(!choice) return;
    value.value=choice.dataset.choice;
    if (!monochrome(value.value)) {
      color.value='auto';
      try { localStorage.setItem(recentKey, JSON.stringify([value.value, ...readRecent().filter(e=>e!==value.value)].slice(0,12))); } catch {}
    }
    refresh(); show(false); open.focus();
  };
  find('remove').onclick = () => { value.value=''; color.value='auto'; refresh(); open.focus(); if(!panel.hidden) draw(); };
  colorSelect.onchange = () => { color.value=colorKey(colorSelect.value); refresh(); };
}
