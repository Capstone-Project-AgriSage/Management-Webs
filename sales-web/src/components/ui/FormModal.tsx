import type { ReactNode } from 'react'
import DetailModal from './DetailModal'

type SelectOption = string | { value: string; label: string }

export interface FormFieldSpec {
  /** Must be unique within the field list; only used as values[key]/onChange(key, ...) when type !== 'note'. */
  key: string
  label?: string
  type?: 'text' | 'number' | 'select' | 'note'
  placeholder?: string
  min?: string
  options?: SelectOption[]
  /** Fields sharing the same `group` render side by side, two per row. */
  group?: string
  /** Only for type 'note': arbitrary content rendered in place of a labeled input. */
  content?: ReactNode
}

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  fields: FormFieldSpec[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSubmit: () => void
  submitLabel: string
  cancelLabel?: string
}

/** Groups consecutive fields that share a `group` id into rows of up to 2; everything else (and every 'note') is its own row. */
function groupFields(fields: FormFieldSpec[]) {
  const rows: FormFieldSpec[][] = []
  for (const field of fields) {
    const lastRow = rows[rows.length - 1]
    const lastField = lastRow?.[lastRow.length - 1]
    if (field.group && field.type !== 'note' && lastField?.group === field.group && lastField.type !== 'note' && lastRow.length < 2) {
      lastRow.push(field)
    } else {
      rows.push([field])
    }
  }
  return rows
}

const inputClassName =
  'w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

/** Shared create/edit modal: renders a title, a list of labeled text/number/select fields (or note content), and Hủy/submit buttons. */
export default function FormModal({ open, onClose, title, fields, values, onChange, onSubmit, submitLabel, cancelLabel = 'Hủy' }: FormModalProps) {
  return (
    <DetailModal open={open} onClose={onClose}>
      <div className="p-5 space-y-4">
        <h3 className="text-lg text-slate-900 font-bold">{title}</h3>
        {groupFields(fields).map((row, i) => (
          <div key={i} className={row.length > 1 ? 'grid grid-cols-2 gap-3' : undefined}>
            {row.map((field) =>
              field.type === 'note' ? (
                <div key={field.key}>{field.content}</div>
              ) : (
                <div key={field.key} className="space-y-1">
                  {field.label ? <label className="text-sm font-medium text-slate-700">{field.label}</label> : null}
                  {field.type === 'select' ? (
                    <select className={inputClassName} value={values[field.key]} onChange={(e) => onChange(field.key, e.target.value)}>
                      {(field.options ?? []).map((option) => {
                        const optValue = typeof option === 'string' ? option : option.value
                        const optLabel = typeof option === 'string' ? option : option.label
                        return (
                          <option key={optValue} value={optValue}>
                            {optLabel}
                          </option>
                        )
                      })}
                    </select>
                  ) : (
                    <input
                      className={inputClassName}
                      type={field.type === 'number' ? 'number' : 'text'}
                      min={field.min}
                      placeholder={field.placeholder}
                      value={values[field.key]}
                      onChange={(e) => onChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ),
            )}
          </div>
        ))}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
          <button
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
            type="button"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm shadow-sm"
            type="button"
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </DetailModal>
  )
}
