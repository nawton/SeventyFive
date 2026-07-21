// =============================================================================
// NAMNDELNING — profilen lagrar ETT namnfält ("Anton Wretenberg") men
// profilinställningarna redigerar förnamn/efternamn separat. Delningen:
// första ordet är förnamnet, resten efternamnet (så "Anna Maria Berg"
// rundtrippar som "Anna" + "Maria Berg").
// =============================================================================

export function splitName(full: string | null | undefined): { first: string; last: string } {
  const trimmed = (full ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return { first: '', last: '' }
  const idx = trimmed.indexOf(' ')
  if (idx === -1) return { first: trimmed, last: '' }
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) }
}

export function combineName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ')
}
