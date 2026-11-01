const fs = require('fs');
const path = require('path');

const xmlPlan = fs.readFileSync('temp_plan/word/document.xml', 'utf8');

function cleanXml(text) {
  const matches = text.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
}

const tableMatches = xmlPlan.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
const tbl = tableMatches[0];
const trMatches = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];

const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

let currentProgram = 'ការអភិវឌ្ឍន៍ការរគ្រប់គ្រងបច្ចេកវិទ្យាព័ត៌មាន';
let currentActivityGroup = '';
let currentSubActivity = null;

const items = [];
const vMerge19 = {};

trMatches.forEach((tr, trIdx) => {
  const tcs = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  const cells = tcs.map((tc, ci) => {
    let text = cleanXml(tc);
    const hasVMerge = tc.includes('w:vMerge');
    const isRestart = tc.includes('w:val="restart"');

    if (tcs.length === 19) {
      if (hasVMerge && !isRestart) {
        text = vMerge19[ci] || '';
      } else {
        vMerge19[ci] = text;
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
    }
    return;
  }

  // 15-cell row: Sub-program (1.1 - 1.7, 2.1 - 2.2, 3.1 - 3.6, 4.1)
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

  // 19-cell row: Detailed indicator row
  if (cells.length === 19) {
    const no = cells[0] || '';
    const activityText = cells[1] || '';
    const indicator = cells[2] || '';
    const verification = cells[3] || '';
    const unit = cells[4] || '';
    const baseline = cells[5] || '';

    const targets = {};
    months.forEach((m, mIdx) => {
      targets[m] = cells[6 + mIdx] || '';
    });

    let office = cells[18] || '';
    if (!office && currentSubActivity) {
      office = currentSubActivity.office;
    }

    // Skip empty trailing rows
    if (!indicator && !activityText && !no && !unit && !verification) return;

    items.push({
      id: `item_${items.length + 1}`,
      program: currentProgram,
      activityGroup: currentActivityGroup,
      subProgramNo: currentSubActivity ? currentSubActivity.no : '',
      isSubProgram: false,
      no: no,
      activity: activityText || (currentSubActivity ? currentSubActivity.title : ''),
      indicator: indicator,
      verification: verification,
      unit: unit,
      baseline: baseline,
      targets: targets,
      office: office
    });
    return;
  }
});

console.log('Total extracted items from plan:', items.length);
console.log('Sub-programs count:', items.filter(i => i.isSubProgram).length);
console.log('Detailed indicators count:', items.filter(i => !i.isSubProgram).length);

if (!fs.existsSync('data')) fs.mkdirSync('data');
fs.writeFileSync('data/action_plan_2027.json', JSON.stringify(items, null, 2), 'utf8');
console.log('Successfully saved cleaned 2027 Action Plan to data/action_plan_2027.json');
