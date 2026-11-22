import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');
const chartsJs = fs.readFileSync('js/charts.js', 'utf8');

// 1. Check document.getElementById calls in app.js and charts.js
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
const ids = new Set();
let match;

while ((match = regex.exec(appJs)) !== null) {
  ids.add(match[1]);
}
while ((match = regex.exec(chartsJs)) !== null) {
  ids.add(match[1]);
}

const missingIds = [];
for (const id of ids) {
  const hasDouble = html.includes(`id="${id}"`);
  const hasSingle = html.includes(`id='${id}'`);
  if (!hasDouble && !hasSingle) {
    missingIds.push(id);
  }
}

console.log(`Referenced IDs check: ${ids.size} unique IDs inspected.`);
if (missingIds.length > 0) {
  console.error('Missing IDs in index.html:', missingIds);
} else {
  console.log('All referenced IDs exist in index.html!');
}

// 2. Check querySelector / querySelectorAll in app.js
const qsRegex = /querySelector(?:All)?\(['"]([^'"]+)['"]\)/g;
const selectors = new Set();
while ((match = qsRegex.exec(appJs)) !== null) {
  selectors.add(match[1]);
}
console.log('Selectors used in app.js:', [...selectors]);

// 3. Check for any Phase 4 files
const phase4Files = ['manifest.json', 'service-worker.js', 'sw.js'];
const existingPhase4 = phase4Files.filter(f => fs.existsSync(f));
if (existingPhase4.length > 0) {
  console.error('Phase 4 files detected prematurely:', existingPhase4);
} else {
  console.log('No Phase 4 files present.');
}
