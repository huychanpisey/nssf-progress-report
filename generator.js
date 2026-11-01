const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isSubProgramRow(no) {
  if (!no) return false;
  return /^[១-៤1-4]\.[១-៩1-9]/.test(no.trim());
}

function buildCellXml(text, widthPct, options = {}) {
  const {
    bold = false,
    align = 'center',
    font = 'Khmer OS Siemreap',
    gridSpan = null,
    vMerge = null,
    shdColor = null
  } = options;

  let spanXml = gridSpan ? `<w:gridSpan w:val="${gridSpan}"/>` : '';
  let mergeXml = vMerge ? `<w:vMerge w:val="${vMerge}"/>` : '';
  let jcXml = align ? `<w:jc w:val="${align}"/>` : '';
  let shdXml = shdColor ? `<w:shd w:val="clear" w:color="auto" w:fill="${shdColor}"/>` : '';

  let fontXml = font === 'Khmer OS Muol Light' 
    ? `<w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>`
    : `<w:rFonts w:ascii="Khmer OS Siemreap" w:eastAsia="Times New Roman" w:hAnsi="Khmer OS Siemreap" w:cs="Khmer OS Siemreap" w:hint="cs"/>`;

  const lines = String(text || '').split(/\r?\n/);
  const pList = lines.map(line => `
    <w:p>
      <w:pPr>
        ${jcXml}
        <w:rPr>
          ${fontXml}
          <w:sz w:val="16"/>
          <w:szCs w:val="16"/>
          <w:cs/>
          ${bold ? '<w:b/><w:bCs/>' : ''}
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          ${fontXml}
          <w:sz w:val="16"/>
          <w:szCs w:val="16"/>
          <w:cs/>
          ${bold ? '<w:b/><w:bCs/>' : ''}
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(line)}</w:t>
      </w:r>
    </w:p>
  `).join('');

  return `
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthPct}" w:type="pct"/>
        ${spanXml}
        ${mergeXml}
        ${shdXml}
        <w:vAlign w:val="center"/>
      </w:tcPr>
      ${pList || '<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>'}
    </w:tc>
  `;
}

function buildCategoryRowXml(title) {
  return `
    <w:tr>
      <w:trPr><w:trHeight w:val="441"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:gridSpan w:val="12"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
            <w:t>${escapeXml(title)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `;
}

function buildActivityGroupRowXml(no, title) {
  return `
    <w:tr>
      <w:trPr><w:trHeight w:val="441"/></w:trPr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="170" w:type="pct"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
            <w:t>${escapeXml(no)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="4830" w:type="pct"/>
          <w:gridSpan w:val="11"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Khmer OS Muol Light" w:hAnsi="Khmer OS Muol Light" w:cs="Khmer OS Muol Light" w:hint="cs"/>
              <w:sz w:val="16"/>
              <w:szCs w:val="16"/>
              <w:cs/>
            </w:rPr>
            <w:t>${escapeXml(title)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  `;
}

function buildItemRowXml(item) {
  const isSubProg = isSubProgramRow(item.no) || item.isSubProgram;

  const c0 = buildCellXml(item.no || '', '170', { align: 'center', font: 'Khmer OS Muol Light' });
  const c1 = buildCellXml(item.activity || '', '777', { align: 'left', bold: isSubProg });
  const c2 = buildCellXml(isSubProg ? '—' : (item.indicator || ''), '922', { align: 'left' });
  const c3 = buildCellXml(isSubProg ? '—' : (item.verification || ''), '379', { align: 'center' });
  const c4 = buildCellXml(isSubProg ? '—' : (item.unit || ''), '226', { align: 'center' });
  const c5 = buildCellXml(item.target || '', '258', { align: 'center' });

  // For sub-program rows (1.1 to 1.7, 2.1-2.2, 3.1-3.6, 4.1), columns 6 to 10 are shaded dashes
  const c6 = buildCellXml(isSubProg ? '—' : (item.status || '-'), '235', { align: 'center', shdColor: isSubProg ? 'F1F5F9' : null });
  const c7 = buildCellXml(isSubProg ? '—' : (item.progress || ''), '820', { align: 'left', shdColor: isSubProg ? 'F1F5F9' : null });
  const c8 = buildCellXml(isSubProg ? '—' : (item.progressPercent ? `${item.progressPercent}%` : ''), '337', { align: 'center', shdColor: isSubProg ? 'F1F5F9' : null });
  const c9 = buildCellXml(isSubProg ? '—' : (item.challenges || ''), '385', { align: 'left', shdColor: isSubProg ? 'F1F5F9' : null });
  const c10 = buildCellXml(isSubProg ? '—' : (item.solutions || ''), '379', { align: 'left', shdColor: isSubProg ? 'F1F5F9' : null });
  const c11 = buildCellXml(item.office || '', '312', { align: 'center', font: 'Khmer OS Muol Light' });

  return `
    <w:tr>
      <w:trPr><w:trHeight w:val="600"/></w:trPr>
      ${c0}${c1}${c2}${c3}${c4}${c5}${c6}${c7}${c8}${c9}${c10}${c11}
    </w:tr>
  `;
}

