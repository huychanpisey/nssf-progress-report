// Khmer Monthly Progress Monitoring & Reporting App - Server
// Department of Information Technology - NSSF
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { generateDocxReport } = require('./generator');
const { parseDocxFile } = require('./importer');

let PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const DATA_DIR = path.resolve(__dirname, 'data');
const REPORTS_DIR = path.resolve(DATA_DIR, 'reports');
const PLAN_PATH = path.resolve(DATA_DIR, 'action_plan_2027.json');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR);
} catch (e) {}

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kcqhvsdqscaqvizzuptf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcWh2c2Rxc2NhcXZpenp1cHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NzAyMjYsImV4cCI6MjEwODU0NjIyNn0.FXfwhCGWqlOmPByVfiut1r4MoaJkkd2Nq5rI9VcrRvQ';

const MONTH_NAMES = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

function cleanKhmer(str) {
  if (!str) return '';
  return str
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function isSubProgramRow(no) {
  if (!no) return false;
  return /^[១-៤1-4]\.[១-៩1-9]/.test(no.trim());
}

function getMonthIndex(name) {
  return MONTH_NAMES.indexOf(name);
}

function getMonthName(idx) {
  return MONTH_NAMES[idx] || '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function escapeTelegramHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(token, chatId, text, parseMode = 'HTML') {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram sendMessage error:', err);
    }
  } catch(e) {
    console.error('Error sending Telegram message:', e);
  }
}

function getPlanItems(year = '2027') {
  const yStr = String(year || '2027');
  const specificPath = path.resolve(DATA_DIR, `action_plan_${yStr}.json`);
  if (fs.existsSync(specificPath)) {
    return JSON.parse(fs.readFileSync(specificPath, 'utf8'));
  }
  if (fs.existsSync(PLAN_PATH)) {
    return JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  }
  return [];
}

async function getPlanFromDb(year = '2027') {
  const yStr = String(year || '2027');
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nssf_action_plan?id=eq.${yStr}&select=items`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].items) {
          return rows[0].items;
        }
      }
    } catch(e) {
      console.warn(`Supabase getPlan error for year ${yStr}, falling back to local file:`, e.message);
    }
  }
  return getPlanItems(yStr);
}

async function getReportFromDb(year, monthNum, monthName) {
  const id = `${year}_${monthNum}`;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nssf_reports?id=eq.${id}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            year: r.year,
            month: r.month,
            monthNum: r.month_num,
            title: r.title,
            department: r.department,
            items: r.items,
            updatedAt: r.updated_at
          };
        }
      }
    } catch(e) {
      console.warn('Supabase getReport error, falling back to local file:', e.message);
    }
  }

  // Fallback to local files
  const file1 = path.join(REPORTS_DIR, `${year}_${monthNum}.json`);
  const file2 = path.join(REPORTS_DIR, `${monthNum}_${year}.json`);
  if (fs.existsSync(file1)) return JSON.parse(fs.readFileSync(file1, 'utf8'));
  if (fs.existsSync(file2)) return JSON.parse(fs.readFileSync(file2, 'utf8'));
  return createDefaultReportForMonth(year, monthName);
}

async function saveReportToDb(data) {
  const id = `${data.year}_${data.monthNum}`;
  const payload = {
    id: id,
    year: Number(data.year),
    month: data.month,
    month_num: data.monthNum,
    title: data.title,
    department: data.department,
    items: data.items || [],
    updated_at: new Date().toISOString()
  };

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/nssf_reports`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
    } catch(e) {
      console.warn('Supabase saveReport error:', e.message);
    }
  }

  try {
    const filePath = path.join(REPORTS_DIR, `${data.year}_${data.monthNum}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch(e) {}
}

async function listReportsFromDb() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nssf_reports?select=id,year,month,month_num,title,updated_at,items`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const rows = await res.json();
        return rows.map(r => ({
          filename: `${r.id}.json`,
          year: r.year,
          month: r.month,
          monthNum: r.month_num,
          title: r.title,
          updatedAt: r.updated_at,
          itemsCount: (r.items || []).length
        }));
      }
    } catch(e) {
      console.warn('Supabase listReports error, fallback to local files:', e.message);
    }
  }

  if (fs.existsSync(REPORTS_DIR)) {
    const files = fs.readdirSync(REPORTS_DIR).filter(f => /^\d{4}_\d{2}\.json$/.test(f));
    return files.map(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
        return {
          filename: f,
          year: content.year,
          month: content.month,
          monthNum: content.monthNum,
          title: content.title,
          updatedAt: content.updatedAt,
          itemsCount: (content.items || []).length
        };
      } catch(e) { return null; }
    }).filter(Boolean);
  }
  return [];
}

