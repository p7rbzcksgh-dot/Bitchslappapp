const STORE_KEY = 'tcg-bomapp-drafts-v1';
const INVENTORY_KEY = 'tcg-bomapp-inventory-v1';
const ALERT_KEY = 'tcg-internal-alerts-v1';

const BOM_TYPES = {
  MA:'Main Assembly (MA)',
  SA:'Sub Assembly (SA)',
  SSA:'SSA Assembly (SSA)',
  INASS:'INASS Assembly (INASS)',
  RNDASS:'R&D Assembly (RNDASS)',
  PROCEDURAL:'Procedural BOM'
};

const SECTION_TEMPLATES = [
  {title:'SSA in Sub Assembly', category:'SSA', children:[{title:'Parts used in SSA', category:'SSA_PARTS'}]},
  {title:'INASS used in Sub Assembly', category:'INASS', children:[{title:'Parts used in INASS', category:'INASS_PARTS'}]},
  {title:'FAS used in BOM', category:'FAS', children:[]},
  {title:'OTS used in BOM', category:'OTS', children:[]},
  {title:'MFG used in BOM', category:'MFG', children:[]},
  {title:'Other parts used in BOM', category:'OTHER', children:[]}
];

const CATEGORY_OPTIONS = ['SSA','SSA_PARTS','INASS','INASS_PARTS','SA','MA','RNDASS','PROCEDURAL','FAS','OTS','MFG','CAB','OTHER','SOLIDWORKS_IMPORT','CUSTOM'];

let workspace = [];
let inventory = [];
let currentDraftId = null;

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

document.addEventListener('DOMContentLoaded', init);

function init(){
  inventory = loadJson(INVENTORY_KEY, []);
  workspace = [];
  renderCounts();
  buildPartDatalist();
  renderInventory();

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if(nav){ showPage(nav.dataset.nav); return; }
    const action = e.target.closest('[data-action]');
    if(action){ handleAction(action.dataset.action, action); }
  });

  document.addEventListener('change', e => {
    if(e.target.id === 'inventoryFile') importInventory(e.target.files?.[0]);
    if(e.target.id === 'jsonDraftFile') importJsonDraft(e.target.files?.[0]);
    if(e.target.id === 'solidworksFile') importSolidworks(e.target.files?.[0]);
    if(e.target.id === 'solidworksFileUpdate') importSolidworks(e.target.files?.[0]);
  });

  document.addEventListener('input', e => {
    if(e.target.matches('.part-number-input')) handlePartNumberInput(e.target);
    if(e.target.id === 'inventorySearch') renderInventory(e.target.value);
  });

  renderDraftList();
  renderAlerts();
  updateEmptyState();
  handleIncomingBomUpdateRequest();
  toast('BOMAPP loaded.');
}

function handleAction(action, button){
  const map = {
    'create-bom': () => { showPage('create'); if(!workspace.length) focusSetup(); },
    'add-full-bom': addFullBomFromSetup,
    'add-empty-bom': () => addBom({type:'SA', number:'', name:'', impact:'none', sections:cloneSections()}),
    'add-custom-section': () => addCustomSection(button),
    'add-part-line': () => addPartLine(button),
    'delete-part-line': () => deletePartLine(button),
    'add-subsection': () => addSubsection(button),
    'delete-section': () => deleteSection(button),
    'delete-bom': () => deleteBom(button),
    'duplicate-bom': () => duplicateBom(button),
    'save-draft': saveDraft,
    'download-json': downloadJsonDraft,
    'verify-bom': () => verifyWorkspace(true),
    'export-mrp': exportMRP,
    'export-odoo': exportOdoo,
    'refresh-drafts': renderDraftList,
    'import-solidworks': () => $('#solidworksFile').click(),
    'import-solidworks-update': () => $('#solidworksFileUpdate').click(),
    'export-alerts': exportAlerts,
    'clear-alerts': clearAlerts,
    'mark-sop-verified': () => markSopVerified(button),
    'push-inventory-support': () => pushInventorySupport(button),
    'bom-update-needed-alert': createBomUpdateNeededAlert
  };
  if(map[action]) map[action]();
}

function showPage(name){
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#page-' + name)?.classList.add('active');
  document.body.classList.toggle('dashboard-mode', name === 'dashboard'); document.body.classList.toggle('font-v4', true); document.body.classList.toggle('clean-v5', true);
  if(name === 'update') renderDraftList();
  if(name === 'alerts') renderAlerts();
  window.scrollTo({top:0, behavior:'smooth'});
}

