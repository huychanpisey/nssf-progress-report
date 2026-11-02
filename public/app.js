// Khmer Monthly Progress Monitoring & Reporting App
// Department of Information Technology - NSSF

const MONTH_NAMES = [
  'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 
  'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
];

function cleanKhmer(str) {
  if (!str) return '';
  return str
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// Check if a row is a sub-program header row (1.1-1.7, 2.1-2.2, 3.1-3.6, 4.1)
function isSubProgramRow(no) {
  if (!no) return false;
  return /^[១-៤1-4]\.[១-៩1-9]/.test(no.trim());
}

const state = {
  viewMode: 'MONTHLY', // 'MONTHLY' | 'CONSOLIDATED'
  year: '2027',
  month: 'កញ្ញា',
  monthNum: '09',
  fromMonthIdx: 0,
  toMonthIdx: 8,
  reportData: null,
  consolidatedData: null,
  planItems: [],
  availableReports: [],
  filters: {
    office: 'ALL',
    status: 'ALL',
    program: 'ALL',
    search: ''
  },
  editingItemId: null,
  isDirty: false
};

// DOM Elements
const elYearSelect = document.getElementById('yearSelect');
const elMonthTabsContainer = document.getElementById('monthTabsContainer');
const elReportHeaderTitle = document.getElementById('reportHeaderTitle');
const elPrintTitle = document.getElementById('printTitle');
const elThMonthTarget = document.getElementById('thMonthTarget');
const elReportTableBody = document.getElementById('reportTableBody');
const elSaveStatusIndicator = document.getElementById('saveStatusIndicator');

// Mode Switchers
const elTabModeMonthly = document.getElementById('tabModeMonthly');
const elTabModeConsolidated = document.getElementById('tabModeConsolidated');
const elSectionMonthlyNav = document.getElementById('sectionMonthlyNav');
const elSectionConsolidatedNav = document.getElementById('sectionConsolidatedNav');
const elSelectFromMonth = document.getElementById('selectFromMonth');
const elSelectToMonth = document.getElementById('selectToMonth');
const elBtnRunConsolidate = document.getElementById('btnRunConsolidate');

// Target Mismatch Alert elements
const elMismatchAlertBanner = document.getElementById('mismatchAlertBanner');
const elMismatchCountText = document.getElementById('mismatchCountText');
const elBtnFilterMismatches = document.getElementById('btnFilterMismatches');
const elBtnFixAllTargets = document.getElementById('btnFixAllTargets');

// Import DOCX elements
const elBtnImportDocx = document.getElementById('btnImportDocx');
const elDocxFileInput = document.getElementById('docxFileInput');

// Clear Data Button
const elBtnClearData = document.getElementById('btnClearData');

// KPI elements
const elKpiTotal = document.getElementById('kpiTotal');
const elKpiStatus3 = document.getElementById('kpiStatus3');
const elKpiStatus2 = document.getElementById('kpiStatus2');
const elKpiStatus1 = document.getElementById('kpiStatus1');
const elKpiStatusNone = document.getElementById('kpiStatusNone');
const elKpiPercentText = document.getElementById('kpiPercentText');
const elKpiProgressBar = document.getElementById('kpiProgressBar');

// Filter elements
const elSearchInput = document.getElementById('searchInput');
const elFilterOffice = document.getElementById('filterOffice');
const elFilterStatus = document.getElementById('filterStatus');
const elFilterProgram = document.getElementById('filterProgram');

// Modal elements
const elEditModal = document.getElementById('editModal');
const elModalSubTitle = document.getElementById('modalSubTitle');
const elModalActivityText = document.getElementById('modalActivityText');
const elModalIndicatorText = document.getElementById('modalIndicatorText');
const elModalInputTarget = document.getElementById('modalInputTarget');
const elModalPlanTargetHint = document.getElementById('modalPlanTargetHint');
const elModalInputStatus = document.getElementById('modalInputStatus');
const elModalInputPercent = document.getElementById('modalInputPercent');
const elModalInputProgress = document.getElementById('modalInputProgress');
const elModalInputChallenges = document.getElementById('modalInputChallenges');
const elModalInputSolutions = document.getElementById('modalInputSolutions');
const elModalInputOffice = document.getElementById('modalInputOffice');

function updateSyncPlanButtonText() {
  const btn = document.getElementById('btnSyncPlan');
  const span = document.getElementById('btnSyncPlanText') || (btn ? btn.querySelector('span') : null);
  const khmerYear = state.year === '2026' ? '២០២៦' : (state.year === '2027' ? '២០២៧' : state.year);
  if (span) {
    span.textContent = `ទាញពីផែនការ${khmerYear}`;
  }
  if (btn) {
    btn.title = `ទាញចំណុចដៅពីផែនការសកម្មភាពឆ្នាំ${khmerYear} ចូលមកឡើងវិញ`;
  }
  const elMismatchPlanYearText = document.getElementById('mismatchPlanYearText');
  if (elMismatchPlanYearText) {
    elMismatchPlanYearText.textContent = `(ប្រព័ន្ធបានប្រៀបធៀបជាមួយផែនការសកម្មភាពឆ្នាំ${khmerYear} រួចរាល់)`;
  }
}

// Init application
async function initApp() {
  setupEventListeners();
  updateSyncPlanButtonText();
  await loadActionPlan(state.year);
  await fetchAvailableReportsList();
  renderMonthTabs();
  await loadCurrentReport();

  setInterval(() => {
    if (state.isDirty && state.viewMode === 'MONTHLY') {
      saveReport(true);
    }
  }, 45000);
}

// Setup Event Listeners
function setupEventListeners() {
  // Mode switching
  elTabModeMonthly.addEventListener('click', () => switchMode('MONTHLY'));
  elTabModeConsolidated.addEventListener('click', () => switchMode('CONSOLIDATED'));

  // Year Selection
  elYearSelect.addEventListener('change', async (e) => {
    state.year = e.target.value;
    updateSyncPlanButtonText();
    await loadActionPlan(state.year);
    await fetchAvailableReportsList();
    renderMonthTabs();
    if (state.viewMode === 'MONTHLY') {
      await loadCurrentReport();
    } else {
      await loadConsolidatedReport();
    }
  });

  // Consolidated Range Buttons & Presets
  elBtnRunConsolidate.addEventListener('click', () => {
    state.fromMonthIdx = parseInt(elSelectFromMonth.value, 10);
    state.toMonthIdx = parseInt(elSelectToMonth.value, 10);
    if (state.fromMonthIdx > state.toMonthIdx) {
      showToast('ខែចាប់ផ្តើម មិនអាចធំជាងខែបញ្ចប់បានឡើយ!', 'error');
      return;
    }
    loadConsolidatedReport();
  });

  document.querySelectorAll('.btn-preset-range').forEach(btn => {
    btn.addEventListener('click', () => {
      const from = parseInt(btn.dataset.from, 10);
      const to = parseInt(btn.dataset.to, 10);
      elSelectFromMonth.value = from;
      elSelectToMonth.value = to;
      state.fromMonthIdx = from;
      state.toMonthIdx = to;
      loadConsolidatedReport();
    });
  });

  // Filters
  elSearchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase().trim();
    renderTable();
  });

  elFilterOffice.addEventListener('change', (e) => {
    state.filters.office = e.target.value;
    renderTable();
  });

  elFilterStatus.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderTable();
  });

  elFilterProgram.addEventListener('change', (e) => {
    state.filters.program = e.target.value;
    renderTable();
  });

  // Target Mismatches Banner actions
  elBtnFixAllTargets.addEventListener('click', fixAllTargetsToPlan);
  elBtnFilterMismatches.addEventListener('click', () => {
    elFilterStatus.value = 'MISMATCH';
    state.filters.status = 'MISMATCH';
    renderTable();
    showToast('កំពុងបង្ហាញតែជួរដែលចំណុចដៅខុសពីផែនការ...', 'info');
  });

  // Clear Data Button
  if (elBtnClearData) {
    elBtnClearData.addEventListener('click', handleClearData);
  }

  // Action buttons
  document.getElementById('btnSaveTop').addEventListener('click', () => saveReport(false));
  document.getElementById('btnExportDocx').addEventListener('click', exportDocx);
  document.getElementById('btnExportCsv').addEventListener('click', exportCsv);
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
  document.getElementById('btnSyncPlan').addEventListener('click', syncWithActionPlan);
  document.getElementById('btnAddNewRow').addEventListener('click', addNewRow);

  // Fullscreen button
  const btnFullscreen = document.getElementById('btnToggleFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }

  // Import Word DOCX
  if (elBtnImportDocx && elDocxFileInput) {
    elBtnImportDocx.addEventListener('click', () => {
      elDocxFileInput.value = '';
      elDocxFileInput.click();
    });

    elDocxFileInput.addEventListener('change', handleDocxImport);
  }

  // Modal buttons
  document.getElementById('modalBtnClose').addEventListener('click', closeModal);
  document.getElementById('modalBtnCancel').addEventListener('click', closeModal);
  document.getElementById('modalBtnSave').addEventListener('click', saveModal);
}

