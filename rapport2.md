# SeventyFive — Komplett teknisk revision

**Datum:** 2026-07-31
**Metod:** Fyra parallella granskningar (arkitektur/kodkvalitet, säkerhet/databas/API, GitHub/CI-CD/test/dokumentation, tillgänglighet/UX/App Store/monitoring) mot faktisk kod — inte mot `RAPPORT.md`/`ROADMAP.md` som visade sig vara delvis inaktuella. Inga filer har ändrats i samband med revisionen. 330 TS/TSX-filer, 866+ commits, 85 SQL-migrationer, 105 testfiler (842 tester).

---

## Helhetsbetyg per område

| Område | Betyg (1–10) | Motivering |
|---|---|---|
| Arkitektur | 6/10 | Tydlig service-lager-struktur, ingen cirkulär import, men `AuthContext` byggd och ignorerad, `workoutPlanStore` inte reaktiv |
| Kodkvalitet | 6/10 | Bra kommentarer och namngivning, men flera 1000+-radersfiler, 44 `any`, ingen ESLint |
| Säkerhet | 7/10 → **8/10** (2026-07-31) | Anmärkningsvärt välhärdad RLS (36 tabeller, `SECURITY DEFINER`-mönster, PKCE OAuth, SecureStore). `organization_members`-policyn skopad och filuppladdningar begränsade sedan ursprungsrevisionen. |
| Databas | 8/10 | 85 genomtänkta migrationer, korrekt cascade, index på hot paths. (Den flaggade `reports`-schemakonflikten var redan åtgärdad innan revisionen — falskt larm.) |
| Prestanda | 5/10 | Ingen caching, ingen `expo-image`, ingen offline-hantering, men bra pagination på flödet och läckagefri realtime-cleanup |
| Testning | 8/10 → **9/10** (2026-07-31) | 848+ tester, verkliga beteendetester. Stripe-webhooken och `subscription.ts` (betalstatuslogiken) har nu 100% coverage — kvar: `organizations.ts` (67%), ingen E2E, ingen `coverageThreshold` i CI |
| Tillgänglighet | 1/10 | 0 av 1 025 interaktiva element har `accessibilityLabel`/`-Role` |
| CI/CD | 1/10 | Ingen `.github/workflows`, ingen lint, ingen `eas.json` |
| App Store-readiness | 4/10 | Bra ikoner/policy-text, men saknar buildNumber, publik policy-URL och har ett Apple-compliance-riskmoment (Stripe-in-browser) |

---

## Genomfört hittills (2026-07-31)

Arbetat igenom i ordningen: **Säkerhet** (RLS/storage/schema) → **`cardio.tsx`-refaktorering** → **Betalningskritisk testning**. Allt verifierat med `tsc --noEmit` + full testsvit grön efter varje fil, committat av användaren själv i separata commits.