function focusSetup(){ setTimeout(() => $('#newBomNumber')?.focus(), 100); }

function cloneSections(){
  return SECTION_TEMPLATES.map(sec => ({
    id: uid('sec'),
    title: sec.title,
    category: sec.category,
    rows: [blankRow()],
    children: (sec.children||[]).map(child => ({id:uid('sec'), title:child.title, category:child.category, rows:[blankRow()], children:[]}))
  }));
}

function blankRow(){
  return {partNumber:'', description:'', qty:'', type:'', image:''};
}

function addFullBomFromSetup(){
  const type = $('#newBomType').value;
  const number = $('#newBomNumber').value.trim();
  const name = $('#newBomName').value.trim();
  const impact = $('#newBomImpact').value;
  addBom({type, number, name, impact, sections:cloneSections()});
  $('#newBomNumber').value = '';
  $('#newBomName').value = '';
}

function addBom(data){
  const bom = {
    id: data.id || uid('bom'),
    type: data.type || 'SA',
    number: data.number || '',
    name: data.name || '',
    revision: data.revision || 'R00',
    mainAssembly: data.mainAssembly || '',
    qtyPerMachine: data.qtyPerMachine || '1',
    impact: data.impact || 'none',
    sections: data.sections?.length ? data.sections : cloneSections(),
    verified: false
  };
  workspace.push(bom);
  renderWorkspace();
  updateEmptyState();
  toast('BOM section added.');
}

function renderWorkspace(){
  const wrap = $('#bomWorkspace');
  wrap.innerHTML = workspace.map((bom, index) => bomHtml(bom, index)).join('');
  restoreValuesFromData();
}

function bomHtml(bom, index){
  return `<article class="bom-card" data-bom-id="${bom.id}">
    <div class="bom-header">
      <div class="bom-title-row">
        <div>
          <span class="bom-type-pill">${escapeHtml(BOM_TYPES[bom.type] || bom.type)}</span>
          <h2>${escapeHtml(bom.number || 'New BOM')} ${bom.name ? '— ' + escapeHtml(bom.name) : ''}</h2>
        </div>
        <div class="button-row">
          <button class="small ghost" type="button" data-action="duplicate-bom">Duplicate</button>
          <button class="small red" type="button" data-action="delete-bom">Delete</button>
        </div>
      </div>
      <div class="bom-fields">
        ${field('BOM Type', selectHtml('bom-type', Object.keys(BOM_TYPES), bom.type))}
        ${field('BOM / Product Number', inputHtml('bom-number', bom.number, 'e.g., SA075'))}
        ${field('BOM Name / Description', inputHtml('bom-name', bom.name, 'e.g., Lower Camera Assembly'))}
        ${field('Revision', inputHtml('bom-revision', bom.revision, 'R00'))}
        ${field('Main Assembly', inputHtml('bom-main-assembly', bom.mainAssembly, 'SBX / CNV / CHS / OTHER'))}
        ${field('Qty Per Machine', inputHtml('bom-qty-machine', bom.qtyPerMachine, '1', 'number'))}
        ${field('SOP / Process Impact', selectHtml('bom-impact', {none:'No SOP audit required', required_sop:'Required SOP', urgent_process_change:'Urgent Process Change'}, bom.impact))}
      </div>
    </div>
    <div class="bom-body">
      <div class="button-row">
        <button class="small" type="button" data-action="add-custom-section">Add Custom Section</button>
      </div>
      ${(bom.sections||[]).map(sec => sectionHtml(sec, bom.id, 0)).join('')}
    </div>
  </article>`;
}

function sectionHtml(section, bomId, depth=0){
  return `<section class="section-card" data-section-id="${section.id}" data-depth="${depth}">
    <div class="section-head">
      <div class="section-head-left">
        <input class="section-title-input" value="${escapeAttr(section.title)}" aria-label="Section title">
        <select class="section-category-select">${CATEGORY_OPTIONS.map(o => `<option value="${o}" ${o===section.category?'selected':''}>${o}</option>`).join('')}</select>
      </div>
      <div class="button-row">
        <button class="small" type="button" data-action="add-part-line">Add Line</button>
        ${(section.category==='SSA' || section.category==='INASS' || depth===0) ? '<button class="small purple" type="button" data-action="add-subsection">Add Secondary Sub-section</button>' : ''}
        <button class="small red" type="button" data-action="delete-section">Delete Section</button>
      </div>
    </div>
    <div class="part-table">${(section.rows||[]).map(rowHtml).join('')}</div>
    <div class="subsections">${(section.children||[]).map(child => sectionHtml(child, bomId, depth+1)).join('')}</div>
  </section>`;
}

