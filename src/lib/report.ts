import { Alert, ActionSheetIOS, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

// =============================================================================
// ANMÄLNINGAR — delat flöde för grupper, inlägg och användare: välj
// anledning, raden hamnar i reports-tabellen (läses bara i adminpanelen).
// =============================================================================

export type ReportTarget = 'group' | 'post' | 'user'

const REASONS = ['Spam eller vilseledande', 'Stötande innehåll', 'Trakasserier', 'Annat']

async function submit(targetType: ReportTarget, targetId: string, reason: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('inte inloggad')
  const { error } = await supabase.from('reports').insert({
    reporter_id: session.user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
  })
  if (error) throw error
}

/** Öppnar anledningsvalet och skickar anmälan */
export function promptReport(targetType: ReportTarget, targetId: string, title: string): void {
  const send = (reason: string) => {
    submit(targetType, targetId, reason)
      .then(() => Alert.alert('Tack för din anmälan', 'Vi tittar på den så snart vi kan.'))
      .catch(() => Alert.alert('Kunde inte skicka anmälan', 'Kontrollera anslutningen och försök igen.'))
  }
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: ['Avbryt', ...REASONS], cancelButtonIndex: 0 },
      i => { if (i > 0) send(REASONS[i - 1]) },
    )
  } else {
    Alert.alert(title, 'Välj anledning', [
      { text: 'Avbryt', style: 'cancel' },
      ...REASONS.map(r => ({ text: r, onPress: () => send(r) })),
    ])
  }
}

/** ⋯-menyn på ett inlägg: anmäl inlägget eller dess författare */
export function postReportMenu(postId: string, authorId: string, authorName: string): void {
  const reportPost = () => promptReport('post', postId, 'Anmäl inlägget')
  const reportUser = () => promptReport('user', authorId, `Anmäl ${authorName}`)
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Avbryt', 'Anmäl inlägget', `Anmäl ${authorName}`], cancelButtonIndex: 0 },
      i => { if (i === 1) reportPost(); else if (i === 2) reportUser() },
    )
  } else {
    Alert.alert('Inlägg', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Anmäl inlägget', onPress: reportPost },
      { text: `Anmäl ${authorName}`, onPress: reportUser },
    ])
  }
}