- ✅ **`organization_members`-RLS för bred** — skopad via `SECURITY DEFINER`-funktioner (`is_org_member`/`is_org_admin`), ny migration `20260731000012_org_members_rls_fix.sql`.
- ✅ **Storage-buckets utan storleks-/typgräns** — `file_size_limit`/`allowed_mime_types` satt på `avatars`/`progress-photos`/`pass-photos`, migration `20260731000013_storage_bucket_limits.sql`.
- ✅ **`pass-photos` städas inte vid kontoradering** — samt en **ny bugg hittad under verifiering**: avataren rensades aldrig alls (listades som mapp men lagras platt som `<uid>.jpg`). Fixat i ny `src/services/account.ts`.
- ✅ **`profiles.name` saknar CHECK-constraint** — tillagd (`NOT VALID`, rör inte historiska rader), migration `20260731000014_profiles_name_check.sql`.
- ✅ **Svagt lösenordsgolv** — höjt 6→8 tecken (`supabase/config.toml` + klientvalidering i `login.tsx`). CAPTCHA **inte** gjort (kräver tredjepartskonto, medvetet uppskjutet).
- ✅ **Verifierat, inget att göra:** `reports`-tabellens schemakonflikt (Hög prioritet-listan, Quick win #6, Lanseringschecklista) var redan åtgärdad i en tidigare migration (`20260725000004`) — falskt larm i ursprungsanalysen.
- ✅ **`cardio.tsx` 3242 rader** — delat i `app/cardio.tsx` (1339 rader, ren JSX), `src/components/cardio/useCardioSession.ts` (GPS/timer/röst-motorn, 909 rader), `styles.ts` (1035 rader), `constants.ts` (65 rader). Modal-uppdelning (Steg 2) medvetet **inte** gjord — cardio.tsx bedömdes redan hanterbart.
- ✅ **`subscription.ts` branch-coverage 61,8%→100%** — 5 nya testfall (null-fält, livstidsprenumeration, kundportal-felvägar).
- ✅ **Stripe-webhooken, noll testtäckning→100%** — logik extraherad till `supabase/functions/stripe-webhook/logic.ts` (Deno-oberoende), 13 nya tester.

**Inte påbörjat:** Tillgänglighet, CI/CD, App Store-readiness (buildnummer/eas.json/publik policy-URL/Apple IAP), GitHub-hygien (LICENSE, `.env.example`, git-taggar), övriga refactoring-kandidater (`dashboard.tsx`, `group.tsx`, `AuthContext`-adoption), prestandaförbättringar (`expo-image`, caching). Se roadmapen nedan för nästa steg — **Vecka 1**-blockerarna för App Store-inlämning är fortfarande de mest kritiska.

---

## Kritiska problem

### 1. Noll tillgänglighet (WCAG/VoiceOver/TalkBack) — betyg 1/10
`grep` efter `accessibilityLabel|accessibilityRole|accessibilityHint|accessible=` i hela `app/` och `src/components/` gav **0 träffar** mot 1 025 interaktiva element (981 `TouchableOpacity`, 35 `Pressable`). En skärmläsaranvändare kan inte navigera appen. Detta är sannolikt ett verkligt avslagsskäl vid App Store-granskning och en legal risk (ADA/EN 301 549) för en betalapp.

*Fix:* Minimiinsats före lansering — lägg `accessibilityRole="button"` + `accessibilityLabel` på alla ikonknappar (hamburgermenyer, tillbaka-pilar, stäng/lägg till-knappar). SVG-ringarna på dashboard/streak/stats behöver textbeskrivning av vad de visar numeriskt.

### 2. Apple IAP-compliance — betalningsflödet kan underkännas i App Store-granskning
`docs/stripe-setup.md` bekräftar själv att Stripe-checkout öppnas i webbläsare istället för Apples In-App Purchase, och flaggar det som en "gråzon" mot Guideline 3.1.1 (digitala prenumerationer måste gå via Apples IAP med 30% avgift). Teamet är redan medvetna, men detta är olöst och kan blockera hela iOS-lanseringen.

*Fix:* Antingen implementera Apple IAP som parallell betalväg på iOS, eller (om Stripe-only ska behållas) förbered ett tydligt case för granskarna — men räkna med avslag om inget görs.

### 3. ✅ KLART — `cardio.tsx` är 3 242 rader — en enda fil för GPS-spårning, timer-motor, röstcoaching, karta, modaler och 23 `useState`
Det största underhållsriskmomentet i appen. En bugg här (t.ex. i timer-cleanup eller state-race) är mycket svår att isolera.

*Fix:* Bryt ut en `useCardioSession`-hook (state/affärslogik) + presentational-komponenter för karta/HUD/kontroller/modaler — samma mönster som redan används för gympass (`SessionEditor`/`SessionFullscreen`).

*Status:* `useCardioSession`-hooken extraherad (`src/components/cardio/useCardioSession.ts`), `cardio.tsx` nu 1339 rader. Modal-uppdelningen till presentational-komponenter är medvetet inte gjord (bedömdes tillräckligt hanterbart efter hook-extraktionen).

### 4. ✅ KLART — Stripe-webhooken har noll automatiserad testtäckning
`supabase/functions/stripe-webhook` är exkluderad från `tsconfig.json` (`exclude: supabase/functions`) och finns inte i något av de 105 testfilerna. Detta är koden som faktiskt växlar en användares betalstatus — den mest kritiska koden i hela appen för intäkter, och den är helt otestad, inte ens typkontrollerad.

*Fix:* Lägg till Deno-test för webhook-signaturverifiering + status-mappning, och inkludera `supabase/functions` i en separat `tsc`-körning i CI.

*Status:* Logiken extraherad till `logic.ts` (Deno-oberoende) och testad — 100% coverage, 13 tester. `supabase/functions` är fortfarande exkluderad från `tsc --noEmit` (kvarstår, hör ihop med CI/CD-arbetet).

### 5. Saknar `ios.buildNumber`/`android.versionCode` och `eas.json` — blockerar faktisk inlämning
`app.json` har bara `"version": "1.0.0"`, ingen build-räknare. Ingen `eas.json` alls finns i repot, så det finns idag inget sätt att bygga en produktionsversion.

*Fix:* Lägg till `eas.json` med development/preview/production-profiler och `ios.buildNumber`/`android.versionCode` (eller låt EAS auto-inkrementera).

### 6. Integritetspolicyn finns bara i appen, inte på en publik URL
Koden själv (`app/(app)/privacy-policy.tsx:11`, kommentar) säger explicit att samma text måste publiceras publikt inför App Store-inlämning — det är alltså inte gjort än. App Store Connect kräver en publikt nåbar policy-URL oberoende av appen.

*Fix:* Publicera policytexten på `nawton.net` eller liknande, koppla URL:en i App Store Connect-metadata.

---

## Hög prioritet

- **Ingen ESLint/Prettier i hela repot.** Ändå finns 6 `// eslint-disable-next-line`-kommentarer i koden — döda kommentarer utan verktyg som någonsin kontrollerat besluten. Lägg till `eslint-config-expo` + `lint`-script.
- **Ingen CI/CD.** `.github/workflows/` existerar inte. Inget stoppar en trasig commit från att nå `main`. Se konkret pipeline nedan.
- **`AuthContext` byggd men oanvänd.** `src/lib/auth.tsx` exporterar `useAuth()` men har **0 konsumenter** — istället anropar **36 filer** `supabase.auth.getSession()` var för sig i egna `useEffect`. Slöseri + inkonsekvent state.
- **Ingen caching, varje skärmbyte hämtar om allt från Supabase.** T.ex. `getProfile()` anropas oberoende från 18 olika ställen. Ingen React Query/SWR i projektet.
- ✅ **KLART** — ~~**`organization_members`-policyn är för bred:**~~ `USING (auth.uid() IS NOT NULL)` gjorde att vilken inloggad användare som helst kunde läsa medlemskap, roller och delningsinställningar för *alla* föreningar. Skopad via `is_org_member`/`is_org_admin`.
- ✅ **KLART** — ~~**Filuppladdningsbuckets saknar storleks-/typbegränsning.**~~ `file_size_limit`/`allowed_mime_types` satt på alla tre buckets.
- ✅ **KLART** — ~~**`pass-photos` städas inte vid kontoradering.**~~ Fixat i `src/services/account.ts`, som samtidigt löste en tidigare okänd bugg (avataren rensades aldrig).
- ✅ **VERIFIERAT, INGET ATT GÖRA** — ~~**Schemakonflikt i `reports`-tabellen — trolig live-bugg.**~~ Redan åtgärdad i migration `20260725000004` innan denna rapport skrevs; klient och edge-funktion använder konsekvent `target_kind`/`details`. Falskt larm i ursprungsanalysen.
- **`npm audit`: 15 sårbarheter (13 moderate, 2 high)** via en transitiv `uuid`-brist i `@expo/config-plugins`. `npm audit fix --force` skulle tvinga en brytande uppgradering till Expo 57 — gör **inte** det blint, planera en skopad uppgradering.
- **Ingen `expo-image`.** Alla 25+ bildvisande filer använder RN:s inbyggda `Image` utan disk-/minnescache eller blurhash-placeholder — påtagligt för en app centrerad kring dagliga framstegsfoton.
- **`FeedWorkoutCard` är inte memoiserad** och får 4 nyskapade inline-callbacks per render i `community.tsx` — varje state-ändring i föräldern re-renderar hela flödet.
- **Ingen offline-hantering.** Ingen NetInfo-dependency alls. En träningsapp som troligen används i gym/utomhus med dålig täckning har inget sätt att visa "du är offline" — misslyckade anrop syns bara som generiska fel eller sväljs tyst.
- **Onboarding kan hoppas över vid app-krasch mitt i flödet.** `app/index.tsx` routar enbart på om en session finns — inte på om quiz/schema är klara. Dödar man appen mitt i quizet och startar om hamnar man rakt på dashboard utan utmaning.

---

## Medium

- **LICENSE-filen är Expos egen MIT-licens, copy-pastead** — copyright tillskriven "650 Industries, Inc. (aka Expo)", inte Nawton, trots att appen är privat/kommersiell (`"private": true`). `package.json` säger dessutom `"license": "ISC"` — motsägelsefullt. Ta bort filen eller ersätt med en proprietär notis, sätt `"license": "UNLICENSED"`.
- **Inga git-taggar** (`git tag -l` tomt) trots att lansering är nära — ingen spårbarhet mellan commit och inskickad build.
- **`.env.example` saknas helt.** README beskriver variablerna i löptext men det finns ingen kopierbar mall, och Stripe-secrets är dokumenterade separat i `docs/stripe-setup.md` utan en samlad källa.
- **`workoutPlanStore` är en icke-reaktiv modul-singleton** (`src/stores/workoutPlan.ts`) — komponenter som läser den re-renderar inte vid extern `set()`. Kontrasterar mot `src/lib/i18n.ts` som har korrekt pub-sub för samma typ av problem.
- **44 `any`-användningar**, en del i legitima catch-block men flera i faktiska typluckor (t.ex. `dashboard.tsx:635`, `GymTab.tsx:162-174`, mapper-funktioner i `dailyLog.ts`/`workoutSchedule.ts` som borde använda `Database`-typerna).
- **285 hårdkodade hex-färger** utanför `src/lib/theme.ts`, flera dupliceringar av redan definierade temavärden — drift-risk när paletten ändras.
- **Otillräcklig kontrast i ljust tema:** `TEXT_SECONDARY #75777D` på `BG #F5F5F7` ger 4,11:1 — under WCAG AA-gränsen (4,5:1) för normal text.
- **`Dimensions.get('window')` på modul-nivå i 22 filer** istället för `useWindowDimensions` — layoutvärden fryser vid första laddning, uppdateras inte vid rotation/foldables.
- 🟡 **DELVIS KLART** — ~~**Svagt lösenordsgolv (6 tecken) och ingen CAPTCHA vid registrering**~~ (`supabase/config.toml`) — golvet höjt till 8 tecken. CAPTCHA kvarstår (kräver tredjepartskonto hos hCaptcha/Turnstile).
- ✅ **KLART** — ~~**`profiles.name` saknar `CHECK`-constraint**~~ för längd, till skillnad från `groups.name`/`organizations.name` som har det.
- **Behörighetssträng-kollision:** både `expo-image-picker` och `expo-camera` sätter kameratillstånd med olika texter ("progressfoton" vs "skanna QR-koder") — endast en vinner i den slutgiltiga `Info.plist`, bör verifieras med en faktisk EAS-build.
- **`isIosBackgroundLocationEnabled: true` utan `UIBackgroundModes`/`NSLocationAlwaysAndWhenInUseUsageDescription`** — bakgrundsspårning är deklarerad men sannolikt icke-fungerande som konfigurerad.
- **Ingen support-/marketing-URL i `app.json`.**
- **Ingen `coverageThreshold`** i jest-konfigurationen — täckning kan tysta försämras utan att något CI-steg fångar det (eftersom CI inte ens finns).

---

## Låg

- Inget CODEOWNERS, ingen Dependabot, inga issue/PR-mallar, ingen CONTRIBUTING/CHANGELOG.
- Path-alias (`@/*`) täcker bara `src/`, inte `app/`.
- Endast en barrel-export i hela kodbasen (`src/lib/exerciseInfo/index.ts`).
- `assets/splash-icon.png` finns men är inte kopplad till någon `splash`-konfiguration i `app.json` — troligen oanvänd fil.
- `app.json`-behörighetstexter finns bara på svenska trots att appen har engelskt UI-språk.
- En enstaka svag commit-message (`"debug: fixed language issue"`) i en i övrigt ovanligt bra commit-historik.

---

## Quick Wins

Låg kostnad, hög effekt — gör dessa först:

1. Lägg till `.env.example` med alla variabler (inkl. Stripe-secrets som idag bara står i `docs/stripe-setup.md`).
2. Fixa `LICENSE`/`package.json`-licensfältet.
3. Lägg till `ios.buildNumber`/`android.versionCode` i `app.json`.
4. Installera `eslint-config-expo`, lägg till `lint`-script och `tsc --noEmit`-script.
5. ✅ **KLART** — ~~Fixa `organization_members`-RLS-policyn~~
6. ✅ **VERIFIERAT, INGET ATT GÖRA** — ~~Reconcilea `reports`-tabellens kolumnnamn~~ (redan gjort i tidigare migration)
7. ✅ **KLART** — ~~Sätt `file_size_limit`/`allowed_mime_types` på storage-buckets~~ (via migration, inte dashboard)
8. ✅ **KLART** — ~~Lägg till `pass-photos`-rensning i kontoraderingsflödet~~
9. Tagga release-commiten (`git tag v1.0.0-rc1`).
10. Ring `Sentry.setUser({id})` efter inloggning för att koppla krascher till användare.
11. Lägg till `coverageThreshold` i jest-konfigurationen.

---

## Refactoring

- ✅ **KLART** — ~~**Dela upp `cardio.tsx` (3 242 rader)**~~ — se Kritiska problem #3.
- Dela upp `dashboard.tsx` (1 218 rader, 19 `useState`), `group.tsx` (1 054 rader), `records.tsx` (974 rader), `ScheduleWizard.tsx` (984 rader, 12 flata `useState` — kandidat för `useReducer`), `SessionFullscreen.tsx` (917 rader), `ExercisePickerSheet.tsx` (809 rader).
- Flytta hooks utspridda i `src/lib/*.ts` (t.ex. `useHeroChrome`, `useCardChrome` i `theme.ts`) till en dedikerad `src/hooks/`.
- Ersätt de 36 dubblerade `getSession()`-anropen med det redan byggda `useAuth()`.
- Gör `workoutPlanStore` reaktiv (enkel pub-sub som `i18n.ts`, eller inför Zustand om fler globala state-behov uppstår).
- Ersätt `any`-mappers i `dailyLog.ts`/`workoutSchedule.ts`/`GymTab.tsx` med `Database`-typerna från `src/types/database.ts`.

---

## Säkerhetsrisker

| Risk | Nivå | Beskrivning |
|---|---|---|
| `organization_members` SELECT-policy för bred | **Medium** | ✅ **KLART** — skopad via `is_org_member`/`is_org_admin` |
| Filuppladdning utan storlek/typ-validering på bucket-nivå | **Medium** | ✅ **KLART** — `file_size_limit`/`allowed_mime_types` satt |
| `pass-photos` rensas inte vid kontoradering | **Medium** | ✅ **KLART** — samt en tidigare okänd avatar-bugg fixad samtidigt |
| Historiskt läckt webhook-secret i git-historik | **Medium (åtgärdat, men kvar i historik)** | Kvarstår — kräver destruktiv git-historik-rensning, inte gjort utan explicit godkännande |
| Svagt lösenordsgolv (6 tecken), ingen CAPTCHA | **Low/Medium** | 🟡 Golv höjt till 8 tecken, CAPTCHA kvarstår |
| `profiles.name` utan CHECK-constraint | **Low** | ✅ **KLART** |

**Positivt att notera** (ovanligt bra för teamets storlek): 36 tabeller har RLS aktiverat, `SECURITY DEFINER`-funktioner används korrekt för att undvika RLS-rekursion, PKCE-flöde på OAuth, tokens i SecureStore (inte AsyncStorage), Stripe-webhook har HMAC-verifiering med replay-skydd, `advance_challenge_days` är korrekt spärrad mot anon-nyckel-anrop, inga N+1-mönster hittades i service-lagret, ingen SQL-injektionsyta (allt parametriserat via `.rpc()`).

---

## Prestandaförbättringar

1. Inför `expo-image` för cache, blurhash och prioriterad laddning — särskilt värdefullt för det bildtunga profilfotoflödet.
2. Inför en enkel caching-strategi (React Query eller motsvarande) i `src/services/` för att sluta hämta om samma data (profil, utmaning) från varje skärm.
3. Memoisera `FeedWorkoutCard` och stabilisera callbacks i `community.tsx`s `renderItem` med `useCallback`.
4. Lägg till paginering på `messages.ts` (idag hård gräns på 400/200 rader utan "ladda fler") och `fetchUserWorkouts` (hård gräns 500 rader).
5. Inför bild-CDN/transformering (Supabase Image Transform, Pro-funktion) inför skalning till 100k+ användare — idag serveras originalfiler oavsett om det är en tumnagel eller helskärmsvy.
6. Konsolidera de tre realtidskanalerna per användare (`dm-`, `follows-`, `social-`) inför 10k+ samtidiga sessioner.
7. Inför NetInfo för offline-detektion och en enhetlig retry/felyta (dagens `.catch(() => {})`-mönster i `feed.ts` gör nätverksfel omöjliga att skilja från "inget innehåll än").

---

## Dokumentation som saknas

Prioritetsordning:
1. `.env.example` (billigast, förhindrar onboarding-/katastrofåterställningsproblem)
2. Samlad checklista för alla Stripe-secrets (idag utspridda i `docs/stripe-setup.md`)
3. Release-/versionshanteringsguide (hänger ihop med `eas.json`-arbetet)
4. Lösning av Apple IAP-compliance (legal risk, inte bara dokumentation)
5. API-/edge function-referens för `supabase/functions/` (betalningskritisk yta utan kontraktdokumentation)
6. ADR:er för redan tagna beslut (Stripe-i-webbläsare, single-branch-arbetsflöde)
7. Visuellt ER-diagram (RAPPORT.md har textbeskrivning men ingen graf)

---

## GitHub-förbättringar

- Skapa `.github/workflows/` (se CI/CD nedan).
- Lägg till `CODEOWNERS` — särskilt värdefullt kring betalningskoden (`src/services/subscription.ts`, `supabase/functions/`).
- Aktivera Dependabot (`.github/dependabot.yml`) — 15 kända sårbarheter just nu utan bevakning.
- Branch protection på `main` (kräv PR/grönt CI) innan repot öppnas för fler bidragsgivare eller automatisering med skrivrättigheter.
- Git-taggar för varje inskickad App Store/Play-version.
- Fixa LICENSE-filen (se Medium).
- (Lägre prioritet för ett 2-personsteam:) CONTRIBUTING.md, issue-/PR-mallar, CHANGELOG.

**Positivt:** README är ovanligt komplett för ett litet team, `.gitignore` är korrekt konfigurerad, inga secrets har någonsin committats, commit-meddelanden är ovanligt beskrivande trots att de inte följer Conventional Commits.

---

## CI/CD-förbättringar

Ingen pipeline finns idag. Konkret rekommenderad struktur:

```yaml
# .github/workflows/ci.yml — körs på varje PR + push till main
jobs:
  lint:
    steps: [checkout, setup-node, npm ci, npm run lint]      # kräver eslint-config-expo tillagd
  typecheck:
    steps: [checkout, setup-node, npm ci, npx tsc --noEmit]
    # separat pass för supabase/functions (idag helt exkluderad från typkontroll)
  test:
    steps: [checkout, setup-node, npm ci, npx jest --coverage --ci]
    # coverageThreshold i package.json så bygget kan fela vid regression
  audit:
    steps: [checkout, npm audit --omit=dev --audit-level=high]

# .github/workflows/eas-preview.yml — på PR (kräver eas.json)
jobs:
  eas-build-preview:
    steps: [checkout, setup-node, npm ci, eas build --profile preview --platform all --non-interactive]

# .github/workflows/release.yml — på tag-push (v*.*.*)
jobs:
  build-and-submit:
    needs: [lint, typecheck, test, audit]
    steps:
      - eas build --profile production --platform all --non-interactive
      - eas submit --platform ios --latest
      - eas submit --platform android --latest
```

Förutsättningar som måste vara på plats innan pipelinen är körbar: `eas.json` med build-profiler, ESLint-konfiguration, `tsc --noEmit`-script, `coverageThreshold`, och ett beslut om `expo-updates`/OTA för att kunna hotfixa JS-buggar utan full butiksgranskning (idag kräver varje fix en ny inlämning).

---

## Arkitekturförbättringar

- Extrahera hooks från `src/lib/*.ts` till `src/hooks/`.
- Adoptera det redan byggda `AuthContext`/`useAuth()` överallt istället för 36 egna `getSession()`-anrop.
- Gör `workoutPlanStore` reaktiv.
- Överväg en tunn view-model/hook-nivå för affärslogik som idag ligger direkt i skärmkomponenter (t.ex. feed-sammanslagning i `activities.tsx`, nivåregeltolkning i `dashboard.tsx`) — inte akut vid nuvarande skala, men blir dyrare att flytta ju mer appen växer.
- Ingen dependency injection eller repository-pattern behövs vid denna skala — nuvarande "services som funktioner"-mönster är en rimlig avvägning för ett 2-personsteam.

---

## Teststrategi

**Nuläge (starkt):** 842 tester, 103 test-suiter, 85,4% statement-coverage / 75,8% branch-coverage. Verkliga beteendetester (inte ytliga snapshot-tester) — t.ex. `subscription.test.ts` täcker faktiska edge-cases i premium-status. `jest.setup.js` har en välorganiserad mockstrategi.

**Kritiska luckor:**
1. ✅ **KLART** — ~~**Stripe-webhooken har noll testtäckning**~~ — logik extraherad + 100% coverage, 13 tester.
2. ✅ **KLART** — ~~**`subscription.ts` har bara 64,7% branch-coverage**~~ på just betalningsstatuslogiken — nu 100% statement/branch/function-coverage.
3. **`organizations.ts` svagast testade servicen** (67,3% statements / 58,7% branch).
4. **Ingen E2E** för hela flödet registrering → provperiod → betalvägg → köp → premiuminnehåll.
5. Ingen `coverageThreshold` betyder att dessa luckor kan växa tyst utan att något stoppar det.

**Rekommendation:** Prioritera testning av `subscription.ts`s otestade grenar och Stripe-webhooken innan lansering — det är den kod där ett fel direkt kostar pengar eller ger bort appen gratis.

---

## Lanseringschecklista

**Blockerar inlämning:**
- [ ] `eas.json` + `ios.buildNumber`/`android.versionCode`
- [ ] Publik URL för integritetspolicyn
- [ ] Lös Apple IAP-compliance (Guideline 3.1.1) eller förbered granskarargument
- [ ] Verifiera att Sentry-DSN faktiskt sätts i produktionsbygget (koden är korrekt gated men värdet måste finnas i EAS-secrets)
- [ ] Verifiera vilken kamerabehörighetssträng som faktiskt hamnar i `Info.plist` (kollision mellan `expo-image-picker`/`expo-camera`)

**Bör göras före lansering (hög risk annars):**
- [ ] Minimal tillgänglighetspass (accessibilityLabel på ikonknappar minst)
- [x] Fixa `organization_members`-RLS
- [x] Sätt storleksgränser på storage-buckets
- [x] Rensa `pass-photos` vid kontoradering
- [x] Reconcilea `reports`-tabellschemat (verifierat redan gjort)
- [x] Testa Stripe-webhooken
- [ ] `npm audit`-plan (inte blint `--force`)

**Kan vänta till strax efter lansering:**
- [ ] CI/CD-pipeline
- [ ] ESLint/Prettier
- [ ] Analytics (PostHog rekommenderas — se Monitoring)
- [ ] Offline-hantering
- [ ] Caching-lager / `expo-image`

---

## Teknisk skuld

Sammanfattat, i fallande storleksordning på "ränta" (kostnad om det inte åtgärdas snart):

1. Noll CI/CD + noll lint → varje ny bugg av den typ som redan finns (oanvänd `useAuth`, schemamismatch i `reports`) kommer fortsätta smyga sig in obemärkt.
2. `cardio.tsx` och systerfilerna över 900 rader → varje ny funktion i dessa filer blir dyrare att lägga till och farligare att testa.
3. Ingen caching/`expo-image` → växer till en påtaglig prestanda- och kostnadsfråga vid 100k+ användare (se Skalbarhet).
4. Tillgänglighet på 0 → blir exponentiellt dyrare att lägga till retroaktivt över 1000+ komponenter än att bygga in från start.
5. `AuthContext` byggd men ignorerad → varje ny skärm som kopierar `getSession()`-mönstret istället för att använda kontexten förvärrar skulden.

---

## Prioriterad roadmap

**Vecka 1 (blockerare för inlämning):**
`eas.json` + buildnummer → publicera policy-URL → lös Apple IAP-frågan → ~~fixa RLS-policyn för föreningar~~ ✅ → ~~sätt bucket-gränser~~ ✅ → ~~rensa pass-photos vid radering~~ ✅ → ~~reconcilea reports-schemat~~ ✅ (redan klart) → ~~testa Stripe-webhooken~~ ✅.

**Kvar av Vecka 1:** `eas.json` + buildnummer, publik policy-URL, Apple IAP-beslut. Dessa tre är fortfarande de enda kvarstående hårda blockerarna för App Store-inlämning.

**Vecka 2 (risk-reduktion inför granskning):**
Minimal tillgänglighetspass på ikonknappar → verifiera kamerabehörighetssträng i faktisk build → npm audit-plan → `.env.example` → git-tagg release-kandidaten.

**Månad 1 efter lansering:**
ESLint + CI-pipeline (lint/typecheck/test/audit-gates) → `Sentry.setUser()` → analytics (PostHog) → `coverageThreshold`.

**Månad 2–3:**
Bryt ut `cardio.tsx`/`dashboard.tsx`/`group.tsx` → adoptera `useAuth()` överallt → inför `expo-image` + caching-lager → offline-hantering (NetInfo).

**Vid 10k+ användare (skalningsutlöst, inte kalenderstyrt):**
Konsolidera realtidskanaler → bild-CDN/transformering → EXPLAIN ANALYZE på produktionsdata för att verifiera indexstrategin under verklig belastning.
</content>