// Clear Data Function
function handleClearData() {
  if (state.viewMode === 'MONTHLY') {
    const confirmMsg = `តើលោកអ្នកពិតជាចង់សម្អាត (Clear) ទិន្នន័យវឌ្ឍនភាពសម្រាប់ខែ${state.month} ឆ្នាំ${state.year} ឡើងវិញមែនទេ?\n\n(រាល់ទិន្នន័យវឌ្ឍនភាពសម្រេចបាន, ភាគរយ %, បញ្ហាប្រឈម និងដំណោះស្រាយ នឹងត្រូវសម្អាតឱ្យនៅទទេឡើងវិញ ដោយរក្សាទុកតែចំណុចដៅតាមផែនការ)`;
    if (!confirm(confirmMsg)) return;

    if (!state.reportData || !state.reportData.items) return;

    state.reportData.items.forEach(item => {
      if (!isSubProgramRow(item.no)) {
        item.progress = '';
        item.progressPercent = '';
        item.challenges = '';
        item.solutions = '';
        if (item.target === '-' || !item.target) {
          item.status = '-';
        } else {
          item.status = '៣';
        }
      }
    });

    verifyTargetsInCurrentReport();
    renderTable();
    updateKpiDashboard();
    markDirty();

    showToast(`បានសម្អាត (Clear) ទិន្នន័យវឌ្ឍនភាពខែ${state.month} រួចរាល់!`, 'info');
  } else {
    // Consolidated mode reload
    if (confirm('តើលោកអ្នកចង់ដំណើរការបូកសរុបទិន្នន័យឡើងវិញមែនទេ?')) {
      loadConsolidatedReport();
    }
  }
}

// Switch between Monthly and Consolidated Mode
function switchMode(mode, reload = true) {
  state.viewMode = mode;
  if (mode === 'MONTHLY') {
    elTabModeMonthly.className = 'px-2.5 py-1 rounded text-xs font-semibold transition bg-amber-500 text-brand-900 shadow flex items-center gap-1.5';
    elTabModeConsolidated.className = 'px-2.5 py-1 rounded text-xs font-semibold transition text-slate-200 hover:text-white flex items-center gap-1.5';
    elSectionMonthlyNav.classList.remove('hidden');
    elSectionConsolidatedNav.classList.add('hidden');
    if (reload) loadCurrentReport();
  } else {
    elTabModeMonthly.className = 'px-2.5 py-1 rounded text-xs font-semibold transition text-slate-200 hover:text-white flex items-center gap-1.5';
    elTabModeConsolidated.className = 'px-2.5 py-1 rounded text-xs font-semibold transition bg-amber-500 text-brand-900 shadow flex items-center gap-1.5';
    elSectionMonthlyNav.classList.add('hidden');
    elSectionConsolidatedNav.classList.remove('hidden');
    elMismatchAlertBanner.classList.add('hidden');
    if (reload) loadConsolidatedReport();
  }
}

