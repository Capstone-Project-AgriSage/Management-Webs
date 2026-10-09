import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useState, type ReactNode } from 'react'
import Modal from '@/components/ui/Modal'

export interface PromptField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'date' | 'select'
  required?: boolean
  placeholder?: string
  min?: string
  options?: { value: string; label: string }[]
  hint?: string
}

interface PromptModalProps {
  open: boolean
  title: string
  description?: ReactNode
  fields: PromptField[]
  initialValues?: Record<string, string>
  submitLabel: string
  danger?: boolean
  loading?: boolean
  onClose: () => void
  onSubmit: (values: Record<string, string>) => void
}

const inputClassName =
  'w-full px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'

/** Small form dialog for actions that need a reason, an amount or a date (credit/debt actions all require a reason). */
export default function PromptModal({ open, title, description, fields, initialValues, submitLabel, danger, loading, onClose, onSubmit }: PromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map((f) => [f.key, initialValues?.[f.key] ?? ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const missing = fields.some((f) => f.required && !String(values[f.key] ?? '').trim())

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} busy={loading}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          if (!missing && !loading) onSubmit(values)
        }}
      >
        <ModalLayout footer={<div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            disabled={missing || loading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {loading ? 'Đang xử lý...' : submitLabel}
          </button>
        </div>} bodyClassName="grid grid-cols-1 sm:grid-cols-2 gap-5">{fields.map((f) => {
          const id = `prompt-${f.key}`
          const common = {
            id,
            value: values[f.key] ?? '',
            placeholder: f.placeholder,
            onChange: (e: { target: { value: string } }) => setValues((prev) => ({ ...prev, [f.key]: e.target.value })),
          }
          return (
            <div key={f.key} className={`space-y-1 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
              <label htmlFor={id} className="text-sm font-medium text-slate-700">
                {f.label}
                {f.required && <span className="text-rose-600 ml-0.5">*</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea {...common} rows={3} className={`${inputClassName} py-2`} />
              ) : f.type === 'select' ? (
                <select {...common} className={`${inputClassName} h-10`}>
                  <option value="">-- Chọn --</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input {...common} type={f.type ?? 'text'} min={f.min} className={`${inputClassName} h-10`} />
              )}
              {f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}
            </div>
          )
        })}
        </ModalLayout>
      </form>
    </Modal>
  )
}
