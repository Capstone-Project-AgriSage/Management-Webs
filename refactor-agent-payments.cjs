const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, 'src/features/agent/payments/PaymentsPage.tsx')
let code = fs.readFileSync(file, 'utf8')

// 1. Remove the old activeTab buttons div
code = code.replace(
  /<div className="flex items-center gap-6 border-b border-slate-200">[\s\S]*?<\/div>\s*\{\/\* 2\. KPIs Row/m,
  `{/* 2. KPIs Row`
)

// 2. Refactor KPIs: remove the 4th card, keep 3.
code = code.replace(
  /grid-cols-1 lg:grid-cols-3 xl:grid-cols-4/,
  'grid-cols-1 lg:grid-cols-3'
)
code = code.replace(
  /<div className="p-4 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 xl:col-span-1 flex flex-col justify-between bg-white">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* 3\. Main Layout/m,
  `</div>\n\n      {/* 3. Main Layout`
)

// 3. Filter Bar: add Tab/Segmented Control next to SearchInput
code = code.replace(
  /<div className="flex flex-wrap items-center gap-3 mb-4">/m,
  `<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
              <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200 w-full xl:w-auto overflow-x-auto shrink-0">
                <button 
                  className={\`px-4 py-1.5 text-[13px] font-bold rounded-md whitespace-nowrap transition-colors \${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
                  onClick={() => setActiveTab('overview')}
                >
                  Tổng quan
                </button>
                <button 
                  className={\`px-4 py-1.5 text-[13px] font-bold rounded-md whitespace-nowrap transition-colors \${activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
                  onClick={() => setActiveTab('transactions')}
                >
                  Giao dịch
                </button>
                <button 
                  className={\`px-4 py-1.5 text-[13px] font-bold rounded-md whitespace-nowrap transition-colors \${activeTab === 'debts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}\`}
                  onClick={() => setActiveTab('debts')}
                >
                  Công nợ
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">`
)

// close the new div wrapper for filters
code = code.replace(
  /<span>Xóa lọc<\/span>\s*<\/button>\s*\)\}\s*<\/div>\s*\{\/\* Table/m,
  `<span>Xóa lọc</span>\n                </button>\n              )}\n              </div>\n            </div>\n\n            {/* Table`
)

// 4. Table Header: Merge 3 columns into 1
code = code.replace(
  /<th className="py-4 px-4 text-center">Tổng đơn<\/th>\s*<th className="py-4 px-4 text-center">Đã thu<\/th>\s*<th className="py-4 px-4 text-center">Còn lại<\/th>/,
  `<th className="py-4 px-4 text-right">Số tiền (₫)</th>`
)

// In the tbody, merge the 3 columns into 1 text-right column
code = code.replace(
  /<td className="py-4 px-4 text-center font-mono font-semibold text-slate-900">\{item.totalAmount\}<\/td>\s*<td className=\{`py-3 px-4 text-center font-mono font-semibold \$\{item.paidAmountClassName\}`\}>\{item.paidAmount\}<\/td>\s*<td className=\{`py-3 px-4 text-center font-mono font-bold \$\{item.remainingAmountClassName\}`\}>\s*\{item.remainingAmount\}\s*<\/td>/g,
  `<td className="py-4 px-4 text-right">
                            <div className="font-mono font-bold text-slate-900">{item.totalAmount}</div>
                            {item.hasRemaining ? (
                              <div className="text-[11px] font-mono font-semibold text-rose-600 mt-1 bg-rose-50 inline-block px-1.5 py-0.5 rounded">Nợ: {item.remainingAmount}</div>
                            ) : (
                              <div className="text-[11px] font-mono font-semibold text-emerald-600 mt-1 bg-emerald-50 inline-block px-1.5 py-0.5 rounded">Đã thu đủ</div>
                            )}
                          </td>`
)

// 5. Unify hover row color
code = code.replace(
  /hover:bg-slate-50\/50/g,
  'hover:bg-slate-50'
)
code = code.replace(
  /bg-slate-50\/80/g,
  'bg-slate-50'
)

fs.writeFileSync(file, code, 'utf8')
console.log('Done refactoring')
