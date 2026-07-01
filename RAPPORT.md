# SeventyFive — Projektrapport
**Nawton AB** | Senast uppdaterad: 2026-07-01

---

## Översikt

**SeventyFive** är en mobilapp byggd av Nawton som hjälper användare att genomföra **75 Hard-utmaningen** — ett 75 dagars mentalt disciplinprogram skapat av Andy Frisella. Varje dag måste användaren klara fem fasta uppgifter utan undantag. Missar man en dag börjar man om från dag 1.

Appen är byggd med **Expo SDK 54** (React Native + TypeScript) och **Supabase** som backend.

---

## Teknikstack

| Kategori | Teknik |
|---|---|
| Ramverk | Expo SDK 54, Expo Router v6 (filbaserad routing) |
| Språk | TypeScript |
| UI | React Native, Ionicons |
| Backend | Supabase (PostgreSQL + RLS + Auth) |
| Autentisering | Supabase Auth (email/lösenord + Google OAuth) |
| Lagring | Supabase SecureStore-adapter |
| Animationer | React Native Reanimated v4, React Native Gesture Handler |
| Grafik | React Native SVG |
| Visuellt | Expo Linear Gradient, Expo Blur, Expo Haptics |
| Navigation | expo-router (tab-navigation + stack) |
| Övriga paket | expo-image-picker, expo-location, expo-notifications, react-native-body-highlighter |

---

## Databasschema (Supabase)

### Tabeller

**`profiles`**
Utökning av Supabase auth.users. Skapas automatiskt vid registrering.
- `name` — visningsnamn
- `avatar_url` — emoji-sträng eller bild-URL
- `subscription_status` — `trial` / `active` / `expired`
- `trial_started_at`, `payment_completed_at`

**`challenge_levels`**
De tre svårighetsgraderna (seedad, ändras ej av användare).
- `slug` — `normal` / `hard` / `extreme`
- `display_name` — t.ex. "Nawton Hard"
- `rules` — JSONB-array med regler per nivå

**`quiz_results`**
Sparar användarens svar från onboarding-quizet.
- `why_answer` — användarens formulerade "Varför"
- `goal_answers` — JSONB med målsvar
- `pressure_level` — 1 / 2 / 3

**`user_challenges`**
En aktiv utmaning per användare.
- `level_id` — koppling till challenge_levels
- `start_date` — utmaningens startdatum (kan bakdateras om användaren valt dag)
- `current_day` — aktuell dag (1–75)
- `status` — `active` / `completed` / `failed`

**`daily_logs`**
En rad per dag och utmaning.
- `day_number` — dag 1–75
- `status` — `pending` / `completed` / `failed`
- `fail_reason` — fritext om dagen missades

**`task_completions`**
En rad per uppgift och dag.
- `task_type` — `workout` / `diet` / `water` / `reading` / `photo`
- `completed` — boolean
- `completed_at` — tidsstämpel

**`user_schedules`**
Användarens dagschema (tider för uppvaknande, mat, träning).
- `wake_time`, `meal_times` (JSONB), `workout_times` (JSONB)
- `template_id` — vilket mall-schema som valdes (`5am` / `warrior` / `balanced` / `evening` / `custom`)

**`workout_sessions`** *(Anton)*
Träningspass kopplade till användarens schema.

**`workout_completions`** *(Anton)*
Registrerade genomförda träningspass med swipe-to-complete.

### Migrations
```
20260616_create_seventyfive_schema.sql   — Hela grundschemat
20260623_add_template_id_to_schedules.sql — Lägger till template_id
20260629_workout_sessions.sql            — Träningspass (Anton)
20260629_workout_completions.sql         — Träningskompletteringar (Anton)
```

---

## Appstruktur

