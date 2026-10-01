const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, 'src/features/agent/orders/OrdersPage.tsx')
let code = fs.readFileSync(file, 'utf8')

// 1. Root Wrapper
code = code.replace(
  /return \(\s*<>\s*\{\/\* PAGE TITLE & ACTIONS ZONE \*\/\}/m,
  `return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      {/* PAGE TITLE & ACTIONS ZONE */}`
)

code = code.replace(
  /<\/FormModal>\s*<\/>\s*\)\s*\}\s*$/m,
  `</FormModal>\n    </div>\n  )\n}\n`
)

// 2. Border of KPI 2
code = code.replace(
  /<div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm flex flex-col justify-between">/g,
  '<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">'
)

// 3. Merge Filter and Table
code = code.replace(
  /\{\/\* FILTER & SEARCH BAR \*\/\}\s*<div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">/m,
  `{/* MAIN CONTENT AREA: Filter & Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
        {/* FILTER & SEARCH BAR */}
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">`
)

code = code.replace(
  /<\/button>\s*<\/div>\s*<\/div>\s*\{\/\* MAIN TABLE \*\/\}\s*<div className="bg-white rounded-xl flex flex-col pt-2">/m,
  `</button>\n        </div>\n      </div>\n\n      {/* MAIN TABLE */}\n      <div className="flex flex-col pt-2">`
)

code = code.replace(
  /setPage=\{setPage\}\s*\/>\s*<\/div>\s*\{\/\* DETAIL MODAL:/m,
  `setPage={setPage}\n          />\n        </div>\n      </div>\n\n      {/* DETAIL MODAL:`
)

// 4. Update MinimalBadge billing type border
code = code.replace(
  /return \(\s*<span className="inline-flex items-center justify-center px-2\.5 py-1 rounded-full text-\[11px\] font-medium border border-slate-200 text-slate-600 bg-white min-w-\[100px\]">/m,
  `return (
    <span className="inline-flex items-center text-[12px] font-medium text-slate-700">`
)

// 5. Unify hover row color
code = code.replace(
  /hover:bg-slate-50\/50/g,
  'hover:bg-slate-50'
)

fs.writeFileSync(file, code, 'utf8')
console.log('Done refactoring OrdersPage')
