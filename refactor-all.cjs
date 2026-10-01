const fs = require('fs');
const path = require('path');

function processDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      files = files.concat(processDir(path.join(dir, item.name)));
    } else if (item.name.endsWith('Page.tsx')) {
      files.push(path.join(dir, item.name));
    }
  }
  return files;
}

const dirsToProcess = ['src/features/admin', 'src/features/sales', 'src/features/delivery'];
let allFiles = [];
for (const dir of dirsToProcess) {
  allFiles = allFiles.concat(processDir(dir));
}

let totalProcessed = 0;

for (const file of allFiles) {
  let code = fs.readFileSync(file, 'utf8');
  let originalCode = code;

  // 1. ROOT WRAPPER
  if (code.match(/return\s*\(\s*<>\s*/)) {
    code = code.replace(/return\s*\(\s*<>\s*/, 'return (\n    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">\n      ');
    // Replace the LAST </>
    const lastIndex = code.lastIndexOf('</>');
    if (lastIndex !== -1) {
      code = code.substring(0, lastIndex) + '</div>' + code.substring(lastIndex + 3);
    }
  } else if (!code.includes('max-w-[1600px] mx-auto')) {
    code = code.replace(/return\s*\(\s*<div[^>]*>/, 'return (\n    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">');
  }

  // 2. HOVER UNIFICATION
  code = code.replace(/hover:bg-slate-50\/50/g, 'hover:bg-slate-50');
  code = code.replace(/hover:bg-emerald-50\/50/g, 'hover:bg-emerald-50');
  code = code.replace(/bg-slate-50\/80/g, 'bg-slate-50');

  // 3. KPI BORDERS
  const colors = ['amber', 'blue', 'emerald', 'purple', 'rose', 'sky', 'indigo', 'red'];
  for (const c of colors) {
    const regex = new RegExp(`bg-white border border-${c}-200 rounded-xl(.*?)shadow-sm`, 'g');
    code = code.replace(regex, `bg-white border border-slate-200 rounded-xl$1shadow-sm`);
  }

  if (code !== originalCode) {
    fs.writeFileSync(file, code, 'utf8');
    totalProcessed++;
    console.log('Processed', file);
  }
}

console.log('Done processing', totalProcessed, 'files across admin, sales, delivery.');