function generateDocxReport(reportData, outputPath) {
  const templatePath = path.resolve(__dirname, 'template.docx');
  const zip = new AdmZip(templatePath);

  let xml = zip.readAsText('word/document.xml');

  const yearName = reportData.year || '២០២៧';
  let newTitle = '';
  let targetColHeader = '';

  if (reportData.fromMonth && reportData.toMonth) {
    newTitle = `តារាងសម្រង់របាយការណ៍បូកសរុបវឌ្ឍនភាពចាប់ពីខែ${reportData.fromMonth} ដល់ខែ${reportData.toMonth} ឆ្នាំ${yearName}`;
    targetColHeader = `ចំណុចដៅ (${reportData.fromMonth}-${reportData.toMonth})`;
  } else {
    const monthName = reportData.month || 'កញ្ញា';
    newTitle = `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${monthName} ឆ្នាំ${yearName}`;
    targetColHeader = `ចំណុចដៅខែ${monthName}`;
  }

  xml = xml.replace(/តារាងគម្រូរបាយការណ៍វឌ្ឍនភាពប្រចាំខែកញ្ញា ឆ្នាំ២០២៦/g, newTitle);
  xml = xml.replace(/តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ[^\s<]+ ឆ្នាំ[^\s<]+/g, newTitle);
  xml = xml.replace(/តារាងសម្រង់របាយការណ៍បូកសរុបវឌ្ឍនភាព[^\s<]+ ដល់ខែ[^\s<]+ ឆ្នាំ[^\s<]+/g, newTitle);

  xml = xml.replace(/ចំណុចដៅខែកញ្ញា/g, targetColHeader);
  xml = xml.replace(/ចំណុចដៅខែ\s*<w:t>កញ្ញា<\/w:t>/g, `<w:t>${targetColHeader}</w:t>`);

  let rowsXml = '';
  let lastProgram = '';
  let lastActivityGroup = '';

  const items = reportData.items || [];
  for (const item of items) {
    if (item.program && item.program !== lastProgram) {
      rowsXml += buildCategoryRowXml(item.program);
      lastProgram = item.program;
      lastActivityGroup = '';
    }

    if (item.activityGroup && item.activityGroup !== lastActivityGroup) {
      const match = item.activityGroup.match(/^([១២៣៤៥៦៧៨៩\d\.]+)\s*(.*)$/);
      if (match) {
        rowsXml += buildActivityGroupRowXml(match[1], match[2]);
      } else {
        rowsXml += buildActivityGroupRowXml('', item.activityGroup);
      }
      lastActivityGroup = item.activityGroup;
    }

    rowsXml += buildItemRowXml(item);
  }

  const tblStart = xml.indexOf('<w:tbl>');
  const tblEnd = xml.indexOf('</w:tbl>') + 8;
  const tblContent = xml.substring(tblStart, tblEnd);

  const headerTrEnd = tblContent.indexOf('</w:tr>') + 7;
  const tableHeaderPart = tblContent.substring(0, headerTrEnd);

  const newTableXml = tableHeaderPart + rowsXml + '</w:tbl>';
  xml = xml.substring(0, tblStart) + newTableXml + xml.substring(tblEnd);

  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));

  if (outputPath) {
    zip.writeZip(outputPath);
    return outputPath;
  }

  return zip.toBuffer();
}

module.exports = { generateDocxReport };
