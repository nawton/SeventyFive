# fix.md — Kända buggar och förbättringar

Sammanställt 2026-07-12. Prioriterat uppifrån och ned.
Uppdaterad 2026-07-13: punkt 1, 2, 4, 5 och 9 åtgärdade (se git-loggen).

---

## ✅ Åtgärdade 2026-07-13

- **1. Kan inte ta bort egna regler** — long-press på regeln i dashboarden + `deleteCustomRule` rensar nu även `task_completions` (FK:n saknar cascade).
- **2. Ny regel dyker inte upp samma dag** — `createCustomRule` tar emot dagens `dailyLogId` och seedar en completion direkt.
- **4. Cardio-fel sväljs tyst** — `saveCardioWorkout` och `completeCardioSession` kastar nu; cardio-skärmen behåller sammanfattningen och visar Alert med möjlighet att spara igen.
- **5. Stats-skärmen saknar felhantering** — `loadError`-state + felkort med "Försök igen", samma mönster som dashboarden.
- **9. Streak-beräkning i stats** — använder nu `getStreak` från `dailyLog.ts` som räknar med dagens dag när den är klar.
- *(Bonus)* Wizardens löpprogram skapas nu som riktiga cardio-pass (`session_type: 'cardio'`) med passbeskrivningen i notes.

---

## 🔴 Bruten — åtgärda först

### 3. `notes`-kolumnen saknas troligtvis i databasen
Migrationen `supabase/migrations/20260703000001_session_notes.sql` har aldrig bekräftats körd.  
`SessionEditor` läser och skriver `notes` — om kolumnen saknas misslyckas sparandet tyst.  
**Fix:** Kör i Supabase Dashboard → SQL Editor:
```sql
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
```

---

## 🟡 Viktiga brister

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

---

## Migrationer som behöver köras

| Fil | Status | SQL att köra |
|-----|--------|-------------|
| `20260703000001_session_notes.sql` | ✅ Körd 2026-07-13 (via fix_custom_rules-queryn) | — |
| `20260706000002_session_type_cardio.sql` | ✅ Körd | — |
| `20260712000001_custom_task_templates.sql` | ✅ Körd | — |
| `20260713000001_fix_custom_rules.sql` | ✅ Körd 2026-07-13 (inkl. notes-kolumnen) | — |