function rowHtml(row){
  return `<div class="part-row">
    ${field('Part #', `<input class="part-number-input" list="partSuggestions" value="${escapeAttr(row.partNumber)}" placeholder="Search prefix / part #" />`)}
    ${field('Description', `<input class="part-desc-input" value="${escapeAttr(row.description)}" placeholder="Part description" />`)}
    ${field('Qty / Machine', `<input class="part-qty-input" type="number" step="0.001" min="0" value="${escapeAttr(row.qty)}" placeholder="1" />`)}
    ${field('Type', `<input class="part-type-input" value="${escapeAttr(row.type)}" placeholder="SA / SSA / FAS / OTS / MFG" />`)}
    ${field('Picture / Image URL', `<input class="part-image-input" value="${escapeAttr(row.image)}" placeholder="optional image URL" />`)}
    <button class="icon-remove" type="button" data-action="delete-part-line" aria-label="Delete line">×</button>
  </div>`;
}

function field(label, inner){ return `<label>${label}${inner}</label>`; }
function inputHtml(cls, value, placeholder='', type='text'){ return `<input class="${cls}" type="${type}" value="${escapeAttr(value || '')}" placeholder="${escapeAttr(placeholder)}" />`; }
function selectHtml(cls, options, value){
  const entries = Array.isArray(options) ? options.map(o => [o, o]) : Object.entries(options);
  return `<select class="${cls}">${entries.map(([v,l]) => `<option value="${v}" ${v===value?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`;
}

function syncFromDom(){
  workspace = $$('.bom-card').map(card => {
    const get = sel => $(sel, card)?.value?.trim() || '';
    return {
      id: card.dataset.bomId,
      type: get('.bom-type'),
      number: get('.bom-number'),
      name: get('.bom-name'),
      revision: get('.bom-revision'),
      mainAssembly: get('.bom-main-assembly'),
      qtyPerMachine: get('.bom-qty-machine'),
      impact: get('.bom-impact'),
      verified: false,
      sections: $$('.bom-body > .section-card', card).map(sec => collectSection(sec))
    };
  });
}

function collectSection(secEl){
  const directChildren = Array.from(secEl.querySelector(':scope > .subsections')?.children || []);
  return {
    id: secEl.dataset.sectionId,
    title: $('.section-title-input', secEl)?.value || '',
    category: $('.section-category-select', secEl)?.value || 'CUSTOM',
    rows: $$('.part-table > .part-row', secEl).map(row => ({
      partNumber: $('.part-number-input', row)?.value.trim() || '',
      description: $('.part-desc-input', row)?.value.trim() || '',
      qty: $('.part-qty-input', row)?.value.trim() || '',
      type: $('.part-type-input', row)?.value.trim() || '',
      image: $('.part-image-input', row)?.value.trim() || ''
    })),
    children: directChildren.map(child => collectSection(child))
  };
}

function restoreValuesFromData(){ /* values are rendered directly */ }

function findClosestIds(button){
  const bomCard = button.closest('.bom-card');
  const section = button.closest('.section-card');
  return {bomId:bomCard?.dataset.bomId, sectionId:section?.dataset.sectionId};
}

function findSectionById(sections, id){
  for(const sec of sections){
    if(sec.id === id) return sec;
    const child = findSectionById(sec.children||[], id);
    if(child) return child;
  }
  return null;
}

function addPartLine(button){
  syncFromDom();
  const {bomId, sectionId} = findClosestIds(button);
  const bom = workspace.find(b => b.id === bomId);
  const sec = findSectionById(bom?.sections || [], sectionId);
  sec.rows.push(blankRow());
  renderWorkspace();
}

function deletePartLine(button){
  syncFromDom();
  const {bomId, sectionId} = findClosestIds(button);
  const rowIndex = Array.from(button.closest('.part-table')?.children || []).indexOf(button.closest('.part-row'));
  const bom = workspace.find(b => b.id === bomId);
  const sec = findSectionById(bom?.sections || [], sectionId);
  if(sec.rows.length <= 1) sec.rows = [blankRow()];
  else sec.rows.splice(rowIndex, 1);
  renderWorkspace();
}

function addSubsection(button){
  syncFromDom();
  const {bomId, sectionId} = findClosestIds(button);
  const bom = workspace.find(b => b.id === bomId);
  const sec = findSectionById(bom?.sections || [], sectionId);
  sec.children = sec.children || [];
  sec.children.push({id:uid('sec'), title:'Secondary Sub-section', category:'CUSTOM', rows:[blankRow()], children:[]});
  renderWorkspace();
}

function addCustomSection(button){
  syncFromDom();
  const bomId = button.closest('.bom-card')?.dataset.bomId;
  const bom = workspace.find(b => b.id === bomId);
  bom.sections.push({id:uid('sec'), title:'Custom Section', category:'CUSTOM', rows:[blankRow()], children:[]});
  renderWorkspace();
}

function deleteSection(button){
  syncFromDom();
  const {bomId, sectionId} = findClosestIds(button);
  const bom = workspace.find(b => b.id === bomId);
  removeSectionById(bom.sections, sectionId);
  renderWorkspace();
}

function removeSectionById(sections, id){
  const i = sections.findIndex(s => s.id === id);
  if(i >= 0){ sections.splice(i, 1); return true; }
  for(const sec of sections){ if(removeSectionById(sec.children || [], id)) return true; }
  return false;
}

function deleteBom(button){
  syncFromDom();
  const id = button.closest('.bom-card')?.dataset.bomId;
  workspace = workspace.filter(b => b.id !== id);
  renderWorkspace(); updateEmptyState();
}

function duplicateBom(button){
  syncFromDom();
  const id = button.closest('.bom-card')?.dataset.bomId;
  const bom = workspace.find(b => b.id === id);
  const copy = JSON.parse(JSON.stringify(bom));
  copy.id = uid('bom'); copy.number = copy.number ? copy.number + '-COPY' : '';
  reIdSections(copy.sections);
  workspace.push(copy);
  renderWorkspace();
}

function reIdSections(sections){ sections.forEach(s => { s.id=uid('sec'); (s.rows||[]).forEach(()=>{}); reIdSections(s.children||[]); }); }

function updateEmptyState(){ $('#emptyWorkspace').style.display = workspace.length ? 'none' : 'block'; }

function saveDraft(){
  syncFromDom();
  if(!workspace.length){ toast('Create a BOM before saving.'); return; }
  const drafts = loadJson(STORE_KEY, {});
  const id = currentDraftId || uid('draft');
  currentDraftId = id;
  drafts[id] = {id, updatedAt:new Date().toISOString(), workspace};
  localStorage.setItem(STORE_KEY, JSON.stringify(drafts));
  emitBomAlerts('draft_saved');
  renderCounts(); renderDraftList();
  toast('Draft saved to this browser/device.');
}

function downloadJsonDraft(){
  syncFromDom();
  const draft = {exportedAt:new Date().toISOString(), app:'TCG BOMAPP', workspace, inventoryMeta:{records:inventory.length}};
  downloadFile('tcg-bomapp-draft.json', JSON.stringify(draft,null,2), 'application/json');
}

function importJsonDraft(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      workspace = data.workspace || [];
      currentDraftId = data.id || uid('draft');
      showPage('create'); renderWorkspace(); updateEmptyState();
      toast('JSON draft imported.');
    }catch(e){ toast('Could not import JSON draft.'); }
  };
  reader.readAsText(file);
}

function renderDraftList(){
  const wrap = $('#savedDrafts'); if(!wrap) return;
  const drafts = Object.values(loadJson(STORE_KEY, {})).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  wrap.innerHTML = drafts.length ? drafts.map(d => `<div class="draft-card">
    <strong>${escapeHtml(d.workspace?.[0]?.number || 'Untitled BOM')}</strong>
    <p class="tiny-note">${escapeHtml(d.workspace?.[0]?.name || '')} · ${new Date(d.updatedAt).toLocaleString()}</p>
    <div class="button-row"><button class="small" onclick="loadDraft('${d.id}')">Open</button><button class="small red" onclick="deleteDraft('${d.id}')">Delete</button></div>
  </div>`).join('') : '<p class="tiny-note">No saved drafts yet.</p>';
}

window.loadDraft = function(id){
  const d = loadJson(STORE_KEY, {})[id];
  if(!d) return;
  currentDraftId = id;
  workspace = d.workspace || [];
  showPage('create'); renderWorkspace(); updateEmptyState();
};
window.deleteDraft = function(id){
  const drafts = loadJson(STORE_KEY, {});
  delete drafts[id];
  localStorage.setItem(STORE_KEY, JSON.stringify(drafts));
  renderDraftList(); renderCounts();
};

function verifyWorkspace(show=true){
  syncFromDom();
  const issues = [];
  workspace.forEach((bom, bi) => {
    if(!bom.type) issues.push(`BOM ${bi+1}: missing BOM type`);
    if(!bom.number) issues.push(`BOM ${bi+1}: missing BOM/Product number`);
    if(!bom.name) issues.push(`BOM ${bi+1}: missing BOM name/description`);
    eachRow(bom, (row, sec, ri) => {
      if(row.partNumber || row.description || row.qty){
        if(!row.partNumber) issues.push(`${bom.number || 'BOM '+(bi+1)} / ${sec.title}: row ${ri+1} missing part number`);
        if(!row.description) issues.push(`${bom.number || 'BOM '+(bi+1)} / ${sec.title}: row ${ri+1} missing description`);
        if(!row.qty || Number(row.qty) <= 0) issues.push(`${bom.number || 'BOM '+(bi+1)} / ${sec.title}: row ${ri+1} missing valid qty`);
      }
    });
  });
  if(show){
    if(!issues.length) {
      emitBomAlerts('bom_verified');
      toast('BOM verified. Ready to export.');
    } else alert('BOM verification issues:\\n\\n' + issues.join('\\n'));
  }
  return issues;
}

function eachRow(bom, callback){
  function walk(sec){
    (sec.rows||[]).forEach((r,i)=>callback(r, sec, i));
    (sec.children||[]).forEach(walk);
  }
  (bom.sections||[]).forEach(walk);
}

function flattenComponents(){
  syncFromDom();
  const rows = [];
  workspace.forEach(bom => {
    eachRow(bom, (row, sec) => {
      if(row.partNumber || row.description || row.qty){
        rows.push({
          parentNumber:bom.number,
          parentName:bom.name,
          parentType:bom.type,
          revision:bom.revision,
          mainAssembly:bom.mainAssembly,
          section:sec.title,
          category:sec.category,
          partNumber:row.partNumber,
          description:row.description,
          qty:row.qty,
          type:row.type || inferType(row.partNumber),
          image:row.image
        });
      }
    });
  });
  return rows;
}

function exportMRP(){
  const issues = verifyWorkspace(false);
  if(issues.length){ alert('Fix verification issues before export:\\n\\n' + issues.join('\\n')); return; }
  const components = flattenComponents();
  const parents = workspace.map(b => ({number:b.number, name:b.name, type:b.type}));
  const uniqueItems = new Map();
  parents.forEach(p => uniqueItems.set(p.number, {number:p.number, name:p.name, type:p.type}));
  components.forEach(r => uniqueItems.set(r.partNumber, {number:r.partNumber, name:r.description, type:r.type}));
  const itemsCsv = toCsv([...uniqueItems.values()].map(item => ({
    'Product number':item.number,
    'Name':item.name,
    'Unit':'pcs',
    'Type':item.type || inferType(item.number)
  })));
  const bomCsv = toCsv(components.map(r => ({
    'Product number':r.parentNumber,
    'Part No.':r.partNumber,
    'Quantity':r.qty,
    'Notes':`${r.section} | ${r.category} | ${r.description}`
  })));
  downloadFile('MRPeasy_01_Items_Create_First.csv', itemsCsv, 'text/csv');
  setTimeout(()=>downloadFile('MRPeasy_02_BOM_Import_Second.csv', bomCsv, 'text/csv'), 300);
  emitBomAlerts('mrp_exported');
  toast('MRPeasy CSV pack downloading: Items first, BOM second.');
}

function exportOdoo(){
  const issues = verifyWorkspace(false);
  if(issues.length){ alert('Fix verification issues before export:\\n\\n' + issues.join('\\n')); return; }
  const components = flattenComponents();
  const csv = toCsv(components.map(r => ({
    'BOM Reference':r.parentNumber,
    'Product':r.parentName,
    'Product Internal Reference':r.parentNumber,
    'Component':r.description,
    'Component Internal Reference':r.partNumber,
    'Quantity':r.qty,
    'Product Unit of Measure':'Units',
    'BOM Type':'Manufacture this product',
    'Section':r.section,
    'Category':r.category,
    'Main Assembly':r.mainAssembly,
    'Image / Picture':r.image
  })));
  downloadFile('Odoo_BOM_Import.csv', csv, 'text/csv');
  emitBomAlerts('odoo_exported');
  toast('Odoo CSV exported.');
}

function emitBomAlerts(eventType){
  const alerts = loadAlerts();
  const now = new Date().toISOString();
  workspace.forEach(bom => {
    if(bom.impact === 'required_sop' || bom.impact === 'urgent_process_change'){
      const id = uid('alert');
      alerts.unshift({
        id,
        source:'BOMAPP',
        eventType:bom.impact,
        workflowEvent:eventType,
        status:'open',
        severity:bom.impact === 'urgent_process_change' ? 'urgent' : 'required',
        bomNumber:bom.number,
        bomName:bom.name,
        bomType:bom.type,
        createdAt:now,
        sopVerified:false,
        bomVerified:eventType === 'bom_verified' || eventType.includes('exported'),
        inventoryNotified:false,
        supportNotified:false,
        link: location.href.split('#')[0]
      });
    }
  });
  localStorage.setItem(ALERT_KEY, JSON.stringify(dedupeAlerts(alerts).slice(0,200)));
  renderCounts(); renderAlerts();
}

function dedupeAlerts(alerts){
  const seen = new Set();
  return alerts.filter(a => {
    const key = `${a.eventType}|${a.bomNumber}|${a.workflowEvent}`;
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function loadAlerts(){ return loadJson(ALERT_KEY, []); }
function renderAlerts(){
  const wrap = $('#alertList'); if(!wrap) return;
  const alerts = loadAlerts();
  wrap.innerHTML = alerts.length ? alerts.map(a => `<div class="alert-card ${a.severity || 'required'}">
    <strong>${escapeHtml(alertDisplayTitle(a))} — ${escapeHtml(a.bomNumber || '')}</strong>
    <p>${escapeHtml(a.bomName || '')}</p>
    <p class="tiny-note">Status: ${escapeHtml(a.status)} | SOP verified: ${a.sopVerified ? 'Yes' : 'No'} | Inventory/Support notified: ${a.inventoryNotified && a.supportNotified ? 'Yes' : 'No'}</p>
    ${a.link ? `<p class="tiny-note">Source link: ${escapeHtml(a.link)}</p>` : ''}
    <div class="button-row">
      <button class="small green" data-action="mark-sop-verified" data-alert-id="${a.id}">Mark SOP Verified</button>
      <button class="small purple" data-action="push-inventory-support" data-alert-id="${a.id}">Push Inventory + Support Alert</button>
    </div>
  </div>`).join('') : '<p class="tiny-note">No open alerts yet.</p>';
}

function alertDisplayTitle(a){
  if(a.eventType === 'bom_update_needed') return 'BOM UPDATE NEEDED';
  if(a.eventType === 'inventory_audit_required') return 'INVENTORY AUDIT REQUIRED';
  if(a.eventType === 'support_visibility_update') return 'SUPPORT VISIBILITY UPDATE';
  if(a.severity === 'urgent') return 'URGENT PROCESS CHANGE';
  return 'REQUIRED SOP';
}

function markSopVerified(button){
  const id = button.dataset.alertId;
  const alerts = loadAlerts();
  const alert = alerts.find(a => a.id === id);
  if(alert){ alert.sopVerified = true; alert.status = 'sop_verified'; alert.sopVerifiedAt = new Date().toISOString(); }
  localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));
  renderAlerts(); renderCounts(); toast('SOP verified alert sent back to BOMAPP queue.');
}

function pushInventorySupport(button){
  const id = button.dataset.alertId;
  const alerts = loadAlerts();
  const alert = alerts.find(a => a.id === id);
  if(alert){
    alert.inventoryNotified = true;
    alert.supportNotified = true;
    alert.status = alert.sopVerified ? 'ready_for_inventory_support' : 'waiting_for_sop_verification';
    alert.inventorySupportNotifiedAt = new Date().toISOString();
    alerts.unshift({...alert, id:uid('alert'), source:'BOMAPP', eventType:'inventory_audit_required', status:'open', severity:'required'});
    alerts.unshift({...alert, id:uid('alert'), source:'BOMAPP', eventType:'support_visibility_update', status:'open', severity:'required'});
  }
  localStorage.setItem(ALERT_KEY, JSON.stringify(alerts));
  renderAlerts(); renderCounts(); toast('Inventory and Support notifications queued.');
}

function exportAlerts(){
  downloadFile('TCG_Internal_App_Alert_Queue.json', JSON.stringify(loadAlerts(), null, 2), 'application/json');
}
function clearAlerts(){
  if(confirm('Clear all local alerts?')){ localStorage.setItem(ALERT_KEY, '[]'); renderAlerts(); renderCounts(); }
}

function importInventory(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(reader.result);
    inventory = rows.map(r => normalizeInventoryRow(r)).filter(r => r.partNumber || r.description);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    buildPartDatalist(); renderInventory(); renderCounts();
    toast(`Imported ${inventory.length} inventory records.`);
  };
  reader.readAsText(file);
}

function normalizeInventoryRow(r){
  const pick = names => {
    for(const n of names){ const key = Object.keys(r).find(k => k.trim().toLowerCase() === n.toLowerCase()); if(key) return r[key]; }
    return '';
  };
  return {
    partNumber: pick(['Part Number','Part No.','PartNo','Item','Number','Product number','Internal Reference','SKU']),
    description: pick(['Description','Name','Part Description','Product','Item Description']),
    qtyPerMachine: pick(['Qty','Quantity','Quantity per Machine','Qty per Machine','QTY']),
    type: pick(['Type','Category','Prefix']),
    image: pick(['Picture','Image','Image URL','Photo','Photo URL'])
  };
}

function renderInventory(query=''){
  const wrap = $('#inventoryResults'); if(!wrap) return;
  const q = query.toLowerCase().trim();
  const data = inventory.filter(r => !q || [r.partNumber,r.description,r.type].join(' ').toLowerCase().includes(q)).slice(0,100);
  wrap.innerHTML = data.length ? data.map(r => `<div class="inventory-card">
    <strong>${escapeHtml(r.partNumber)}</strong> <span class="tiny-note">${escapeHtml(r.type || inferType(r.partNumber))}</span>
    <p>${escapeHtml(r.description || '')}</p>
    <p class="tiny-note">Qty/Machine: ${escapeHtml(r.qtyPerMachine || '')} ${r.image ? '| Image: ' + escapeHtml(r.image) : ''}</p>
  </div>`).join('') : '<p class="tiny-note">No inventory records loaded yet.</p>';
}

function buildPartDatalist(){
  const dl = $('#partSuggestions'); if(!dl) return;
  dl.innerHTML = inventory.slice(0,1000).map(r => `<option value="${escapeAttr(r.partNumber)}">${escapeHtml(r.description || '')}</option>`).join('');
}

function handlePartNumberInput(input){
  const value = input.value.trim().toLowerCase();
  const match = inventory.find(r => r.partNumber.toLowerCase() === value);
  if(match){
    const row = input.closest('.part-row');
    $('.part-desc-input', row).value = match.description || '';
    $('.part-qty-input', row).value = match.qtyPerMachine || $('.part-qty-input', row).value || '';
    $('.part-type-input', row).value = match.type || inferType(match.partNumber);
    $('.part-image-input', row).value = match.image || '';
  }
}

function importSolidworks(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(reader.result);
    const parts = rows.map(r => normalizeInventoryRow(r)).filter(r => r.partNumber || r.description);
    if(!parts.length){ toast('No part rows found in SOLIDWORKS file.'); return; }
    const bomNum = $('#newBomNumber')?.value.trim() || 'SW-IMPORT-' + new Date().toISOString().slice(0,10);
    const bomName = $('#newBomName')?.value.trim() || 'SOLIDWORKS Imported BOM';
    const bom = {
      id:uid('bom'), type:$('#newBomType')?.value || 'SA', number:bomNum, name:bomName,
      revision:'R00', mainAssembly:'', qtyPerMachine:'1', impact:$('#newBomImpact')?.value || 'none',
      sections:[{id:uid('sec'), title:'SOLIDWORKS Imported Components', category:'SOLIDWORKS_IMPORT', rows:parts.map(p => ({partNumber:p.partNumber, description:p.description, qty:p.qtyPerMachine || '1', type:p.type || inferType(p.partNumber), image:p.image})), children:[]}]
    };
    workspace.push(bom);
    showPage('create'); renderWorkspace(); updateEmptyState();
    toast(`Imported ${parts.length} SOLIDWORKS part rows.`);
  };
  reader.readAsText(file);
}

function parseCsv(text){
  const delimiter = text.includes('\t') ? '\t' : (text.includes(';') && !text.includes(',') ? ';' : ',');
  const lines = text.replace(/\r/g,'').split('\n').filter(l => l.trim());
  if(!lines.length) return [];
  const parseLine = line => {
    const out=[]; let cur=''; let quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch === '"'){
        if(quoted && line[i+1] === '"'){ cur += '"'; i++; }
        else quoted = !quoted;
      } else if(ch === delimiter && !quoted){ out.push(cur.trim()); cur=''; }
      else cur += ch;
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h,i) => obj[h || `Column${i+1}`] = vals[i] || '');
    return obj;
  });
}

function inferType(part=''){
  const p = String(part).trim().toUpperCase();
  if(p.startsWith('SA')) return 'SA';
  if(p.startsWith('SSA')) return 'SSA';
  if(p.startsWith('INASS')) return 'INASS';
  if(p.startsWith('MFG')) return 'MFG';
  if(p.startsWith('FAS')) return 'FAS';
  if(p.startsWith('OTS')) return 'OTS';
  if(p.startsWith('CAB')) return 'CAB';
  return '';
}

function toCsv(rows){
  if(!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  return [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

function downloadFile(filename, content, type){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function loadJson(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch(e){ return fallback; }
}

function renderCounts(){
  const draftCount = $('#draftCount');
  const alertCount = $('#alertCount');
  const inventoryCount = $('#inventoryCount');
  if(draftCount) draftCount.textContent = Object.keys(loadJson(STORE_KEY, {})).length;
  if(alertCount) alertCount.textContent = loadAlerts().filter(a => a.status !== 'closed').length;
  if(inventoryCount) inventoryCount.textContent = loadJson(INVENTORY_KEY, []).length;
  updateBomAlertButton();
}

function updatePartSuggestionsFromRow(row){}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/`/g,'&#096;'); }
function uid(prefix='id'){ return prefix + '-' + Math.random().toString(36).slice(2,8) + '-' + Date.now().toString(36); }
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