// Attach official target verification to report items
function verifyTargetsAgainstPlan(items, monthName, planList) {
  const planItems = planList || getPlanItems();
  let mismatchCount = 0;

  items.forEach(item => {
    const isSubProg = isSubProgramRow(item.no) || item.isSubProgram;
    let planMatch = null;

    if (isSubProg) {
      const cNo = cleanKhmer(item.no);
      planMatch = planItems.find(p => cleanKhmer(p.no) === cNo);
    } else {
      const cIndicator = cleanKhmer(item.indicator);
      const cActivity = cleanKhmer(item.activity);
      const cUnit = cleanKhmer(item.unit);
      const cVer = cleanKhmer(item.verification);

      if (cIndicator && cUnit) {
        planMatch = planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator && cleanKhmer(p.unit) === cUnit);
      }
      if (!planMatch && cIndicator && cVer) {
        planMatch = planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator && cleanKhmer(p.verification) === cVer);
      }
      if (!planMatch && cIndicator) {
        planMatch = planItems.find(p => !p.isSubProgram && cleanKhmer(p.indicator) === cIndicator);
      }
      if (!planMatch && cActivity) {
        planMatch = planItems.find(p => !p.isSubProgram && cleanKhmer(p.activity) === cActivity);
      }
      if (!planMatch && cIndicator) {
        planMatch = planItems.find(p => {
          if (p.isSubProgram) return false;
          const pInd = cleanKhmer(p.indicator);
          return pInd.includes(cIndicator.slice(0, 30)) || cIndicator.includes(pInd.slice(0, 30));
        });
      }
    }

    if (planMatch && planMatch.targets) {
      const official = (planMatch.targets[monthName] || '-').trim();
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

  return mismatchCount;
}

function createDefaultReportForMonth(year, monthName, planList) {
  const planItems = planList || getPlanItems();
  const mIdx = getMonthIndex(monthName);
  const monthNum = mIdx >= 0 ? pad2(mIdx + 1) : '01';

  const items = planItems.map((p, idx) => {
    const target = (p.targets && p.targets[monthName]) ? p.targets[monthName].trim() : '-';
    const isInactive = target === '-' || !target;
    const isSubProg = p.isSubProgram || isSubProgramRow(p.no);

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

  return {
    year: Number(year) || 2027,
    month: monthName,
    monthNum: monthNum,
    title: `តារាងសម្រង់របាយការណ៍វឌ្ឍនភាពប្រចាំខែ${monthName} ឆ្នាំ${year}`,
    department: 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន',
    items: items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Consolidate reports from Month A to Month B
async function consolidateReports(year, fromMonthIdx, toMonthIdx) {
  const planItems = await getPlanFromDb(year);
  const monthlyReports = [];

  for (let m = fromMonthIdx; m <= toMonthIdx; m++) {
    const mNum = String(m + 1).padStart(2, '0');
    const mName = MONTH_NAMES[m];
    const report = await getReportFromDb(year, mNum, mName);

    if (report && report.items) {
      monthlyReports.push({ month: mName, monthNum: mNum, items: report.items });
    }
  }

  const consolidatedItems = planItems.map((planItem, idx) => {
    const cIndicator = cleanKhmer(planItem.indicator);
    const cActivity = cleanKhmer(planItem.activity);
    const isSubProg = isSubProgramRow(planItem.no) || planItem.isSubProgram;

    const progressList = [];
    const challengesList = [];
    const solutionsList = [];
    const percents = [];
    let latestStatus = '-';

    monthlyReports.forEach(rep => {
      const matched = rep.items.find(i => 
        (cleanKhmer(i.indicator) && cleanKhmer(i.indicator) === cIndicator) ||
        (cleanKhmer(i.activity) && cleanKhmer(i.activity) === cActivity)
      );

      if (matched) {
        if (matched.progress && matched.progress.trim() && matched.progress !== '-' && matched.progress !== '—') {
          progressList.push(`• ខែ${rep.month}៖ ${matched.progress.trim()}`);
        }
        if (matched.challenges && matched.challenges.trim() && matched.challenges !== '-' && matched.challenges !== '—') {
          challengesList.push(`• ខែ${rep.month}៖ ${matched.challenges.trim()}`);
        }
        if (matched.solutions && matched.solutions.trim() && matched.solutions !== '-' && matched.solutions !== '—') {
          solutionsList.push(`• ខែ${rep.month}៖ ${matched.solutions.trim()}`);
        }
        if (matched.status && matched.status !== '-' && matched.status !== '—') {
          latestStatus = matched.status;
        }

        let p = String(matched.progressPercent || '').replace('%', '').trim();
        p = p.replace(/[០-៩]/g, d => '០១២៣៤៥៦៧៨៩'.indexOf(d));
        const num = parseFloat(p);
        if (!isNaN(num)) percents.push(num);
      }
    });

    const avgPercent = percents.length > 0 
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) 
      : (latestStatus === '៣' ? 100 : '');

    const fromTarget = (planItem.targets && planItem.targets[MONTH_NAMES[fromMonthIdx]]) ? planItem.targets[MONTH_NAMES[fromMonthIdx]] : '-';
    const toTarget = (planItem.targets && planItem.targets[MONTH_NAMES[toMonthIdx]]) ? planItem.targets[MONTH_NAMES[toMonthIdx]] : '-';
    const targetLabel = fromTarget === toTarget ? fromTarget : `${fromTarget} → ${toTarget}`;

    return {
      id: `consolidated_${idx + 1}`,
      program: planItem.program,
      activityGroup: planItem.activityGroup,
      no: planItem.no,
      activity: planItem.activity,
      indicator: isSubProg ? '' : planItem.indicator,
      verification: isSubProg ? '' : planItem.verification,
      unit: isSubProg ? '' : planItem.unit,
      target: targetLabel,
      isSubProgram: isSubProg,
      status: isSubProg ? '—' : latestStatus,
      progress: isSubProg ? '—' : progressList.join('\n'),
      progressPercent: isSubProg ? '—' : (avgPercent ? String(avgPercent) : ''),
      challenges: isSubProg ? '—' : challengesList.join('\n'),
      solutions: isSubProg ? '—' : solutionsList.join('\n'),
      office: planItem.office
    };
  });

  return {
    year: Number(year),
    fromMonth: MONTH_NAMES[fromMonthIdx],
    toMonth: MONTH_NAMES[toMonthIdx],
    fromMonthIdx,
    toMonthIdx,
    monthsCount: monthlyReports.length,
    title: `តារាងសម្រង់របាយការណ៍បូកសរុបវឌ្ឍនភាពចាប់ពីខែ${MONTH_NAMES[fromMonthIdx]} ដល់ខែ${MONTH_NAMES[toMonthIdx]} ឆ្នាំ${year}`,
    department: 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន',
    items: consolidatedItems
  };
}

function getRequestBody(req) {
  if (req.body) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try { return Promise.resolve(JSON.parse(req.body)); } catch(e) { return Promise.resolve(req.body); }
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    // 1. Get Plan: GET /api/plan
    if (pathname === '/api/plan' && req.method === 'GET') {
      const targetYear = (parsedUrl.query && parsedUrl.query.year) || '2027';
      const plan = await getPlanFromDb(targetYear);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(plan));
      return;
    }

    // 2. List Reports: GET /api/reports
    if (pathname === '/api/reports' && req.method === 'GET') {
      const reports = await listReportsFromDb();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(reports));
      return;
    }

    // 3. Consolidate Reports: GET /api/consolidate/:year?from=0&to=8
    const consolidateMatch = pathname.match(/^\/api\/consolidate\/(\d{4})$/);
    if (consolidateMatch && req.method === 'GET') {
      const year = consolidateMatch[1];
      const fromIdx = Math.max(0, parseInt(parsedUrl.query.from || 0, 10));
      const toIdx = Math.min(11, parseInt(parsedUrl.query.to || 11, 10));

      const consolidated = await consolidateReports(year, fromIdx, toIdx);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(consolidated));
      return;
    }

    // 4. Get Report: GET /api/report/:year/:month
    const reportGetMatch = pathname.match(/^\/api\/report\/(\d{4})\/([^\/]+)$/);
    if (reportGetMatch && req.method === 'GET') {
      const year = reportGetMatch[1];
      const monthParam = decodeURIComponent(reportGetMatch[2]);
      
      let monthName = monthParam;
      let monthNum = '01';
      if (/^\d{1,2}$/.test(monthParam)) {
        const mIdx = parseInt(monthParam, 10) - 1;
        monthName = getMonthName(mIdx);
        monthNum = pad2(mIdx + 1);
      } else {
        const mIdx = getMonthIndex(monthParam);
        monthNum = mIdx >= 0 ? pad2(mIdx + 1) : '01';
      }

      const reportData = await getReportFromDb(year, monthNum, monthName);
      const planItems = await getPlanFromDb(year);
      const mismatches = verifyTargetsAgainstPlan(reportData.items || [], monthName, planItems);
      reportData.targetMismatchesCount = mismatches;

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(reportData));
      return;
    }

    // 5. Save Report: POST /api/report/:year/:month
    if (reportGetMatch && req.method === 'POST') {
      const year = reportGetMatch[1];
      const monthParam = decodeURIComponent(reportGetMatch[2]);
      let monthName = monthParam;
      let monthNum = '01';
      if (/^\d{1,2}$/.test(monthParam)) {
        const mIdx = parseInt(monthParam, 10) - 1;
        monthName = getMonthName(mIdx);
        monthNum = pad2(mIdx + 1);
      } else {
        const mIdx = getMonthIndex(monthParam);
        monthNum = mIdx >= 0 ? pad2(mIdx + 1) : '01';
      }

      try {
        const rawBody = await getRequestBody(req);
        const data = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody) ? rawBody : JSON.parse(rawBody.toString('utf8'));
        data.updatedAt = new Date().toISOString();
        data.year = Number(year);
        data.month = monthName;
        data.monthNum = monthNum;

        await saveReportToDb(data);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'រក្សាទុកបានជោគជ័យ!', data }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 6. Export Word DOCX: POST /api/export/docx
    if (pathname === '/api/export/docx' && req.method === 'POST') {
      try {
        const rawBody = await getRequestBody(req);
        const reportData = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody) ? rawBody : JSON.parse(rawBody.toString('utf8'));

        const outName = reportData.fromMonth && reportData.toMonth 
          ? `របាយការណ៍បូកសរុបវឌ្ឍនភាព_${reportData.fromMonth}_ដល់_${reportData.toMonth}_${reportData.year}.docx`
          : `របាយការណ៍វឌ្ឍនភាព_នាយកដ្ឋាន_បព_${reportData.month}_${reportData.year}.docx`;

        const fileBuffer = generateDocxReport(reportData);

        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(outName)}`,
          'Content-Length': fileBuffer.length
        });
        res.end(fileBuffer);
      } catch (e) {
        console.error('Docx generation error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 7. Import Word DOCX: POST /api/import/docx
    if (pathname === '/api/import/docx' && req.method === 'POST') {
      try {
        const fileBuffer = await getRequestBody(req);
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('ពុំមានទិន្នន័យឯកសារត្រូវបានបញ្ជូនមកទេ');
        }

        const fallbackYear = (parsedUrl.query && parsedUrl.query.year) || '2026';
        const parsedResult = parseDocxFile(fileBuffer, fallbackYear);
        const planItems = await getPlanFromDb(parsedResult.year);
        const mismatches = verifyTargetsAgainstPlan(parsedResult.items || [], parsedResult.month, planItems);
        parsedResult.targetMismatchesCount = mismatches;

        // Auto persist imported report to Supabase
        await saveReportToDb(parsedResult);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(parsedResult));
      } catch (err) {
        console.error('Import docx error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message || 'ការអានឯកសារ Word បានបរាជ័យ' }));
      }
      return;
    }

    // 8. Telegram Bot Webhook: POST /api/telegram-webhook
    if (pathname === '/api/telegram-webhook' && req.method === 'POST') {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      try {
        const bodyData = await getRequestBody(req);
        const update = typeof bodyData === 'string' ? JSON.parse(bodyData) : (Buffer.isBuffer(bodyData) ? JSON.parse(bodyData.toString('utf8')) : bodyData);

        if (update && update.message) {
          const msg = update.message;
          const chatId = msg.chat.id;

          if (!TELEGRAM_BOT_TOKEN) {
            console.warn('TELEGRAM_BOT_TOKEN not configured');
          } else if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help'))) {
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, 
              `👋 <b>សូមស្វាគមន៍មកកាន់ប្រព័ន្ធរបាយការណ៍វឌ្ឍនភាព ប.ស.ស.!</b>\n\n` +
              `📥 សូមផ្ញើឯកសារ Word (<b>.docx</b>) នៃរបាយការណ៍វឌ្ឍនភាពប្រចាំខែមកកាន់ទីនេះ ប្រព័ន្ធនឹង Import និងផ្ទៀងផ្ទាត់ចំណុចដៅជាមួយផែនការសកម្មភាព (ឆ្នាំ២០២៦/២០២៧) ដោយស្វ័យប្រវត្ត។\n\n` +
              `✨ <b>មុខងារស្វ័យប្រវត្តិ៖</b>\n` +
              `• អានទិន្នន័យពីឯកសារ Word ដោយស្វ័យប្រវត្តិ\n` +
              `• ផ្ទៀងផ្ទាត់ចំណុចដៅជាមួយផែនការផ្លូវការ\n` +
              `• រក្សាទុកចូល Supabase Cloud Database ភ្លាមៗ\n` +
              `• អាចចូលមើលរបាយការណ៍តាម Web បានភ្លាមៗ`
            );
          } else if (msg.document) {
            const doc = msg.document;
            const fileName = doc.file_name || '';
            if (!fileName.toLowerCase().endsWith('.docx')) {
              await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `⚠️ សូមផ្ញើតែឯកសារ Word ដែលមានកន្ទុយ <b>.docx</b> ប៉ុណ្ណោះ។`);
            } else {
              await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `⏳ កំពុងទទួល និងដំណើរការអានឯកសារ <b>${escapeTelegramHtml(fileName)}</b>...`);

              try {
                // Download file from Telegram
                const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${doc.file_id}`);
                const fileJson = await fileRes.json();
                if (!fileJson.ok || !fileJson.result.file_path) {
                  throw new Error('ពុំអាចទាញយកឯកសារពី Telegram បានឡើយ');
                }

                const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileJson.result.file_path}`;
                const fileResp = await fetch(downloadUrl);
                const arrayBuf = await fileResp.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);

                // Parse document (dynamic fallback year)
                const parsed = parseDocxFile(buffer, 2026);
                const planItems = await getPlanFromDb(parsed.year);
                const mismatches = verifyTargetsAgainstPlan(parsed.items || [], parsed.month, planItems);
                parsed.targetMismatchesCount = mismatches;

                // Save to Supabase & local
                await saveReportToDb(parsed);

                const mismatchNotice = mismatches > 0 
                  ? `⚠️ <b>ចំណុចដៅខុសពីផែនការ៖</b> ${mismatches} សកម្មភាព (សូមចូលពិនិត្យផ្ទៀងផ្ទាត់លើ Web)`
                  : `✅ <b>ចំណុចដៅត្រឹមត្រូវ ១០០% ស្របតាមផែនការ</b>`;

                const replyText = 
                  `🎉 <b>បានទទួល និង Import របាយការណ៍ជោគជ័យ!</b>\n\n` +
                  `📄 <b>ឯកសារ៖</b> ${escapeTelegramHtml(fileName)}\n` +
                  `📅 <b>ខែ៖</b> ខែ${parsed.month} ឆ្នាំ${parsed.year}\n` +
                  `🏢 <b>អង្គភាព៖</b> ${escapeTelegramHtml(parsed.department || 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន')}\n` +
                  `📊 <b>សរុបសកម្មភាព៖</b> ${(parsed.items || []).length} សកម្មភាព\n` +
                  `${mismatchNotice}\n\n` +
                  `🔗 <b>ចូលមើលតារាងរបាយការណ៍លើ Web៖</b>\nhttps://nssf-progress-report-pisey3.vercel.app`;

                await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, replyText);
              } catch (docErr) {
                console.error('Error processing docx in Telegram webhook:', docErr);
                await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, 
                  `❌ <b>មានបញ្ហាក្នុងការអានឯកសារ៖</b> ${escapeTelegramHtml(docErr.message || 'ឯកសារមិនត្រឹមត្រូវ')}\n\nសូមត្រួតពិនិត្យឯកសារ Word នេះឡើងវិញ។`
                );
              }
            }
          }
        }
      } catch (err) {
        console.error('Telegram webhook processing error:', err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  // Serve static files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File Not Found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Request handler unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });
});

function tryListen(port) {
  server.removeAllListeners('error');
  server.removeAllListeners('listening');

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      tryListen(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.on('listening', () => {
    console.log(`====================================================`);
    console.log(` 🚀 កម្មវិធីរបាយការណ៍វឌ្ឍនភាព ប.ស.ស. កំពុងដំណើរការ...`);
    console.log(` 🌐 អាសយដ្ឋាន៖ http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`);
    console.log(`====================================================`);
    fs.writeFileSync(path.join(__dirname, 'active_port.txt'), String(port), 'utf8');
  });

  server.listen(port, HOST);
}

// Start listener when run directly
if (require.main === module) {
  tryListen(PORT);
}

module.exports = handleRequest;
