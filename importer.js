const fs = require('fs');
const AdmZip = require('adm-zip');

function cleanXml(text) {
  const matches = text.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
}

function isSubProgramRow(no) {
  if (!no) return false;
  return /^[១-៤1-4]\.[១-៩1-9]/.test(no.trim());
}

const KHMER_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

function parseDocxFile(input) {
  let buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else {
    buffer = fs.readFileSync(input);
  }

  const zip = new AdmZip(buffer);
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) {
    throw new Error('ពុំមានឯកសារ word/document.xml ក្នុងឯកសារ Word នេះទេ');
  }

  const xml = docEntry.getData().toString('utf8');

  // Detect month from text
  let detectedMonth = 'កញ្ញា';
  let detectedYear = 2027;

  for (const m of KHMER_MONTHS) {
    if (xml.includes(`ខែ${m}`) || xml.includes(`ខែ ${m}`) || xml.includes(m)) {
      detectedMonth = m;
      break;
    }
  }

  // Detect year
  const yearMatch = xml.match(/ឆ្នាំ\s*([០-៩0-9]{4})/);
  if (yearMatch && yearMatch[1]) {
    let yStr = yearMatch[1];
    yStr = yStr.replace(/[០-៩]/g, d => '០១២៣៤៥៦៧៨៩'.indexOf(d));
    detectedYear = parseInt(yStr, 10);
  }

  // Extract Table
  const tableMatches = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  if (tableMatches.length === 0) {
    throw new Error('ពុំឃើញមានតារាងរបាយការណ៍ក្នុងឯកសារ Word នេះឡើយ');
  }

  const tbl = tableMatches[0];
  const trMatches = tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];

  const rows = trMatches.map(tr => {
    const tcMatches = tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
    return tcMatches.map(tc => cleanXml(tc));
  });

  const parsedItems = [];
  let currentProgram = '';
  let currentActivityGroup = '';

  rows.slice(1).forEach((r, idx) => {
    const nonEmpties = r.filter(c => c && c.trim().length > 0);
    if (nonEmpties.length === 0) return;

    // Program or Activity Group header rows (typically 1 or 2 cells spanning across)
    const isSubProg = isSubProgramRow(r[0]);
    if (r.length <= 3 && !isSubProg) {
      const text = r.filter(Boolean).join(' ').trim();
      if (r[0] && /^[១-៤1-4]/.test(r[0]) && !r[0].includes('.')) {
        currentActivityGroup = `${r[0]} ${r[1] || ''}`.trim();
      } else {
        currentProgram = text;
        currentActivityGroup = '';
      }
      return;
    }

    parsedItems.push({
      id: `rep_import_${parsedItems.length + 1}`,
      program: currentProgram,
      activityGroup: currentActivityGroup,
      no: r[0] || '',
      activity: r[1] || '',
      indicator: isSubProg ? '' : (r[2] || ''),
      verification: isSubProg ? '' : (r[3] || ''),
      unit: isSubProg ? '' : (r[4] || ''),
      target: r[5] || '',
      isSubProgram: isSubProg,
      status: isSubProg ? '—' : (r[6] || '-'),
      progress: isSubProg ? '—' : (r[7] || ''),
      progressPercent: isSubProg ? '—' : (r[8] || '').replace('%', '').trim(),
      challenges: isSubProg ? '—' : (r[9] || ''),
      solutions: isSubProg ? '—' : (r[10] || ''),
      office: r[11] || ''
    });
  });

  return {
    success: true,
    year: detectedYear,
    month: detectedMonth,
    title: `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${detectedMonth} ឆ្នាំ${detectedYear}`,
    department: 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន',
    items: parsedItems
  };
}

module.exports = { parseDocxFile };
