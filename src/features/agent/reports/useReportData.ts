import { useCallback, useEffect, useState } from 'react'
import { describeError } from '@/api/client'

/** The caller memoizes load. Cancel superseded requests and hide results from the previous filters. */
export function useReportData<T>(load: (signal: AbortSignal) => Promise<T>, problem: string | null = null) {
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    window.addEventListener('agrisage-business-data-changed', refresh)
    return () => window.removeEventListener('agrisage-business-data-changed', refresh)
  }, [refresh])
  const [result, setResult] = useState<{ load: typeof load; revision: number; data: T | null; error: string | null } | null>(null)
  useEffect(() => {
    if (problem) return
    const controller = new AbortController()
    // Skip the discarded StrictMode effect before starting a network request.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return load(controller.signal)
    }).then(data => {
      if (!controller.signal.aborted) setResult({ load, revision, data, error: null })
    }).catch(err => {
      if (!controller.signal.aborted) setResult({ load, revision, data: null, error: describeError(err, 'Không tải được báo cáo.') })
    })
    return () => controller.abort()
  }, [load, problem, revision])
  const current = !problem && result?.load === load && result.revision === revision ? result : null
  return { data: current?.data ?? null, loading: !problem && !current, error: current?.error ?? null, refresh }
}
