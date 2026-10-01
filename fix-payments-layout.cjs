const fs = require('fs');
const path = require('path');

// Fix Agent Payments Page
const agentFile = path.join(__dirname, 'src/features/agent/payments/PaymentsPage.tsx');
let agentCode = fs.readFileSync(agentFile, 'utf8');

agentCode = agentCode.replace(
  `usePageHeader({ title: '' }) // Flat layout`,
  `usePageHeader({ title: 'Quản lý thanh toán', subtitle: 'Theo dõi dòng tiền và giao dịch' })`
);

// Replace the custom layout
agentCode = agentCode.replace(
  /<div className="bg-white -m-4 lg:-m-6 p-4 lg:p-8 min-h-\[calc\(100vh-4rem\)\] text-slate-900">\s*\{\/\* 1\. Header & Tabs \*\/\}\s*<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">\s*<div>\s*<h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý thanh toán<\/h1>\s*<p className="text-\[13px\] text-slate-500 mt-1 font-medium capitalize">\{dateStr\}<\/p>\s*<div className="mt-8 flex items-center gap-6">/g,
  `<div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link className="hover:text-slate-900 transition-colors" to="/agent">Bảng điều khiển</Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 font-medium">Quản lý thanh toán</span>
        </nav>
        <div className="flex items-center gap-3 pb-2 shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium mr-2">
            <RefreshCw size={12} /> Cập nhật 5 phút trước
          </span>
          <button 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md text-[13px] font-bold hover:bg-slate-50/50 shadow-sm text-slate-700 transition-colors bg-white"
            onClick={handleExportPayments}
          >
            <Download size={14} /> Xuất dữ liệu
          </button>
          <button 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-[13px] font-bold hover:bg-emerald-700 shadow-sm transition-colors"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={14} /> Tạo thanh toán
          </button>
        </div>
      </div>
      <div className="flex items-center gap-6 border-b border-slate-200">`
);

// Remove the old button group div endings and <div className="border-b ...">
agentCode = agentCode.replace(
  /<\/div>\s*<\/div>\s*<div className="flex items-center gap-3 pb-2 shrink-0">[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<div className="border-b border-slate-200 -mt-\[1px\]"><\/div>/g,
  `</div>`
);

// We need to make sure we import Link if it's not imported
if (!agentCode.includes(`import { Link }`)) {
  agentCode = agentCode.replace(
    `import { ChevronRight,`,
    `import { Link } from 'react-router-dom'\nimport { ChevronRight,`
  );
}

// Adjust KPI row margins and shadows
agentCode = agentCode.replace(
  `className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8"`,
  `className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6"`
);

agentCode = agentCode.replace(
  `className="flex flex-col lg:flex-row mt-8 gap-8"`,
  `className="flex flex-col lg:flex-row gap-8"`
);

// Add missing bg-white to KPI cards and layout pieces since they are now on gray bg
agentCode = agentCode.replace(/<div className="p-4 rounded-xl border border-slate-200 shadow-sm">/g, '<div className="p-4 rounded-xl border border-slate-200 shadow-sm bg-white">');
agentCode = agentCode.replace(/<div className="p-4 rounded-xl border border-slate-200 shadow-sm hidden xl:block">/g, '<div className="p-4 rounded-xl border border-slate-200 shadow-sm hidden xl:block bg-white">');
agentCode = agentCode.replace(/<div className="p-4 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 xl:col-span-1 flex flex-col justify-between">/g, '<div className="p-4 rounded-xl border border-slate-200 shadow-sm lg:col-span-1 xl:col-span-1 flex flex-col justify-between bg-white">');

fs.writeFileSync(agentFile, agentCode, 'utf8');


// Fix Sales Payments Page
const salesFile = path.join(__dirname, 'src/features/sales/payments/PaymentsPage.tsx');
let salesCode = fs.readFileSync(salesFile, 'utf8');

salesCode = salesCode.replace(
  /return \(\s*<>\s*<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">/g,
  `return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">`
);

salesCode = salesCode.replace(
  /<\/FormModal>\s*<\/>/g,
  `</FormModal>
    </div>`
);

fs.writeFileSync(salesFile, salesCode, 'utf8');

console.log('Fixed alignments in Payments pages');
