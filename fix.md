# fix.md — Kända buggar och förbättringar

Sammanställt 2026-07-12. Prioriterat uppifrån och ned.

---

## 🔴 Bruten — åtgärda först

### 1. Kan inte ta bort egna regler
`rules.tsx` togs bort (regler integrerades i dashboarden) men ingen delete-funktion lades till där.  
**Fix:** Lägg till long-press eller trash-ikon på custom-regler i regelsektionen i `app/(app)/dashboard.tsx`.  
Service-funktionen `deleteCustomRule` finns redan i `src/services/rules.ts`.

### 2. Ny regel dyker inte upp samma dag
`getOrCreateTaskCompletions` i `src/services/dailyLog.ts` returnerar tidigt om det redan finns completions för dagen (rad ~74). En regel som läggs till kl 14:00 syns inte förrän imorgon.  
**Fix:** I `handleCreateRule` i `dashboard.tsx` — efter att `createCustomRule` returnerar den nyskapade mallens `id`, infoga en `task_completion` direkt för dagens `dailyLogId` och re-fetcha sedan listan.

```typescript
// Efter createCustomRule(...)
await supabase.from('task_completions').insert({
  daily_log_id: dailyLogId,
  task_template_id: createdRule.templateId, // behöver exponeras från createCustomRule
  completed: false,
})
const updated = await getOrCreateTaskCompletions(dailyLogId, ...)
setTasks(updated)
```

### 3. `notes`-kolumnen saknas troligtvis i databasen
Migrationen `supabase/migrations/20260703000001_session_notes.sql` har aldrig bekräftats körd.  
`SessionEditor` läser och skriver `notes` — om kolumnen saknas misslyckas sparandet tyst.  
**Fix:** Kör i Supabase Dashboard → SQL Editor:
```sql
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
```

---

## 🟡 Viktiga brister

### 4. Cardio-fel sväljs tyst
`completeCardioSession` i `src/services/workoutSchedule.ts` rad 119 använder `console.warn` istället för att kasta.  
Om sparandet misslyckas ser användaren ingen feedback.  
**Fix:** Byt `console.warn` mot `throw error` (eller visa Alert i `cardio.tsx`).

### 5. Stats-skärmen saknar felhantering
`loadStats` i `app/(app)/stats.tsx` har `finally { setLoading(false) }` men ingen `catch` — vid nätverksfel visas bara en tom skärm.  
Dashboard och profil har en retry-knapp; stats borde också ha det.  
**Fix:** Lägg till `loadError`-state + felkort med "Försök igen"-knapp, samma mönster som i `dashboard.tsx` rad 497–510.

### 6. Aktivitets-tabben är en platshållare
`app/(app)/activity.tsx` visar bara "Aktivitetsflödet kommer snart" men tabben syns i navbaren.  
**Fix:** Antingen bygg skärmen, eller lägg `href: null` i `app/(app)/_layout.tsx` tills den är klar.

---

## 🟢 Polish / UX

### 7. Notiser schemaläggs aldrig
`app/(app)/settings.tsx` frågar om notistillstånd och visar en toggle, men inga faktiska notiser skapas eller schemaläggs.  
Toggle är meningslös för användaren just nu.  
**Fix:** Antingen implementera schemalagda dagliga notiser med `expo-notifications`, eller ta bort togglen tills funktionen är klar.

### 8. Ring-räknaren räknar custom tasks
Ringen i hero-cardet räknar `tasks.length` inklusive custom rules. Om en användare har 5 egna regler + 5 nivåregler behöver de bocka av 10 saker för att dagen ska vara "klar". Oklart om det är önskat beteende — om inte, filtrera custom tasks ur `allDone`-beräkningen.

### 9. Streak-beräkning i stats
Streaken i `app/(app)/stats.tsx` räknas baklänges från `currentDay - 1`, inte från igår. Om nuvarande dag inte är klar ännu visas 0 streak trots att de 5 senaste dagarna är klara. Bör räkna från senaste avslutade dag.

---

## Migrationer som behöver köras

| Fil | Status | SQL att köra |
|-----|--------|-------------|
| `20260703000001_session_notes.sql` | ❓ Okänd | `ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS notes TEXT;` |
| `20260706000002_session_type_cardio.sql` | ✅ Körd | — |
| `20260712000001_custom_task_templates.sql` | ✅ Körd | — |