window.TCGAlertBridge = {
  getAlerts: () => loadAlerts(),
  clearAlerts,
  markSopVerified: id => {
    const alerts = loadAlerts();
    const a = alerts.find(x => x.id === id);
    if(a){ a.sopVerified = true; a.status = 'sop_verified'; localStorage.setItem(ALERT_KEY, JSON.stringify(alerts)); }
  },
  ALERT_KEY
};


function createBomUpdateNeededAlert(){
  const alerts = loadAlerts();
  const existingOpen = alerts.find(a => a.eventType === 'bom_update_needed' && a.status !== 'closed');
  const alert = {
    id: uid('alert'),
    source:'BOMAPP',
    requestedBy:'BOMAPP dashboard / SOP Wizard reverse link',
    eventType:'bom_update_needed',
    workflowEvent:'request_bom_update',
    status:'open',
    severity:'urgent',
    bomNumber:'BOM UPDATE REQUEST',
    bomName:'BOM update/audit required from SOP or process review',
    createdAt:new Date().toISOString(),
    sopVerified:false,
    bomVerified:false,
    inventoryNotified:false,
    supportNotified:false,
    link:location.href.split('?')[0]
  };
  if(!existingOpen) alerts.unshift(alert);
  localStorage.setItem(ALERT_KEY, JSON.stringify(alerts.slice(0,200)));
  renderCounts();
  renderAlerts();
  showPage('alerts');
  toast(existingOpen ? 'Open BOM update alert already exists.' : 'BOM update needed alert created.');
}

function handleIncomingBomUpdateRequest(){
  const params = new URLSearchParams(location.search);
  const request = params.get('request') || params.get('alert');
  if(request !== 'bom-update-needed') return;
  const sessionKey = 'bomapp-incoming-bom-update-alert-created';
  if(!sessionStorage.getItem(sessionKey)){
    sessionStorage.setItem(sessionKey, '1');
    createBomUpdateNeededAlert();
  } else {
    showPage('alerts');
  }
}


function updateBomAlertButton(){
  const btn = $('#bomUpdateAlertButton');
  if(!btn) return;
  const count = loadAlerts().filter(a => a.eventType === 'bom_update_needed' && a.status !== 'closed').length;
  btn.classList.toggle('has-alert', count > 0);
  const small = btn.querySelector('small');
  if(small) small.textContent = count ? `${count} BOM update request${count === 1 ? '' : 's'} waiting` : 'No active BOM update request';
  const dot = btn.querySelector('.alert-dot');
  if(dot) dot.textContent = count ? String(count) : '!';
}
