const fs = require('fs');
const path = require('path');

const filesToInclude = [
  'package.json',
  'vercel.json',
  'server.js',
  'generator.js',
  'importer.js',
  'template.docx',
  'api/index.js',
  'public/index.html',
  'public/app.js',
  'public/style.css',
  'data/action_plan_2027.json',
  'data/reports/2026_09.json',
  'data/reports/2027_09.json',
  'data/reports/2027_12.json'
];

const deployFiles = [];
for (const rel of filesToInclude) {
  const full = path.resolve(rel);
  if (!fs.existsSync(full)) {
    console.error('Missing file:', rel);
    continue;
  }
  const isBinary = rel.endsWith('.docx') || rel.endsWith('.png');
  const buf = fs.readFileSync(full);
  deployFiles.push({
    file: rel.replace(/\\/g, '/'),
    data: isBinary ? buf.toString('base64') : buf.toString('utf8'),
    encoding: isBinary ? 'base64' : 'utf-8'
  });
}

console.log('Total files ready for Vercel deployment:', deployFiles.length);
const totalBytes = JSON.stringify(deployFiles).length;
console.log('Total payload size in KB:', Math.round(totalBytes / 1024));
fs.writeFileSync('deploy_payload.json', JSON.stringify({
  name: 'nssf-progress-report',
  target: 'production',
  files: deployFiles
}));
console.log('Saved deploy_payload.json');
