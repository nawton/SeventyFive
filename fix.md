# fix.md — Kända buggar och förbättringar

Sammanställt 2026-07-12. Uppdaterad 2026-07-13: alla ursprungliga punkter åtgärdade.

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

## Kvar (medvetet)

### 6. Aktivitets-tabben är en platshållare
Ska vara tom tills aktivitetsflödet byggs (beslut 2026-07-13). Tabben ligger kvar i navbaren.

---

## Migrationer som behöver köras

| Fil | Status | SQL att köra |
|-----|--------|-------------|
| `20260703000001_session_notes.sql` | ✅ Körd 2026-07-13 (via fix_custom_rules-queryn) | — |
| `20260706000002_session_type_cardio.sql` | ✅ Körd | — |
| `20260712000001_custom_task_templates.sql` | ✅ Körd | — |
| `20260713000001_fix_custom_rules.sql` | ✅ Körd 2026-07-13 (inkl. notes-kolumnen) | — |
| `20260713000002_harden_advance_days_and_exercise_completions.sql` | ⏳ EJ KÖRD — kör i SQL Editor | Hela filens innehåll |
