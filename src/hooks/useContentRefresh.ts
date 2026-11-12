import { useEffect, useEffectEvent } from 'react'

/** Keep content lists current across apps/tabs, including after returning to the page. */
export function useContentRefresh(reload: () => unknown) {
  const refresh = useEffectEvent(() => { if (!document.hidden) void reload() })
  useEffect(() => {
    const onFocus = () => refresh()
    const timer = window.setInterval(onFocus, 30000)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [])
}
