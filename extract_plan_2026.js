const fs = require('fs');
const path = require('path');
const AdmZip = require(path.resolve(__dirname, 'node_modules/adm-zip'));

const docxPath = path.resolve(__dirname, 'នាយកដ្ឋាន_ប_ព_ផែនការសកម្មភាពឆ្នាំ២០២៦.docx');
if (!fs.existsSync(docxPath)) {
  console.error('File not found:', docxPath);
  process.exit(1);
}

const zip = new AdmZip(docxPath);
const docEntry = zip.getEntry('word/document.xml');
if (!docEntry) {
  console.error('word/document.xml not found in docx');
  process.exit(1);
}

const xml = docEntry.getData().toString('utf8');

function cleanXml(text) {
  const matches = text.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
}

const tableMatches = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
if (tableMatches.length === 0) {
  console.error('No tables found');
  process.exit(1);
}

const tbl = tableMatches[0];
const trMatches = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];

const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

let currentProgram = 'ការអភិវឌ្ឍន៍ការរគ្រប់គ្រងបច្ចេកវិទ្យាព័ត៌មាន';
let currentActivityGroup = '';
let currentSubActivity = null;

const items = [];
const vMerge18 = {};

trMatches.forEach((tr, trIdx) => {
  const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  const cells = tcs.map((tc, ci) => {
    let text = cleanXml(tc);
    const hasVMerge = tc.includes('w:vMerge');
    const isRestart = tc.includes('w:val="restart"');

    if (tcs.length === 18) {
      if (hasVMerge && !isRestart) {
        text = vMerge18[ci] || '';
      } else {
        vMerge18[ci] = text;
      }
    }
    return text;
  });

  // Skip table header rows
  if (trIdx === 0 || trIdx === 1) return;

  // Single cell: Program Category
  if (cells.length === 1) {
    if (cells[0]) currentProgram = cells[0];
    return;
  }

  // 2 cells: Activity Group Header
  if (cells.length === 2) {
    if (cells[0] || cells[1]) {
      currentActivityGroup = (cells[0] + ' ' + cells[1]).trim();
      currentSubActivity = null;
    }
    return;
  }

  // 15-cell row: Sub-program
  if (cells.length === 15) {
    const no = cells[0] || '';
    const activityTitle = cells[1] || '';
    const targets = {};
    months.forEach((m, mIdx) => {
      targets[m] = cells[2 + mIdx] || '';
    });

    let office = cells[14] || '';
    if (!office) {
      if (no.startsWith('១')) office = 'ការិ. អ.ក';
      else if (no.startsWith('២')) office = 'ការិ. គ.ស.ប';
      else if (no.startsWith('៣')) office = 'ការិ. ស.ប.ព';
      else if (no.startsWith('៤')) office = 'ន ប.ព';
    }

    currentSubActivity = { no, title: activityTitle, office };

    items.push({
      id: `item_${items.length + 1}`,
      program: currentProgram,
      activityGroup: currentActivityGroup,
      subProgramNo: no,
      isSubProgram: true,
      no: no,
      activity: activityTitle,
      indicator: '',
      verification: '',
      unit: '',
      baseline: '',
      targets: targets,
      office: office
    });
    return;
  }

  // 18-cell row: Detailed indicator row
  if (cells.length === 18) {
    const no = cells[0] || '';
    const activityText = cells[1] || '';
    const indicator = cells[2] || '';
    const unit = cells[3] || '';
    const baseline = cells[4] || '';

    const targets = {};
    months.forEach((m, mIdx) => {
      targets[m] = cells[5 + mIdx] || '';
    });

    let office = cells[17] || '';
    if (!office && currentSubActivity) {
      office = currentSubActivity.office;
    }
    if (!office) {
      if (currentActivityGroup.includes('១')) office = 'ការិ. អ.ក';
      else if (currentActivityGroup.includes('២')) office = 'ការិ. គ.ស.ប';
      else if (currentActivityGroup.includes('៣')) office = 'ការិ. ស.ប.ព';
      else office = 'ន ប.ព';
    }

    if (!indicator && !activityText && !no && !unit && !baseline) return;

    items.push({
      id: `item_${items.length + 1}`,
      program: currentProgram,
      activityGroup: currentActivityGroup,
      subProgramNo: currentSubActivity ? currentSubActivity.no : '',
      isSubProgram: false,
      no: no,
      activity: activityText || (currentSubActivity ? currentSubActivity.title : ''),
      indicator: indicator,
      verification: '',
      unit: unit,
      baseline: baseline,
      targets: targets,
      office: office
    });
    return;
  }
});

console.log('Total extracted items from 2026 plan:', items.length);
console.log('Sub-programs count:', items.filter(i => i.isSubProgram).length);
console.log('Detailed indicators count:', items.filter(i => !i.isSubProgram).length);

const outDataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(outDataDir)) fs.mkdirSync(outDataDir);
const outPath = path.resolve(outDataDir, 'action_plan_2026.json');
fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');
console.log('Successfully saved cleaned 2026 Action Plan to', outPath);