// Target Verification Against Plan
function verifyTargetsInCurrentReport() {
  if (!state.reportData || !state.reportData.items || !state.planItems || state.planItems.length === 0) {
    return 0;
  }

  let mismatchCount = 0;
  const activeMonth = state.month;

  state.reportData.items.forEach(item => {
    const isSubProg = isSubProgramRow(item.no) || item.isSubProgram;
    let planMatch = null;

    if (isSubProg) {
      const cNo = cleanKhmer(item.no);
      planMatch = state.planItems.find(p => cleanKhmer(p.no) === cNo);
    } else {
      const cIndicator = cleanKhmer(item.indicator);
      const cActivity = cleanKhmer(item.activity);
      const cUnit = cleanKhmer(item.unit);
      const cVer = cleanKhmer(item.verification);

      if (cIndicator && cUnit) {
        planMatch = state.planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator && cleanKhmer(p.unit) === cUnit);
      }
      if (!planMatch && cIndicator && cVer) {
        planMatch = state.planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator && cleanKhmer(p.verification) === cVer);
      }
      if (!planMatch && cIndicator) {
        planMatch = state.planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator);
      }
      if (!planMatch && cActivity) {
        planMatch = state.planItems.find(p => !p.isSubProgram && cleanKhmer(p.activity) === cActivity);
      }
      if (!planMatch && cIndicator) {
        planMatch = state.planItems.find(p => {
          if (p.isSubProgram) return false;
          const pInd = cleanKhmer(p.indicator);
          return pInd.includes(cIndicator.slice(0, 30)) || cIndicator.includes(pInd.slice(0, 30));
        });
      }
    }

    if (planMatch && planMatch.targets) {
      const official = (planMatch.targets[activeMonth] || '-').trim();
      const current = (item.target || '-').trim();
      item.planTarget = official;
      item.isTargetMismatch = cleanKhmer(official) !== cleanKhmer(current);
      if (item.isTargetMismatch) {
        mismatchCount++;
      }
    } else {
      item.planTarget = item.target || '-';
      item.isTargetMismatch = false;
    }
  });

  state.reportData.targetMismatchesCount = mismatchCount;

  if (state.viewMode === 'MONTHLY' && mismatchCount > 0) {
    elMismatchCountText.textContent = `មានចំនួន ${mismatchCount} សកម្មភាព`;
    const elMismatchPlanYearText = document.getElementById('mismatchPlanYearText');
    if (elMismatchPlanYearText) {
      const khmerYear = state.year === '2026' ? '២០២៦' : (state.year === '2027' ? '២០២៧' : state.year);
      elMismatchPlanYearText.textContent = `(ប្រព័ន្ធបានប្រៀបធៀបជាមួយផែនការសកម្មភាពឆ្នាំ${khmerYear} រួចរាល់)`;
    }
    elMismatchAlertBanner.classList.remove('hidden');
  } else {
    elMismatchAlertBanner.classList.add('hidden');
  }

  return mismatchCount;
}

// Fix Single Target to Match Plan
function fixTargetToPlan(itemId) {
  const item = getActiveItems().find(i => i.id === itemId);
  if (!item || !item.planTarget) return;

  item.target = item.planTarget;
  item.isTargetMismatch = false;
  verifyTargetsInCurrentReport();
  renderTable();
  markDirty();
  showToast(`បានកែចំណុចដៅទៅជា "${item.planTarget}" តាមផែនការ!`, 'success');
}

// Fix All Targets to Match Plan
function fixAllTargetsToPlan() {
  if (!state.reportData || !state.reportData.items) return;
  let fixed = 0;

  state.reportData.items.forEach(item => {
    if (item.isTargetMismatch && item.planTarget) {
      item.target = item.planTarget;
      item.isTargetMismatch = false;
      fixed++;
    }
  });

  verifyTargetsInCurrentReport();
  renderTable();
  markDirty();
  showToast(`បានកែតម្រូវចំណុចដៅចំនួន ${fixed} សកម្មភាព តាមផែនការផ្លូវការរួចរាល់!`, 'success');
}

// Handle DOCX File Import
async function handleDocxImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.docx')) {
    showToast('សូមជ្រើសរើសឯកសារ Word ដែលមានកន្ទុយ .docx ប៉ុណ្ណោះ', 'error');
    return;
  }

  showToast('កំពុងអាន និងផ្ទៀងផ្ទាត់ឯកសារ Word ជាមួយផែនការ...', 'info');

  try {
    const res = await fetch(`/api/import/docx?year=${encodeURIComponent(state.year)}`, {
      method: 'POST',
      body: file
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'ការ Import បានបរាជ័យ');
    }

    const importedData = await res.json();
    if (!importedData.items || importedData.items.length === 0) {
      throw new Error('ពុំឃើញមានទិន្នន័យតារាងក្នុងឯកសារ Word នេះទេ');
    }

    switchMode('MONTHLY', false);

    // Reset filters to show full imported list
    state.filters = { office: 'ALL', status: 'ALL', program: 'ALL', search: '' };
    if (elSearchInput) elSearchInput.value = '';
    if (elFilterOffice) elFilterOffice.value = 'ALL';
    if (elFilterStatus) elFilterStatus.value = 'ALL';
    if (elFilterProgram) elFilterProgram.value = 'ALL';

    const targetYear = elYearSelect.value || state.year || (importedData.year ? String(importedData.year) : '2026');
    state.year = targetYear;
    importedData.year = parseInt(targetYear, 10);
    elYearSelect.value = state.year;
    updateSyncPlanButtonText();
    await loadActionPlan(state.year);
    if (importedData.month) {
      state.month = importedData.month;
      const mIdx = MONTH_NAMES.indexOf(importedData.month);
      state.monthNum = mIdx >= 0 ? String(mIdx + 1).padStart(2, '0') : '01';
    }

    state.reportData = importedData;
    renderMonthTabs();
    
    const titleText = `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${state.month} ឆ្នាំ${state.year}`;
    elReportHeaderTitle.textContent = titleText;
    elPrintTitle.textContent = titleText;
    elThMonthTarget.textContent = `ចំណុចដៅខែ${state.month}`;

    const mismatches = verifyTargetsInCurrentReport();
    renderTable();
    updateKpiDashboard();
    markDirty();


    if (mismatches > 0) {
      showToast(`បាន Import ជោគជ័យ! ⚠️ រកឃើញ ${mismatches} សកម្មភាពដែលបុគ្គលិកដៅខុសពីផែនការ!`, 'warning');
    } else {
      showToast(`បាន Import ឯកសារ Word ជោគជ័យ! ចំណុចដៅទាំងអស់ត្រឹមត្រូវតាមផែនការ។`, 'success');
    }

  } catch (err) {
    console.error('Import error:', err);
    showToast(`បញ្ហា Import៖ ${err.message}`, 'error');
  }
}

