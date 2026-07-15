# fix.md — Kända buggar och förbättringar

Sammanställt 2026-07-12. Uppdaterad 2026-07-13: alla ursprungliga punkter åtgärdade. Uppdaterad 2026-07-15: pre-launch-förbättringar klara.

---

## ✅ Åtgärdade 2026-07-13

- **1. Kan inte ta bort egna regler** — long-press på regeln i dashboarden + `deleteCustomRule` rensar nu även `task_completions` (FK:n saknar cascade).
- **2. Ny regel dyker inte upp samma dag** — `createCustomRule` tar emot dagens `dailyLogId` och seedar en completion direkt.
- **3. `notes`-kolumnen** — körd via fix_custom_rules-queryn.
- **4. Cardio-fel sväljs tyst** — `saveCardioWorkout` och `completeCardioSession` kastar nu; cardio-skärmen behåller sammanfattningen och visar Alert med möjlighet att spara igen.
- **5. Stats-skärmen saknar felhantering** — `loadError`-state + felkort med "Försök igen", samma mönster som dashboarden.
- **7. Notiser** — togglen schemalägger nu två dagliga lokala notiser (09:00 morgonpepp, 20:30 streak-vakt) via `src/services/notifications.ts`, och kan stängas av i appen. Kräver development build.
- **8. Ring-räknaren** — bara nivåuppgifter avgör "dagen klar"; egna regler är extramål som varken blockerar eller fäller en dag.
- **9. Streak-beräkning i stats** — använder nu `getStreak` från `dailyLog.ts` som räknar med dagens dag när den är klar.

Övriga förbättringar samma dag: wizardens löppass som riktiga cardio-pass, härdad
`advance_challenge_days` (REVOKE + service-nyckelkrav i edge-funktionen),
övningsbockningar kastar fel istället för att tystas, alert vid misslyckad
passradering, bildkomprimering före uppladdning (`src/lib/image.ts`),
error boundary på rotnivå, datumhelpers samlade i `src/lib/date.ts`,
dashboard uppdelad (TaskGridCard + AddRuleSheet), debounce på datumswipe.

---

## ✅ Åtgärdade 2026-07-15 — Pre-launch-förbättringar

### 1. Aktivitets-tabben dold
`activity.tsx` behålls som fil men tabben är nu osynlig i navbaren (`href: null` i `(app)/_layout.tsx`). Aktiveras när flödet är klart.

### 2. Dag 1–7-upplevelse i Översikt
- "Missade dagar" och "Framgång X%" döljs de första 7 dagarna (ger inte rättvis bild).
- Milstolpekortet visas ovanför stat-raden med framåtblickande text ("Du är på väg!").
- Tredje stat-kortet visar "till dag 10" istället för "kvar till mål".
- Från dag 8 visas all statistik och milstolpen återgår till sin normala position.

### 3. Dynamisk underrubrik på hemskärmen
Ersätter den statiska `getSubtitle`-funktionen. Ren funktion `getGreetingSubtitle(hour, completedCount, totalCount, currentDay)` i `src/lib/getGreetingSubtitle.ts` med regelbaserade svenska texter beroende på tid på dygnet och hur mycket som är gjort. Enhetstester i `src/lib/__tests__/getGreetingSubtitle.test.ts`.

### 4a. Gympass-namn utan ONCE:-prefix
`fetchGymSessions` i stats.tsx parsar nu bort `ONCE:datum:`-prefixet ur sessionsnamnet. Datumet visas som "13 juli" (kort lokalformat) istället för dagförkortning.

### 4b. "Idag" i vilodag-texten
När vald dag är dagens datum visas "Inget pass schemalagt idag" istället för veckodagsnamnet.

### 4c. Foto-uppgift full bredd
Foto-uppgiften filtreras ut ur 2-kolumnsgriden och renderas som ett full-bredstt kort direkt under. `TaskGridCard` fick en `fullWidth`-prop för detta.

### 4d. Tom veckoschema → Schema-guide
När inga upprepande pass finns (alla 7 dagar är vilodag) visas en orange CTA-banner i `manage-sessions.tsx` som öppnar ScheduleWizard direkt.

### 5. Kontoborttagning
Nytt "Radera konto"-alternativ i inställningarna (under Konto, ovanför Logga ut). Flöde: bekräftelsedialog → raderar storage-filer (progress-photos, avatars) best-effort → anropar `supabase.rpc('delete_user_account')` → loggar ut → välkomstsidan. Kräver att migrationen `20260715000001_delete_user_rpc.sql` körs i Supabase.

### 6. Error boundary
`src/components/ErrorBoundary.tsx` fanns redan och wrappar rot-Stacken — inget nytt behövdes.

---

## Kvar (medvetet)

### Aktivitets-tabben
Filen `activity.tsx` är en platshållare. Tabben är nu dold (se punkt 1 ovan). Aktiveras när aktivitetsflödet byggs.

---

## Migrationer som behöver köras

| Fil | Status | SQL att köra |
|-----|--------|-------------|
| `20260703000001_session_notes.sql` | ✅ Körd 2026-07-13 (via fix_custom_rules-queryn) | — |
| `20260706000002_session_type_cardio.sql` | ✅ Körd | — |
| `20260712000001_custom_task_templates.sql` | ✅ Körd | — |
| `20260713000001_fix_custom_rules.sql` | ✅ Körd 2026-07-13 (inkl. notes-kolumnen) | — |
| `20260713000002_harden_advance_days_and_exercise_completions.sql` | ⏳ EJ KÖRD — kör i SQL Editor | Hela filens innehåll |
| `20260715000001_delete_user_rpc.sql` | ⏳ EJ KÖRD — kör i SQL Editor (krävs för kontoborttagning) | Hela filens innehåll |
