// =============================================================================
// QR-koder för grupper. Koden bär appens djuplänk (seventyfive://group?...)
// så skannern i appen hittar gruppen — och har man appen installerad kan
// även iOS-kameran öppna länken direkt.
// =============================================================================

const UUID = /groupId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

export function groupQrValue(groupId: string): string {
  return `seventyfive://group?groupId=${groupId}`
}

/** Grupp-id ur en skannad kod, null om koden inte är en gruppkod */
export function parseGroupQr(data: string): string | null {
  const m = data.match(UUID)
  return m ? m[1].toLowerCase() : null
}
