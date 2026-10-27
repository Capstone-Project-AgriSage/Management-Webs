import { Save, Undo2 } from 'lucide-react'

export default function PermissionSaveBar({ reason, onReason, dirtyCount, busy, stale, onSave, onDiscard, label = 'Lưu thay đổi' }: {
  reason: string; onReason: (value: string) => void; dirtyCount: number; busy: boolean; stale: boolean
  onSave: () => void; onDiscard: () => void; label?: string
}) {
  return <div className="relative z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:p-5 lg:sticky lg:bottom-3">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Lý do thay đổi <span className="text-rose-500">*</span><textarea aria-label="Lý do thay đổi" rows={2} maxLength={500} value={reason} disabled={busy || stale} onChange={e => onReason(e.target.value)} placeholder="Mô tả ngắn lý do điều chỉnh quyền…" className="mt-2 block w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50" /></label>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end"><span role="status" className="text-xs text-slate-500">{busy ? 'Đang xử lý…' : dirtyCount ? `${dirtyCount} thay đổi chưa lưu` : 'Đã đồng bộ cấu hình'}</span><button type="button" disabled={busy || !dirtyCount} onClick={onDiscard} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 disabled:opacity-40"><Undo2 size={14} />Hoàn tác</button><button type="button" disabled={busy || stale || !dirtyCount || !reason.trim()} onClick={onSave} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Save size={15} />{label}</button></div>
    </div>
  </div>
}