```
app/
├── index.tsx                    — Startpunkt, läser session → routar
├── _layout.tsx                  — Root layout (GestureHandler, SafeArea)
│
├── (auth)/                      — Autentiseringsflöde (ingen tab-bar)
│   ├── welcome.tsx              — Välkomstskärm (animerad intro)
│   ├── login.tsx                — Inloggning + registrering
│   ├── quiz.tsx                 — Onboarding-quiz (3 frågor)
│   ├── recommendation.tsx       — Nivårekommendation + accept
│   └── schedule.tsx             — Dagschema-väljare
│
├── (app)/                       — Huvudapp (tab-navigation)
│   ├── _layout.tsx              — Tab-bar (5 flikar)
│   ├── dashboard.tsx            — Hemskärm
│   ├── activity.tsx             — Aktiviteter + träning (Anton)
│   ├── add.tsx                  — Snabb-lägg-till (mitten-knapp)
│   ├── stats.tsx                — Statistik + kalender
│   ├── settings.tsx             — Inställningar
│   └── edit-profile.tsx         — Redigera profil (dold från tab-bar)
│
├── workout-session.tsx          — Träningspass-editor (Anton)
├── workout-builder.tsx          — Träningspass-byggare (Anton)
├── cardio.tsx                   — Cardio-aktivitet med GPS (Anton)
└── exercise/[id].tsx            — Övningsdetaljsida (Anton)

src/
├── services/
│   ├── challenge.ts             — Utmaningslogik (skapa, hämta, beräkna dag)
│   ├── dailyLog.ts              — Daglig logg + uppgiftsavklarning
│   ├── profile.ts               — Profil (hämta, uppdatera, ladda upp avatar)
│   ├── schedule.ts              — Dagschema (spara, hämta)
│   ├── exercises.ts             — Övningsbibliotek (Anton)
│   ├── workouts.ts              — Träningspass (Anton)
│   └── workoutSchedule.ts       — Träningsschema (Anton)
│
├── components/
│   ├── FailModal.tsx            — Modal för att rapportera missad dag
│   ├── GlassCard.tsx            — Glassmorfism-kort-komponent
│   ├── StatBadge.tsx            — Statistikbricka
│   ├── SwipeableSessionCard.tsx — Swipe-to-complete träningskortet (Anton)
│   └── WeekStrip.tsx            — Veckoremsa-komponent
│
├── lib/
│   ├── supabase.ts              — Supabase-klient (SecureStore-adapter)
│   ├── oauth.ts                 — Google OAuth-hjälpare
│   ├── theme.ts                 — Delade färger + konstanter
│   └── muscles.ts               — Muskelgruppsdata (Anton)
│
├── stores/
│   └── workoutPlan.ts           — State för träningsplanering (Anton)
│
└── types/
    └── database.ts              — TypeScript-typer för alla DB-tabeller
```

---

## Skärmar och funktionalitet

### Välkomstflöde (auth)

#### `welcome.tsx` — Välkomstskärm
- Animerad intro med Reanimated (FadeIn, FadeInDown)
- Förklarar 75 Hard-utmaningens 5 dagliga uppgifter med ikoner
- Orange atmosfärisk glöd-gradient i bakgrunden
- Knapp: **"Starta dag 1 idag"** → går till inloggning
- Knapp: **"Jag har redan börjat — välj dag"** → öppnar dagväljare (dag 1–74) → skickar vald dag vidare i onboarding-flödet

#### `login.tsx` — Inloggning & Registrering
- Läge: **Logga in** / **Registrera** (växlar med en knapp)
- Vid registrering: namnfält + email + lösenord
- Vid registrering sparas namn direkt till `profiles`-tabellen
- Efter registrering → byter till inloggningsläge (redirectar ej direkt in i appen)
- Google OAuth-knapp ("Fortsätt med Google")
- Skickar `startDay`-parameter vidare om användaren valt dag på välkomstskärmen

#### `quiz.tsx` — Onboarding-quiz
- 3 frågor: Vad är ditt varför? / Vad är ditt mål? / Hur hårt vill du ha det?
- Progressindikator med prickar
- Sparar svar och skickar till rekommendationsskärmen

#### `recommendation.tsx` — Nivårekommendation
- Visar rekommenderad nivå baserat på quiz-svar
- Tre nivåer: **Normal**, **Hard**, **Extreme** — med olika regeluppsättningar
- Användaren kan byta nivå manuellt
- Om `startDay` är valt bakdateras `start_date` (dag 23 → startdatum 22 dagar bakåt)
- "Acceptera utmaningen" → skapar utmaning i databasen

#### `schedule.tsx` — Dagschema
- 5 fördefinierade mallar: The 5 AM Club, Morgonkrigaren, Balansen, Kvällspasset, Anpassat
- Tider för uppvaknande, 3 måltider, 2 träningspass
- Tapping en mall pre-fyller alla tidsväljarar
- Sparar `template_id` till databasen
- Kan nås från Inställningar (`?from=settings`) för att redigera befintligt schema

