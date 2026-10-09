import ModalLayout from '@/components/ui/ModalLayout'
import type { ReactNode } from 'react'
import DetailModal from '@/components/ui/DetailModal'

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
  /** Marks the label with an asterisk; validation stays with the caller. */
  required?: boolean
  /** Display text for plain-string options (e.g. id -> name). */
  renderOption?: (option: string) => string
  /** Only for type 'note': arbitrary content rendered in place of a labeled input. */
  content?: ReactNode
}

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  fields?: FormFieldSpec[]
  values?: Record<string, string>
  onChange?: (key: string, value: string) => void
  onSubmit?: () => void
  submitLabel?: string
  cancelLabel?: string
  children?: ReactNode
  widthClassName?: string
}

/** Pair adjacent fields by default; explicit groups and notes keep their own boundaries. */
function groupFields(fields: FormFieldSpec[] = []) {
  if (!fields || !Array.isArray(fields)) return []
  const rows: FormFieldSpec[][] = []
  for (const field of fields) {
    const lastRow = rows[rows.length - 1]
    const lastField = lastRow?.[lastRow.length - 1]
    if (lastField && field.type !== 'note' && lastField.type !== 'note' && field.group === lastField.group && lastRow.length < 2) {
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
export default function FormModal({
  open,
  onClose,
  title,
  fields = [],
  values = {},
  onChange = () => { },
  onSubmit,
  submitLabel,
  cancelLabel = 'Hủy',
  children,
  widthClassName = 'max-w-2xl',
}: FormModalProps) {
  return (
    <DetailModal open={open} onClose={onClose} widthClassName={widthClassName}>
      <ModalLayout footer={!children ? (<div className="flex flex-wrap items-center justify-end gap-3">
        <button
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
          type="button"
          onClick={onClose}
        >
          {cancelLabel}
        </button>
        {onSubmit && submitLabel ? (
          <button
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm shadow-sm"
            type="button"
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        ) : null}
      </div>) : undefined} header={<h3 className="text-lg text-slate-900 font-bold">{title}</h3>} bodyClassName="space-y-4">{children ? (
        children
      ) : (
        <>
          {groupFields(fields).map((row, i) => (
            <div key={i} className={row.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-5' : undefined}>
              {row.map((field) =>
                field.type === 'note' ? (
                  <div key={field.key}>{field.content}</div>
                ) : (
                  <div key={field.key} className="space-y-1">
                    {field.label ? (
                      <label className="text-sm font-medium text-slate-700">
                        {field.label}
                        {field.required ? <span className="text-rose-600 ml-0.5">*</span> : null}
                      </label>
                    ) : null}
                    {field.type === 'select' ? (
                      <select className={inputClassName} value={values[field.key] ?? ''} onChange={(e) => onChange(field.key, e.target.value)}>
                        {(field.options ?? []).map((option) => {
                          const optValue = typeof option === 'string' ? option : option.value
                          const optLabel = typeof option === 'string' ? (field.renderOption?.(option) ?? option) : option.label
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
                        value={values[field.key] ?? ''}
                        onChange={(e) => onChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          ))}

        </>
      )}
      </ModalLayout>
    </DetailModal>
  )
}
