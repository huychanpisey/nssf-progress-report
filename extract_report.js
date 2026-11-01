const fs = require('fs');

const xmlReport = fs.readFileSync('temp_docx/word/document.xml', 'utf8');

function cleanXml(text) {
  const matches = text.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
}

const tableMatches = xmlReport.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
const tbl = tableMatches[0];
const trMatches = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];

const rows = trMatches.map(tr => {
  const tcMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  return tcMatches.map(tc => cleanXml(tc));
});

console.log('Total report rows:', rows.length);
console.log('Header:', rows[0]);

const reportItems = [];
let currentProgram = '';
let currentActivityGroup = '';

rows.slice(1).forEach((r, idx) => {
  const nonEmpties = r.filter(c => c && c.trim().length > 0);
  if (nonEmpties.length === 0) return;

  if (r.length === 1 || (r[0] && !r[2] && !r[3])) {
    const text = r.filter(Boolean).join(' ').trim();
    if (r[0] && /^[១២៣៤៥៦៧៨៩\d]/.test(r[0])) {
      currentActivityGroup = `${r[0]} ${r[1] || ''}`.trim();
    } else {
      currentProgram = text;
      currentActivityGroup = '';
    }
    return;
  }

  // Column mapping:
  // 0: ល.រ
  // 1: សកម្មភាព
  // 2: សូចនាករ
  // 3: មធ្យោបាយវាស់វែង
  // 4: ឯកតា
  // 5: ចំណុចដៅខែ...
  // 6: ស្ថានភាព
  // 7: វឌ្ឍនភាពសម្រេចបាន
  // 8: វឌ្ឍនភាពធៀបសូចនាករ (%)
  // 9: បញ្ហាប្រឈម/សំណូមពរ
  // 10: ដំណោះស្រាយ
  // 11: អង្គភាពប្រតិបត្តិ

  reportItems.push({
    id: `rep_${reportItems.length + 1}`,
    program: currentProgram,
    activityGroup: currentActivityGroup,
    no: r[0] || '',
    activity: r[1] || '',
    indicator: r[2] || '',
    verification: r[3] || '',
    unit: r[4] || '',
    target: r[5] || '',
    status: r[6] || '-',
    progress: r[7] || '',
    progressPercent: r[8] || '',
    challenges: r[9] || '',
    solutions: r[10] || '',
    office: r[11] || ''
  });
});

console.log('Parsed items:', reportItems.length);
console.log('Sample item 1:', reportItems[0]);
console.log('Sample item with status 1:', reportItems.find(i => i.status === '១'));

if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync('data/reports')) fs.mkdirSync('data/reports');

const reportData = {
  year: 2026,
  month: 'កញ្ញា',
  monthNum: '09',
  title: 'តារាងគម្រូរបាយការណ៍វឌ្ឍនភាពប្រចាំខែកញ្ញា ឆ្នាំ២០២៦',
  department: 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន',
  items: reportItems,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync('data/reports/2026_09.json', JSON.stringify(reportData, null, 2), 'utf8');
console.log('Saved to data/reports/2026_09.json');
