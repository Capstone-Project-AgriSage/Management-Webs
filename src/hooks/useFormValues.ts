import { useState } from 'react'

/**
 * Controlled form-values state for a simple create/edit modal: one object of
 * string fields, a per-key `update`, and `reset` to restore defaults (or
 * pre-fill with a record's current values when opening an edit form).
 */
export function useFormValues<T extends Record<string, string>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)

  const update = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const reset = (next: T = initialValues) => setValues(next)

  return { values, setValues, update, reset }
}
