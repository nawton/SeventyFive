import { useCallback, useRef, useState } from 'react'
import { RefreshControl, type RefreshControlProps } from 'react-native'
import * as Haptics from 'expo-haptics'

// =============================================================================
// Enhetlig pull-to-refresh för hela appen: mörkgrå spinner i den nativa
// mellanstorleken. Omladdningar är ofta blixtsnabba — spinnern hålls
// kvar en kort stund så att uppdateringen känns, annars ser draget ut
// att inte göra någonting.
// =============================================================================

export const SPINNER_GRAY = '#666'
const MIN_SPIN_MS = 900

export function useAppRefresh(reload: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const onRefresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const started = Date.now()
    try { await reload() } catch { /* nästa drag försöker igen */ }
    const left = MIN_SPIN_MS - (Date.now() - started)
    if (left > 0) await new Promise(r => setTimeout(r, left))
    busy.current = false
    setRefreshing(false)
  }, [reload])
  return { refreshing, onRefresh }
}

export function AppRefreshControl(props: Omit<RefreshControlProps, 'tintColor' | 'colors'>) {
  return <RefreshControl {...props} tintColor={SPINNER_GRAY} colors={[SPINNER_GRAY]} />
}