---

### Huvudapp (tab-navigation)

#### Tab-bar — 5 flikar
| Flik | Ikon | Skärm |
|---|---|---|
| Hem | Hus | dashboard.tsx |
| Aktivitet | Kropp | activity.tsx |
| Lägg till | + (orange cirkel) | add.tsx |
| Statistik | Stapeldiagram | stats.tsx |
| Profil | Person | settings.tsx |

---

#### `dashboard.tsx` — Hemskärm *(senast uppdaterad)*

**Design: Cinematisk/3D-stil**
- Mörk bakgrund (`#0A0A0B`) med orange atmosfärisk glöd (LinearGradient)
- Tidsbaserad hälsning: God morgon / God eftermiddag / God kväll / God natt
- Dynamisk undertext baserat på tid och framsteg

**Hero-kort (3D floating)**
- Kontinuerlig 3D-tilt-animation (Reanimated perspective + rotateX/rotateY)
- Dag-nummer (stor typografi 70pt)
- Level-badge (t.ex. "NAWTON HARD")
- Challenge-procent + tunn progress-bar
- Animerad SVG progress-ring (höger sida) — fyller upp i takt med avklarade uppgifter
  - Orange → grön när alla uppgifter är klara
  - Animerad med `useAnimatedProps` + `strokeDashoffset`

**Uppgiftsgrid**
- 2-kolumns grid istället för lång lista
- Varje kategori har unik färg:
  - Träning: Orange `#FF8F00`
  - Vatten: Cyan `#00BCD4`
  - Kost: Grön `#66BB6A`
  - Läsning: Lila `#AB47BC`
  - Foto: Rosa `#EC407A`
- Kompakta kort med ikon + namn + checkbox
- Orange sidolist på avklarade kort
- Haptic feedback (light) vid toggle
- Success-vibration när alla uppgifter är klara

**Övriga funktioner**
- "Rapportera dag missad" → öppnar FailModal med fritextanledning
- Profilavatar (emoji eller foto) klickbar → navigerar till Inställningar
- `useFocusEffect` uppdaterar namn/avatar tyst vid återkomst

---

#### `activity.tsx` — Aktivitet *(Anton)*
- Träningsbibliotek med kategorifilter
- GPS-spårning för cardio-aktiviteter
- Vertical ScrollView med sticky horisontellt filter (löser clipping-bugg)

#### `add.tsx` — Snabb-lägg-till
- Mitten-knappen i tab-baren (orange cirkel med +)

#### `stats.tsx` — Statistik
- 75-dagars kalenderrutnät
- Visualiserar klarade/missade/pågående dagar

#### `settings.tsx` — Inställningar
- **Profil-kort** — klickbar → navigerar till Redigera profil
  - Visar emoji-avatar eller initialer
  - Liten pennbricka på avataren
- **Aktiv utmaning** — nivå, startdatum, aktuell dag
- **Schema** — navigerar till schema-editorn
- **Notiser** — Push-notis-toggle (kräver dev-build, ej Expo Go)
- **App** — version, integritetspolicy
- **Konto** — Logga ut

#### `edit-profile.tsx` — Redigera profil
- Visningsnamn (redigerbart)
- E-post (låst, visas med låsikon)
- **Emoji-avatar-väljare** (bottom sheet modal)
  - 24 emojis i 3 kategorier: Träning, Motivation, Livsstil
  - Val: Foto (via kamera/galleri), Bokstav (initialer), Emoji
- Foto-uppladdning via `expo-image-picker` (kräver Supabase Storage-bucket för full funktion)
- Sparar namn + avatar till `profiles`-tabellen

---

### Träningsflöde *(Anton)*

#### `workout-session.tsx` — Träningspass-editor
- Skapa och redigera träningspass
- Övningssökning med filterpills och fullskärms-picker

#### `workout-builder.tsx` — Träningspass-byggare
- Bygg egna träningsprogram

#### `cardio.tsx` — Cardio med GPS
- Spårar löpruntt via `expo-location`
- Karta och distansmätning

#### `exercise/[id].tsx` — Övningsdetaljsida
- Detaljvy för enskild övning

---

## Autentiseringsflöde

