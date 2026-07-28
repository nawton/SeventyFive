import { Alert, ActionSheetIOS, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { t } from '@/lib/i18n'

// =============================================================================
// ANMÄLNINGAR — delat flöde för grupper, inlägg och användare: välj
// anledning, raden hamnar i reports-tabellen (läses bara i adminpanelen).
// =============================================================================

export type ReportTarget = 'group' | 'post' | 'user'

const REASONS = ['Spam eller vilseledande', 'Stötande innehåll', 'Trakasserier', 'Annat']

async function submit(targetType: ReportTarget, targetId: string, reason: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('inte inloggad')
  // Kolumnnamnen kommer från 20260722000011 (target_kind/details) — den
  // tabellen fanns före anmälningsflödena här och är den som gäller
  const { error } = await supabase.from('reports').insert({
    reporter_id: session.user.id,
    target_kind: targetType,
    target_id: targetId,
    details: reason,
  })
  if (error) throw error
}

/** Öppnar anledningsvalet och skickar anmälan */
export function promptReport(targetType: ReportTarget, targetId: string, title: string): void {
  const send = (reason: string) => {
    submit(targetType, targetId, reason)
      .then(() => Alert.alert(t('Tack för din anmälan'), t('Vi tittar på den så snart vi kan.')))
      .catch(() => Alert.alert(t('Kunde inte skicka anmälan'), t('Kontrollera anslutningen och försök igen.')))
  }
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [t('Avbryt'), ...REASONS.map(r => t(r))], cancelButtonIndex: 0 },
      i => { if (i > 0) send(REASONS[i - 1]) },
    )
  } else {
    Alert.alert(title, t('Välj anledning'), [
      { text: t('Avbryt'), style: 'cancel' },
      ...REASONS.map(r => ({ text: t(r), onPress: () => send(r) })),
    ])
  }
}

/** ⋯-menyn på ett inlägg: anmäl inlägget eller dess författare */
export function postReportMenu(postId: string, authorId: string, authorName: string): void {
  const reportPost = () => promptReport('post', postId, t('Anmäl inlägget'))
  const reportUser = () => promptReport('user', authorId, t('Anmäl {name}', { name: authorName }))
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [t('Avbryt'), t('Anmäl inlägget'), t('Anmäl {name}', { name: authorName })], cancelButtonIndex: 0 },
      i => { if (i === 1) reportPost(); else if (i === 2) reportUser() },
    )
  } else {
    Alert.alert(t('Inlägg'), undefined, [
      { text: t('Avbryt'), style: 'cancel' },
      { text: t('Anmäl inlägget'), onPress: reportPost },
      { text: t('Anmäl {name}', { name: authorName }), onPress: reportUser },
    ])
  }
}