// Toggle Fullscreen mode
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Load Action Plan
async function loadActionPlan(year) {
  const targetYear = year || state.year || '2027';
  try {
    const res = await fetch(`/api/plan?year=${targetYear}`);
    if (res.ok) {
      state.planItems = await res.json();
    }
  } catch (err) {
    console.error('Failed to load action plan:', err);
  }
}

// Fetch list of saved reports
async function fetchAvailableReportsList() {
  try {
    const res = await fetch('/api/reports');
    if (res.ok) {
      state.availableReports = await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch reports list:', err);
  }
}

// Render 12 Months Tabs
function renderMonthTabs() {
  elMonthTabsContainer.innerHTML = '';
  
  MONTH_NAMES.forEach((mName, idx) => {
    const mNum = String(idx + 1).padStart(2, '0');
    const isSelected = (state.month === mName);
    
    const hasReport = state.availableReports.some(r => 
      String(r.year) === String(state.year) && (r.month === mName || r.monthNum === mNum)
    );

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
      isSelected 
        ? 'bg-brand-500 text-white shadow-sm' 
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
    }`;
    
    btn.innerHTML = `
      <span>${mName}</span>
      ${hasReport ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
    `;

    btn.addEventListener('click', async () => {
      if (state.isDirty && state.viewMode === 'MONTHLY') {
    
      }
      state.month = mName;
      state.monthNum = mNum;
      renderMonthTabs();
      await loadCurrentReport();
    });

    elMonthTabsContainer.appendChild(btn);
  });
}

// Load Report for Current Year & Month
async function loadCurrentReport() {
  showIndicator('កំពុងផ្ទុកទិន្នន័យ...');
  const titleText = `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${state.month} ឆ្នាំ${state.year}`;
  elReportHeaderTitle.textContent = titleText;
  elPrintTitle.textContent = titleText;
  elThMonthTarget.textContent = `ចំណុចដៅខែ${state.month}`;

  try {
    const res = await fetch(`/api/report/${state.year}/${encodeURIComponent(state.month)}`);
    if (res.ok) {
      state.reportData = await res.json();
      state.isDirty = false;
      showIndicator('<i class="fa-regular fa-clock"></i> បានរក្សាទុក');
      verifyTargetsInCurrentReport();
      renderTable();
      updateKpiDashboard();
      return;
    }
  } catch (e) {
    console.warn('Server fetch failed, falling back to localStorage or Action Plan:', e);
  }

  const localKey = `report_${state.year}_${state.monthNum}`;
  const localData = localStorage.getItem(localKey);
  if (localData) {
    try {
      state.reportData = JSON.parse(localData);
      verifyTargetsInCurrentReport();
      renderTable();
      updateKpiDashboard();
      showIndicator('ផ្ទុកពី Local Storage');
      return;
    } catch(err) {}
  }

  createDefaultReportFromPlan();
  verifyTargetsInCurrentReport();
  renderTable();
  updateKpiDashboard();
}

// Load Consolidated Report
async function loadConsolidatedReport() {
  showIndicator('កំពុងបូកសរុបទិន្នន័យតាមចន្លោះខែ...');
  const fromName = MONTH_NAMES[state.fromMonthIdx];
  const toName = MONTH_NAMES[state.toMonthIdx];

  const titleText = `តារាងសម្រង់របាយការណ៍បូកសរុបវឌ្ឍនភាពចាប់ពីខែ${fromName} ដល់ខែ${toName} ឆ្នាំ${state.year}`;
  elReportHeaderTitle.textContent = titleText;
  elPrintTitle.textContent = titleText;
  elThMonthTarget.textContent = `ចំណុចដៅ (${fromName}-${toName})`;

  try {
    const res = await fetch(`/api/consolidate/${state.year}?from=${state.fromMonthIdx}&to=${state.toMonthIdx}`);
    if (res.ok) {
      state.consolidatedData = await res.json();
      state.isDirty = false;
      showIndicator('<i class="fa-solid fa-layer-group text-indigo-600"></i> ទិន្នន័យបូកសរុប');
      renderTable();
      updateKpiDashboard();
      showToast(`បានបូកសរុបទិន្នន័យពីខែ${fromName} ដល់ ${toName} រួចរាល់!`, 'info');
      return;
    }
  } catch (e) {
    console.error('Consolidation fetch error:', e);
  }

  showToast('មានបញ្ហាក្នុងការទាញយកទិន្នន័យបូកសរុប', 'error');
}

function createDefaultReportFromPlan() {
  const items = state.planItems.map((p, idx) => {
    const target = (p.targets && p.targets[state.month]) ? p.targets[state.month].trim() : '-';
    const isInactive = target === '-' || !target;
    const isSubProg = isSubProgramRow(p.no) || p.isSubProgram;
    return {
      id: `rep_${idx + 1}`,
      program: p.program || '',
      activityGroup: p.activityGroup || '',
      no: p.no || '',
      activity: p.activity || '',
      indicator: isSubProg ? '' : (p.indicator || ''),
      verification: isSubProg ? '' : (p.verification || ''),
      unit: isSubProg ? '' : (p.unit || ''),
      target: target,
      planTarget: target,
      isTargetMismatch: false,
      isSubProgram: isSubProg,
      status: isSubProg ? '—' : (isInactive ? '-' : '៣'),
      progress: isSubProg ? '—' : (isInactive ? '-' : ''),
      progressPercent: isSubProg ? '—' : (isInactive ? '-' : ''),
      challenges: isSubProg ? '—' : '',
      solutions: isSubProg ? '—' : '',
      office: p.office || ''
    };
  });

  state.reportData = {
    year: Number(state.year),
    month: state.month,
    monthNum: state.monthNum,
    title: `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${state.month} ឆ្នាំ${state.year}`,
    department: 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន',
    items: items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.isDirty = true;
}

function getActiveReport() {
  return state.viewMode === 'CONSOLIDATED' ? state.consolidatedData : state.reportData;
}

function getActiveItems() {
  const rep = getActiveReport();
  return rep ? (rep.items || []) : [];
}

// Render Table
function renderTable() {
  const items = getActiveItems();
  if (items.length === 0) {
    elReportTableBody.innerHTML = `<tr><td colspan="13" class="text-center py-6 text-slate-400">គ្មានទិន្នន័យ</td></tr>`;
    return;
  }

  const filtered = items.filter(item => {
    if (state.filters.search) {
      const q = state.filters.search;
      const combined = `${item.activity || ''} ${item.indicator || ''} ${item.progress || ''} ${item.challenges || ''} ${item.office || ''}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    if (state.filters.office !== 'ALL') {
      if (!item.office || !item.office.includes(state.filters.office)) return false;
    }

    if (state.filters.status === 'MISMATCH') {
      if (!item.isTargetMismatch) return false;
    } else if (state.filters.status !== 'ALL') {
      if ((item.status || '-') !== state.filters.status) return false;
    }

    if (state.filters.program !== 'ALL') {
      const progNum = state.filters.program;
      if (!item.activityGroup || !item.activityGroup.startsWith(progNum)) {
        if (progNum === '១' && !item.activityGroup.includes('អភិវឌ្ឍ')) return false;
        if (progNum === '២' && !item.activityGroup.includes('មជ្ឈមណ្ឌល')) return false;
        if (progNum === '៣' && !item.activityGroup.includes('សុវត្ថិភាព')) return false;
        if (progNum === '៤' && !item.activityGroup.includes('អភិបាលកិច្ច')) return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    elReportTableBody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-slate-400 text-xs italic">ពុំមានទិន្នន័យស្របតាមលក្ខខណ្ឌតម្រង (Filter) នេះទេ</td></tr>`;
    return;
  }

  let html = '';
  let lastProgram = '';
  let lastActivityGroup = '';

  filtered.forEach((item, index) => {
    // Program Category Header Row
    if (item.program && item.program !== lastProgram) {
      html += `
        <tr class="tr-program-header">
          <td colspan="13" class="font-moul tracking-wide">
            <i class="fa-solid fa-folder-open mr-1.5 text-indigo-700"></i>
            ${escapeHtml(item.program)}
          </td>
        </tr>
      `;
      lastProgram = item.program;
      lastActivityGroup = '';
    }

    // Sub-activity Group Row
    if (item.activityGroup && item.activityGroup !== lastActivityGroup) {
      html += `
        <tr class="tr-activity-group">
          <td colspan="13" class="font-moul font-semibold">
            <i class="fa-solid fa-layer-group mr-1.5 text-emerald-700"></i>
            ${escapeHtml(item.activityGroup)}
          </td>
        </tr>
      `;
      lastActivityGroup = item.activityGroup;
    }

    const isSubProg = isSubProgramRow(item.no);

    // Status Badge Class
    let statusBadgeClass = 'badge-status-none';
    if (item.status === '៣') statusBadgeClass = 'badge-status-3';
    else if (item.status === '២') statusBadgeClass = 'badge-status-2';
    else if (item.status === '១') statusBadgeClass = 'badge-status-1';

    // Target Cell Rendering with Mismatch Warning & Quick-Fix
    let targetCellHtml = '';
    if (state.viewMode === 'MONTHLY' && item.isTargetMismatch) {
      targetCellHtml = `
        <td class="align-top text-center p-1 target-mismatch-cell" title="ដៅក្នុង Word៖ '${item.target}' | ផែនការផ្លូវការ៖ '${item.planTarget}'">
          <div class="text-[11px] font-bold text-rose-700">${escapeHtml(item.target || '-')}</div>
          <div class="text-[10px] text-slate-600 font-medium">ផែនការ៖ <span class="text-emerald-700 font-bold">${escapeHtml(item.planTarget || '-')}</span></div>
          <button class="target-fix-btn btn-single-fix" data-id="${item.id}" title="កែសម្រួលចំណុចដៅនេះឱ្យដូចផែនការ">
            <i class="fa-solid fa-wand-magic-sparkles"></i> កែតាមផែនការ
          </button>
        </td>
      `;
    } else {
      targetCellHtml = `
        <td class="align-top text-center font-semibold ${isSubProg ? 'text-brand-700 font-bold' : 'text-brand-600'} text-[11px] pt-2">
          ${escapeHtml(item.target || '-')}
        </td>
      `;
    }

    // Check if this row is a Sub-Program row (1.1-1.7, 2.1-2.2, 3.1-3.6, 4.1)
    // For these rows: columns 7 to 11 are NOT fillable!
    let progressColsHtml = '';
    if (isSubProg) {
      progressColsHtml = `
        <!-- 7. Status (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs font-semibold">—</td>

        <!-- 8. Progress (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs font-semibold">—</td>

        <!-- 9. Progress % (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs font-semibold">—</td>

        <!-- 10. Challenges (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs font-semibold">—</td>

        <!-- 11. Solutions (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs font-semibold">—</td>

        <!-- 12. Office -->
        <td class="align-top text-center text-[11px] font-bold text-slate-700 p-1 pt-2">
          ${escapeHtml(item.office || '-')}
        </td>

        <!-- 13. Actions (Disabled) -->
        <td class="bg-slate-100/70 text-slate-300 text-center select-none pt-2 text-xs no-print">—</td>
      `;
    } else {
      progressColsHtml = `
        <!-- 7. Status (Compact Select) -->
        <td class="align-top text-center p-1">
          <div class="flex items-center justify-center gap-1">
            <select class="status-select bg-transparent text-[11px] font-bold rounded px-1 py-0.5 border border-slate-300 outline-none cursor-pointer focus:ring-1 focus:ring-brand-500" data-field="status" data-id="${item.id}">
              <option value="៣" ${item.status === '៣' ? 'selected' : ''} class="text-emerald-700 font-bold">៣ (សម្រេច)</option>
              <option value="២" ${item.status === '២' ? 'selected' : ''} class="text-amber-700 font-bold">២ (កំពុងធ្វើ)</option>
              <option value="១" ${item.status === '១' ? 'selected' : ''} class="text-rose-700 font-bold">១ (យឺត)</option>
              <option value="-" ${item.status === '-' || !item.status ? 'selected' : ''} class="text-slate-500">- (គ្មាន)</option>
            </select>
            <span class="badge-status ${statusBadgeClass}">
              ${escapeHtml(item.status || '-')}
            </span>
          </div>
        </td>

        <!-- 8. Progress Achieved -->
        <td class="align-top p-1" title="ចុចត្រង់នេះដើម្បីកែសម្រួល">
          <textarea class="inline-input leading-relaxed" rows="${item.progress && item.progress.includes('\n') ? 3 : 2}" data-field="progress" data-id="${item.id}" placeholder="លទ្ធផលសម្រេច...">${escapeHtml(item.progress || '')}</textarea>
        </td>

        <!-- 9. Progress % -->
        <td class="align-top text-center p-1">
          <input type="text" class="inline-input text-center text-[11px] font-bold text-indigo-700" data-field="progressPercent" data-id="${item.id}" value="${escapeHtml(item.progressPercent || '')}" placeholder="%">
        </td>

        <!-- 10. Challenges (Inline Editable) -->
        <td class="align-top p-1">
          <textarea class="inline-input leading-relaxed" rows="${item.challenges && item.challenges.includes('\n') ? 2 : 1}" data-field="challenges" data-id="${item.id}" placeholder="បញ្ហាប្រឈម...">${escapeHtml(item.challenges || '')}</textarea>
        </td>

        <!-- 11. Solutions (Inline Editable) -->
        <td class="align-top p-1">
          <textarea class="inline-input leading-relaxed" rows="${item.solutions && item.solutions.includes('\n') ? 2 : 1}" data-field="solutions" data-id="${item.id}" placeholder="ដំណោះស្រាយ...">${escapeHtml(item.solutions || '')}</textarea>
        </td>

        <!-- 12. Office -->
        <td class="align-top text-center text-[11px] font-bold text-slate-700 p-1 pt-2">
          ${escapeHtml(item.office || '-')}
        </td>

        <!-- 13. Row Actions -->
        <td class="align-top text-center p-1 pt-2 no-print">
          <div class="flex items-center justify-center gap-0.5">
            <button class="btn-row-edit text-slate-400 hover:text-blue-600 p-0.5" title="កែសម្រួលលម្អិត" data-id="${item.id}">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button class="btn-row-delete text-slate-300 hover:text-rose-600 p-0.5" title="លុបជួរនេះ" data-id="${item.id}">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      `;
    }

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 ${isSubProg ? 'bg-slate-50/50' : ''}" data-id="${item.id}">
        <!-- 1. No -->
        <td class="text-center font-bold text-slate-600 align-top pt-2 font-moul text-[11px]">
          ${escapeHtml(item.no || (index + 1))}
        </td>

        <!-- 2. Activity -->
        <td class="align-top font-medium ${isSubProg ? 'font-bold text-slate-900' : 'text-slate-800'} leading-snug">
          ${escapeHtml(item.activity || '-')}
        </td>

        <!-- 3. Indicator -->
        <td class="align-top text-slate-700 leading-snug">
          ${isSubProg ? '<span class="text-slate-300 select-none">—</span>' : escapeHtml(item.indicator || '-')}
        </td>

        <!-- 4. Verification -->
        <td class="align-top text-center text-slate-600 text-[11px]">
          ${isSubProg ? '<span class="text-slate-300 select-none">—</span>' : escapeHtml(item.verification || '-')}
        </td>

        <!-- 5. Unit -->
        <td class="align-top text-center text-slate-600 text-[11px]">
          ${isSubProg ? '<span class="text-slate-300 select-none">—</span>' : escapeHtml(item.unit || '-')}
        </td>

        <!-- 6. Target (with Mismatch Diff Alert) -->
        ${targetCellHtml}

        <!-- 7-13. Progress, %, Challenges, Solutions, Office, Actions -->
        ${progressColsHtml}
      </tr>
    `;
  });

  elReportTableBody.innerHTML = html;
  bindTableEvents();
}

// Bind table interactive events
function bindTableEvents() {
  elReportTableBody.querySelectorAll('.btn-single-fix').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      fixTargetToPlan(id);
    });
  });

  elReportTableBody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const val = e.target.value;
      updateItemField(id, 'status', val);
      
      const item = getActiveItems().find(i => i.id === id);
      if (item && val === '៣' && (!item.progressPercent || item.progressPercent === '0')) {
        item.progressPercent = '១០០';
      }
      
      renderTable();
      updateKpiDashboard();
      markDirty();

    });
  });

  elReportTableBody.querySelectorAll('.inline-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const val = e.target.value;
      updateItemField(id, field, val);
      markDirty();

    });

    if (input.tagName === 'TEXTAREA') {
      input.addEventListener('focus', () => {
        if (input.rows < 4) input.rows = 4;
      });
      input.addEventListener('blur', () => {
        if (!input.value.trim() || input.value.length < 50) {
          input.rows = input.dataset.field === 'progress' ? 2 : 1;
        }
      });
    }
  });

  elReportTableBody.querySelectorAll('.btn-row-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openEditModal(id);
    });
  });

  elReportTableBody.querySelectorAll('.btn-row-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('តើលោកអ្នកពិតជាចង់លុបជួរនេះមែនទេ?')) {
        const rep = getActiveReport();
        if (rep && rep.items) {
          rep.items = rep.items.filter(i => i.id !== id);
          renderTable();
          updateKpiDashboard();
          markDirty();

          showToast('បានលុបជួរដោយជោគជ័យ!', 'info');
        }
      }
    });
  });
}

function updateItemField(id, field, value) {
  const items = getActiveItems();
  const item = items.find(i => i.id === id);
  if (item) {
    item[field] = value;
  }
}

function markDirty() {
  state.isDirty = true;
  showIndicator('<i class="fa-solid fa-pen-nib text-amber-500"></i> មានការកែប្រែ');
}

function showIndicator(html) {
  elSaveStatusIndicator.innerHTML = html;
}

// Update KPI Summary Dashboard (excludes sub-program header rows)
function updateKpiDashboard() {
  const items = getActiveItems();
  
  // Filter out sub-program header rows for accurate KPI
  const actionableItems = items.filter(i => !isSubProgramRow(i.no));

  let total = actionableItems.length;
  let count3 = 0;
  let count2 = 0;
  let count1 = 0;
  let countNone = 0;

  let totalNumericPercent = 0;
  let percentCount = 0;

  actionableItems.forEach(i => {
    const s = i.status || '-';
    if (s === '៣') count3++;
    else if (s === '២') count2++;
    else if (s === '១') count1++;
    else countNone++;

    let p = String(i.progressPercent || '').replace('%', '').trim();
    p = p.replace(/[០-៩]/g, d => '០១២៣៤៥៦៧៨៩'.indexOf(d));
    const num = parseFloat(p);
    if (!isNaN(num)) {
      totalNumericPercent += num;
      percentCount++;
    } else if (s === '៣') {
      totalNumericPercent += 100;
      percentCount++;
    }
  });

  const avgPercent = percentCount > 0 ? Math.round(totalNumericPercent / percentCount) : 0;

  elKpiTotal.textContent = total;
  elKpiStatus3.textContent = count3;
  elKpiStatus2.textContent = count2;
  elKpiStatus1.textContent = count1;
  elKpiStatusNone.textContent = countNone;

  elKpiPercentText.textContent = `${avgPercent}%`;
  elKpiProgressBar.style.width = `${Math.min(avgPercent, 100)}%`;
}

// Modal open & save
function openEditModal(id) {
  const items = getActiveItems();
  const item = items.find(i => i.id === id);
  if (!item) return;

  state.editingItemId = id;
  elModalSubTitle.textContent = `លេខរៀង៖ ${item.no || '-'}`;
  elModalActivityText.textContent = item.activity || '-';
  elModalIndicatorText.textContent = item.indicator || '-';

  elModalInputTarget.value = item.target || '';
  if (item.planTarget) {
    elModalPlanTargetHint.innerHTML = `ចំណុចដៅផ្លូវការក្នុងផែនការ៖ <strong class="text-emerald-700">${escapeHtml(item.planTarget)}</strong>`;
  } else {
    elModalPlanTargetHint.textContent = '';
  }

  elModalInputStatus.value = item.status || '-';
  elModalInputPercent.value = item.progressPercent || '';
  elModalInputProgress.value = item.progress || '';
  elModalInputChallenges.value = item.challenges || '';
  elModalInputSolutions.value = item.solutions || '';
  elModalInputOffice.value = item.office || '';

  // If sub-program row, disable progress inputs
  const isSubProg = isSubProgramRow(item.no);
  elModalInputStatus.disabled = isSubProg;
  elModalInputPercent.disabled = isSubProg;
  elModalInputProgress.disabled = isSubProg;
  elModalInputChallenges.disabled = isSubProg;
  elModalInputSolutions.disabled = isSubProg;

  elEditModal.classList.remove('hidden');
}

function closeModal() {
  elEditModal.classList.add('hidden');
  state.editingItemId = null;
}

function saveModal() {
  if (!state.editingItemId) return;
  const items = getActiveItems();
  const item = items.find(i => i.id === state.editingItemId);
  if (!item) return;

  const isSubProg = isSubProgramRow(item.no);
  item.target = elModalInputTarget.value;
  item.office = elModalInputOffice.value;

  if (!isSubProg) {
    item.status = elModalInputStatus.value;
    item.progressPercent = elModalInputPercent.value;
    item.progress = elModalInputProgress.value;
    item.challenges = elModalInputChallenges.value;
    item.solutions = elModalInputSolutions.value;
  }

  if (item.planTarget) {
    item.isTargetMismatch = cleanKhmer(item.target) !== cleanKhmer(item.planTarget);
  }

  closeModal();
  verifyTargetsInCurrentReport();
  renderTable();
  updateKpiDashboard();
  markDirty();
  showToast('បានកែប្រែដោយជោគជ័យ!', 'success');
}

// Add New Custom Row
function addNewRow() {
  const newId = `rep_custom_${Date.now()}`;
  const newItem = {
    id: newId,
    program: 'សកម្មភាពបន្ថែម',
    activityGroup: '',
    no: '',
    activity: 'សកម្មភាពថ្មី...',
    indicator: 'សូចនាករថ្មី...',
    verification: 'ឯកសារ',
    unit: 'អនុវត្ត',
    target: 'អនុវត្ត',
    status: '២',
    progress: '',
    progressPercent: '0',
    challenges: '',
    solutions: '',
    office: 'ការិ. អ.ក'
  };

  const rep = getActiveReport();
  if (rep && rep.items) {
    rep.items.push(newItem);
    renderTable();
    updateKpiDashboard();
    markDirty();

    openEditModal(newId);
    showToast('បានបន្ថែមជួរថ្មី!', 'info');
  }
}

// Save Report
async function saveReport(silent = false) {
  const report = getActiveReport();
  if (!report) return;

  report.year = Number(state.year);
  report.updatedAt = new Date().toISOString();

  if (state.viewMode === 'MONTHLY') {
    report.month = state.month;
    report.monthNum = state.monthNum;

    const localKey = `report_${state.year}_${state.monthNum}`;
    localStorage.setItem(localKey, JSON.stringify(report));

    try {
      const res = await fetch(`/api/report/${state.year}/${encodeURIComponent(state.month)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(report)
      });

      if (res.ok) {
        state.isDirty = false;
        showIndicator('<i class="fa-regular fa-clock"></i> បានរក្សាទុក');
        await fetchAvailableReportsList();
        renderMonthTabs();
        if (!silent) {
          showToast('បានរក្សាទុករបាយការណ៍ដោយជោគជ័យ!', 'success');
        }
        return;
      }
    } catch (err) {
      console.error('Save to server error:', err);
    }

    state.isDirty = false;
    showIndicator('<i class="fa-solid fa-cloud-arrow-up text-amber-500"></i> រក្សាទុកក្នុង Browser');
    if (!silent) {
      showToast('បានរក្សាទុកក្នុង Local Storage រួចរាល់!', 'success');
    }
  } else {
    const localKey = `consolidated_${state.year}_${state.fromMonthIdx}_${state.toMonthIdx}`;
    localStorage.setItem(localKey, JSON.stringify(report));
    state.isDirty = false;
    showIndicator('<i class="fa-solid fa-check text-emerald-600"></i> បានរក្សាទុក');
    if (!silent) {
      showToast('បានរក្សាទុករបាយការណ៍បូកសរុបរួចរាល់!', 'success');
    }
  }
}

// Sync with Action Plan
function syncWithActionPlan() {
  const khmerYear = state.year === '2026' ? '២០២៦' : (state.year === '2027' ? '២០២៧' : state.year);
  if (!confirm(`តើលោកអ្នកពិតជាចង់ទាញចំណុចដៅសម្រាប់ខែ "${state.month}" ពីផែនការសកម្មភាពឆ្នាំ${khmerYear} ចូលមកឡើងវិញមែនទេ?`)) {
    return;
  }

  const existingMap = new Map();
  if (state.reportData && state.reportData.items) {
    state.reportData.items.forEach(i => {
      const isSub = isSubProgramRow(i.no);
      const key = isSub ? `SUB_${cleanKhmer(i.no)}` : `${cleanKhmer(i.indicator)}_${cleanKhmer(i.activity)}`;
      existingMap.set(key, i);
    });
  }

  const newItems = state.planItems.map((p, idx) => {
    const isSubProg = isSubProgramRow(p.no) || p.isSubProgram;
    const key = isSubProg ? `SUB_${cleanKhmer(p.no)}` : `${cleanKhmer(p.indicator)}_${cleanKhmer(p.activity)}`;
    const existing = existingMap.get(key);
    const target = (p.targets && p.targets[state.month]) ? p.targets[state.month].trim() : '-';
    const isInactive = target === '-' || !target;

    return {
      id: `rep_${idx + 1}`,
      program: p.program || '',
      activityGroup: p.activityGroup || '',
      no: p.no || '',
      activity: p.activity || '',
      indicator: isSubProg ? '' : (p.indicator || ''),
      verification: isSubProg ? '' : (p.verification || ''),
      unit: isSubProg ? '' : (p.unit || ''),
      target: target,
      planTarget: target,
      isTargetMismatch: false,
      isSubProgram: isSubProg,
      status: isSubProg ? '—' : (existing && existing.status !== '—' ? existing.status : (isInactive ? '-' : '៣')),
      progress: isSubProg ? '—' : (existing && existing.progress !== '—' ? existing.progress : (isInactive ? '-' : '')),
      progressPercent: isSubProg ? '—' : (existing && existing.progressPercent !== '—' ? existing.progressPercent : (isInactive ? '-' : '')),
      challenges: isSubProg ? '—' : (existing && existing.challenges !== '—' ? existing.challenges : ''),
      solutions: isSubProg ? '—' : (existing && existing.solutions !== '—' ? existing.solutions : ''),
      office: p.office || ''
    };
  });

  state.reportData.items = newItems;
  verifyTargetsInCurrentReport();
  renderTable();
  updateKpiDashboard();
  markDirty();
  showToast(`បានធ្វើសមកាលកម្មជាមួយផែនការសកម្មភាពឆ្នាំ${khmerYear} រួចរាល់!`, 'success');
}

// Export Word DOCX
async function exportDocx() {
  const report = getActiveReport();
  if (!report) return;
  showToast('កំពុងរៀបចំបង្កើតឯកសារ Word (.docx)...', 'info');

  try {
    const res = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(report)
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = report.fromMonth && report.toMonth 
        ? `របាយការណ៍បូកសរុបវឌ្ឍនភាព_${report.fromMonth}_ដល់_${report.toMonth}_${report.year}.docx`
        : `របាយការណ៍វឌ្ឍនភាព_នាយកដ្ឋាន_បព_${report.month}_${report.year}.docx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('ទាញយកឯកសារ Word រួចរាល់!', 'success');
      return;
    }
  } catch (err) {
    console.error('Word export failed:', err);
  }

  showToast('មានបញ្ហាក្នុងការបង្កើតឯកសារ Word!', 'error');
}

// Export CSV / Excel
function exportCsv() {
  const report = getActiveReport();
  if (!report || !report.items) return;

  const targetCol = report.fromMonth && report.toMonth 
    ? `ចំណុចដៅ (${report.fromMonth}-${report.toMonth})`
    : `ចំណុចដៅខែ${report.month}`;

  const headers = [
    'ល.រ', 'សកម្មភាព', 'សូចនាករ', 'មធ្យោបាយផ្ទៀងផ្ទាត់', 'ឯកតា', 
    targetCol, 'ស្ថានភាព', 'វឌ្ឍនភាពសម្រេចបាន', 
    'វឌ្ឍនភាពធៀបសូចនាករ (%)', 'បញ្ហាប្រឈម/សំណូមពរ', 'ដំណោះស្រាយ', 'អង្គភាពប្រតិបត្តិ'
  ];

  const rows = report.items.map((i, idx) => {
    const isSubProg = isSubProgramRow(i.no);
    return [
      i.no || (idx + 1),
      `"${(i.activity || '').replace(/"/g, '""')}"`,
      `"${(i.indicator || '').replace(/"/g, '""')}"`,
      `"${(i.verification || '').replace(/"/g, '""')}"`,
      `"${(i.unit || '').replace(/"/g, '""')}"`,
      `"${(i.target || '').replace(/"/g, '""')}"`,
      `"${isSubProg ? '—' : (i.status || '')}"`,
      `"${isSubProg ? '—' : (i.progress || '').replace(/"/g, '""')}"`,
      `"${isSubProg ? '—' : (i.progressPercent || '')}"`,
      `"${isSubProg ? '—' : (i.challenges || '').replace(/"/g, '""')}"`,
      `"${isSubProg ? '—' : (i.solutions || '').replace(/"/g, '""')}"`,
      `"${(i.office || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = report.fromMonth && report.toMonth 
    ? `របាយការណ៍បូកសរុបវឌ្ឍនភាព_${report.fromMonth}_ដល់_${report.toMonth}_${report.year}.csv`
    : `របាយការណ៍វឌ្ឍនភាព_នាយកដ្ឋាន_បព_${report.month}_${report.year}.csv`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('ទាញយកឯកសារ CSV/Excel រួចរាល់!', 'success');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  else if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  else if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark"></i>';

  toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', initApp);