```
Appstart (index.tsx)
  └── getSession() [SecureStore, ingen nätverksanrop]
      ├── Session finns → /(app)/dashboard
      └── Ingen session → /(auth)/welcome

Dashboard
  └── getActiveChallenge()
      ├── Utmaning finns → visa dashboard
      └── Ingen utmaning → /(auth)/quiz
```

**Viktigt:** Ingen `onAuthStateChange`-lyssnare används. Session läses från SecureStore vid start.

---

## Profil & Avatar

- `avatar_url` i `profiles`-tabellen lagrar antingen:
  - En emoji-sträng (t.ex. `💪`) — visas direkt
  - En HTTPS-URL — visas som bild
  - `null` — visar initialer
- Alla skärmar som visar avatar kontrollerar om värdet börjar med `http` för att avgöra renderingssätt

---

## Schema-mallar

| ID | Namn | Uppvaknande |
|---|---|---|
| `5am` | The 5 AM Club | 05:00 |
| `warrior` | Morgonkrigaren | 06:00 |
| `balanced` | Balansen | 07:00 |
| `evening` | Kvällspasset | 08:00 |
| `custom` | Anpassat | Användaren väljer |

---

## Framtida funktioner (planerade)

### Betalmodell
- **2 veckors gratis provperiod** för nya användare
- Därefter prenumeration (implementeras med RevenueCat eller Stripe)
- `subscription_status`-fältet finns redan i `profiles`-tabellen (`trial` / `active` / `expired`)
- Kräver: paywall-skärm, prenumerationshantering, "paused"-status på utmaningar

### Planerade förbättringar
- Streak-räknare (faktiska databas-queries på daily_logs)
- Veckokalender-remsa på hemskärmen
- Push-notiser med personliga påminnelser (kräver dev-build)
- Profilfoto-uppladdning till Supabase Storage (kräver avatars-bucket)
- Google OAuth (Anton)
- AI-coach-funktionalitet (Anton)
- Fler träningsfunktioner (Anton)

---

## Ansvarsfördelning

| Område | Ansvarig |
|---|---|
| Onboarding, profil, inställningar, hemskärm | Nawid |
| Träning, övningar, cardio, AI, backend, betalning | Anton |

---

## Versionshistorik (commits)

| Datum | Commit | Beskrivning |
|---|---|---|
| Start | `4309b3e` | Initial commit |
| — | `95fb935` | Inloggningsskärm med email/lösenord |
| — | `4dac38f` | Tab-navigation med platshållarskärmar |
| — | `7cd0561` | Dashboard med daglig uppgiftslista |
| — | `50823a1` | Onboarding-quiz + nivårekommendation |
| — | `61074c8` | Supabase-koppling till quiz, recommendation, dashboard |
| — | `eb9a986` | Stats-skärm med 75-dagarskalender |
| — | `e07e1d9` | Missad dag-flöde med FailModal |
| — | `4e54c08` | Settings-skärm |
| — | `ff1b989` | Fix: native fetch-polyfill |
| — | `37a1c6c` | Fix: auth-routing, dayFailed, delade teman |
| — | `20bcdd7` | Schema-skärm (onboarding steg 5) |
| — | `36a908b` | Google OAuth |
| — | `fcfa710` | Fix: ta bort getActiveChallenge från startup |
| — | `cb6d0d0` | Fix: activity-skärm single ScrollView |
| — | `faad15f` | Avatar-väljare med foto + emoji |
| — | `bec3753` | Redigera profil: pennknapp + bottom sheet |
| — | `eb5f1ac` | Dashboard uppdaterar namn/avatar vid återkomst |
| — | `4dbc536` | Fix: expo-notifications-krasch i Expo Go |
| — | `12b95db` | Redesign träningsskärm + workout tracking |
| — | `e03ad14` | Swipe-to-complete träningspass |
| — | `234225e` | react-native-worklets peer dep |
| 2026-06-30 | `e58998a` | Namnfält vid registrering, redirect till login |
| 2026-06-30 | `937b807` | Animerad välkomstskärm + dagväljare-flöde |
| 2026-06-30 | `057f5b1` | Fix: worklets 0.5.1 (Expo Go SDK 54) |
| 2026-07-01 | `c01f8f7` | Cinematisk hemskärm med 3D-animation + SVG-ring |

---

*Rapporten uppdateras manuellt vid större förändringar.*
