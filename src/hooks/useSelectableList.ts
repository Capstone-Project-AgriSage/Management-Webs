import { useState } from 'react'

/**
 * Tracks which item in a list is "selected" (e.g. the row clicked in a table).
 * Starts with nothing selected so a detail modal only opens after an explicit click.
 */
export function useSelectableList<T>(items: T[], getId: (item: T) => string) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? items.find((item) => getId(item) === selectedId) ?? null : null

  return { selectedId, setSelectedId, selected }
}
