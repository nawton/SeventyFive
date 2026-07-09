# SeventyFive — Produktroadmap

> Senast uppdaterad: 2026-07-02

---

## Nuläge — Vad som är byggt

### Autentisering & Onboarding
- [x] Login med Google OAuth
- [x] Welcome-screen
- [x] Quiz (varför / mål / trycknivå)
- [x] Rekommendationsscreen baserat på quizsvar
- [x] Schema-setup vid onboarding

### Dashboard (Hem)
- [x] 75-dagars ringdiagram med animerat progress
- [x] Dagliga uppgifter: Träning, Kost, Vatten, Läsning, Foto (checkbox)
- [x] Markera dag som klar / misslyckad (FailModal)
- [x] Dag-räknare (X/75)
- [x] Omstartsmekanik: rollover-check vid app-öppning flaggar missade dagar med val "Starta om från dag 1" / "Fortsätt ändå" (RestartPromptModal)
- [x] Samma val visas efter att dagen rapporterats missad via FailModal
- [x] Målgång: challengen markeras `completed` efter dag 75 med segerscreen (VictoryModal) och "Starta ny utmaning"

### Schema (Träningsplan)
- [x] Rullningsbar kalenderremsa med månadsöversikt
- [x] Horisontell dagsväxlare (swipebar, en sida per dag)
- [x] Schemalagda pass med upprepning per veckodag
- [x] ONCE-pass (engångspass för specifikt datum)
- [x] Logga missad övning (lägger till under Träningspass)
- [x] Lägg till övning i befintligt pass
- [x] Markera övning som utförd (checkboxes per övning)
- [x] Markera hela pass som klarat
- [x] Long-press: ta bort engångspass / gå till inställningar för upprepande
- [x] "Lägg till övning" alltid synlig under övningslistan
- [x] ExercisePickerSheet: Gym/Cardio-landning, muskelgruppslista med Body SVG-thumbnails, kardio med sport-ikoner
- [x] GPS cardio-tracking med Leaflet-karta och live-statistik
- [x] Hantera schemalagda pass (manage-sessions, endast upprepande)
- [x] SessionEditor med valfritt namn, info-knapp för upprepning
- [x] ScheduleWizard — UI klar (mål → avstånd/muskelplan → fokus → sammanfattning), kopplad till backend via `scheduleGenerator.ts`, med ersätt/behåll-val vid befintligt schema

### Framsteg (Stats)
- [x] Översiktsfliken: kalenderöversikt, streak, completion-rate
- [x] Cardio-fliken: lista med cardio-pass, detaljvy per pass
- [x] Styrka-fliken: kropp-SVG med muskelkarta (heatmap)
- [x] Veckoselektor (navigera bakåt i veckor)
- [x] 4-veckorsläge för muskelkartan
- [x] 3-nivå intensitetsfärger: blå (lite), gul (medel), orange (mycket)

### Profil
- [x] Profilsida som egen flik: avatar, namn, nivå + dag-räknare
- [x] Strava-likt foto-flöde: kort per dag med bild, dagnummer, datum och egen text (caption)
- [x] Lägg till foto via kamera eller bibliotek, uppladdning till privat storage-bucket med signerade URL:er
- [x] Dagens fotouppgift på dashboarden bockas i automatiskt vid uppladdning
- [x] Ta bort foto (raderar även filen i storage)

### Inställningar
- [x] Nås via kugghjul på profilsidan (egen dold screen med tillbaka-knapp)
- [x] Redigera profil (namn, avatar/emoji)
- [x] Hantera schemalagda pass

---

## Fas 1 — Snabba vinster (1–2 veckor)

### Schema
- [x] **ScheduleWizard → backend**: generera faktiska träningspass baserat på wizard-svar (löppass, helkropps-styrka eller valda fokusgrupper)
- [x] **Övningsdetalj-screen** (`app/exercise/[id].tsx`): beskrivning, muskelgrupper som body-SVG och loggning
- [ ] **Global sök**: sökruta på schema-sidan som söker bland alla övningar oavsett kategori

### Dashboard
- [x] **Fotouppgift**: löst via profilsidans foto-flöde — uppladdning sparar till `progress_photos` och bockar i dagens uppgift
- [x] **Vatten-tracker**: glas-räknare mot nivåns litermål (8/12/16 glas à 250 ml) med progress-bar direkt på kortet, minus-knapp för att ångra
- [x] **Läsningslogg**: boktitel + sidantal loggas i modal innan uppgiften bockas i, visas som metatext på kortet
- [x] **Fotokortet** leder till profilens foto-flöde istället för manuell checkbox — bockas i via faktisk uppladdning

### Framsteg
- [ ] **Veckostaplar i Översikt**: stapeldiagram som visar antal klara dagar per vecka
- [x] **Cardio-statistik**: total distans, total tid, antal pass, snittempo, bästa tempo och kcal summerat högst upp i Cardio-fliken

---

## Fas 2 — Kort sikt (1–2 månader)

### Träning & Hälsa
- [ ] **Personliga rekord (PR)**: spåra bästa set/reps per övning, visa PR-badge när nytt rekord sätts
- [ ] **Viloimer**: countdown-timer mellan set direkt i passvyn
- [ ] **Volymspårning**: total lyft-vikt per session och per vecka (sets × reps × vikt)
- [ ] **Kroppsmått**: logga vikt och måttband (midja, arm, etc.) och visa trendgraf
- [ ] **Hjärtrytmzoner**: integrera med HealthKit/Google Fit för puls under cardio

### Schema & UX
- [ ] **Drag-och-släpp i manage-sessions**: ändra ordning på pass via dra
- [ ] **Duplicera pass**: kopiera ett befintligt pass som utgångspunkt för ett nytt
- [ ] **Dela schemamallar**: exportera/importera ett veckoschema via deep link
- [ ] **Snabblogg-widget**: logga dagens pass från hemskärmswidget utan att öppna appen

### Framsteg
- [ ] **Framstegsfoto-galleri**: rutnät med alla tagna bilder, jämför dag X mot dag Y sida vid sida
- [ ] **Löpanalys**: GPS-rutt med färgkodad hastighet/zonkarta
- [ ] **Activity-screen**: aktivitetsflöde med allt man gjort (träning, foton, streaks) — `activity.tsx` är tom idag

---

## Fas 3 — Medellång sikt (2–4 månader)

### Push-notifikationer
- [ ] **Dagliga påminnelser**: konfigurerbar tid per uppgiftstyp (träning, vatten, läsning, foto)
- [ ] **Streak-varningar**: push om du inte loggat något vid t.ex. kl 20:00
- [ ] **Motivationsmeddelanden**: slumpmässiga citat/pushes under dagen
- [ ] **Pass-påminnelser**: "Ditt pass börjar om 30 min" baserat på schema

### Achievements & Gamification
- [ ] **Badge-system**: milstenar (Dag 1, 7, 10, 25, 50, 75), "Första löprundan", "3-dagars streak" etc.
- [ ] **Utmaningsfirande**: animerad segerscreen på dag 75 med konfetti och statistiköversikt
- [ ] **Before/after-jämförelse**: välj två datum och se bilderna sida vid sida med slider
- [ ] **Veckouppsummering**: automatisk push varje söndag med veckans stats

### Social
- [ ] **Kompis-utmaningar**: bjud in en vän via länk och jämför progress dag för dag
- [ ] **Community-flöde**: valfritt publikt flöde med framstegsfoton (`is_public`-flaggan finns i databasen)
- [ ] **Leaderboard**: veckoranking bland vänner baserat på klara dagar och träningsvolym

---

## Fas 4 — Lång sikt (4–6 månader)

### AI-coach
- [ ] **AI-coachchat**: `ai_coach_response` finns redan i `task_completions`-tabellen — bygg chattgränssnitt med Claude som coachar baserat på dagens prestation
- [ ] **Smarta träningsrekommendationer**: föreslå övningar baserat på vilka muskler som undertränas (muskelkartan + historik)
- [ ] **Återhämtningsanalys**: varnar om du övertränar specifika muskelgrupper vecka efter vecka
- [ ] **Anpassat löpprogram**: AI justerar distans och tempo dynamiskt varje vecka baserat på framsteg

### Plattform & Integrationer
- [ ] **Apple Health / Google Fit**: läs in steg, puls och sömn; synka avklarade träningspass
- [ ] **Apple Watch-app**: markera uppgifter och starta cardio-tracking direkt från klockan
- [ ] **Nutrition-API**: sök livsmedel och logga kalorier/makros mot kostuppgiften
- [ ] **Spotify/Apple Music**: spela en träningsspellista direkt inifrån appen

### Prenumeration & Affär
- [ ] **Betalvägg**: `subscription_status` och `payment_completed_at` finns i profilen — bygg RevenueCat-integration
- [ ] **Gratisnivå vs. Premium**: begränsa muskelkarta, AI-coach och avancerad statistik till betalande användare
- [ ] **Coach-läge**: tränare kan följa och kommentera sina klienters framsteg i realtid

---

## Fas 5 — Vision (6+ månader)

- [ ] **Video-formkontroll**: ladda upp ett set-klipp och få AI-feedback på tekniken
- [ ] **Genetiskt anpassade program**: kombinera quiz + historik + AI för hyper-personliga program
- [ ] **Offline-läge**: full offline-support med synk när anslutning återupptas
- [ ] **Tablet/iPad-layout**: sidopanel-gränssnitt optimerat för större skärmar
- [ ] **Web-dashboard**: statistikportal för tränare och power-users
- [ ] **Marketplace för scheman**: köp och sälj expertprogram från kända coacher och atleter

---

## Teknisk skuld & Infrastruktur

- [x] Anslut `ScheduleWizard` till Supabase och skapa verkliga sessions baserat på wizard-svar
- [ ] `activity.tsx` är tom — fliken är dold (`href: null`) tills aktivitetsflödet byggs
- [ ] Migrationsfiler för `exercise_completions`-tabellen
- [ ] End-to-end-tester för kritiska flöden (inloggning, markera dag klar, schema-skapande)
- [ ] Error Boundaries i alla huvud-screens (idag kraschar hela sidan vid API-fel)
- [ ] Bildkomprimering innan uppladdning av profilfoton och framstegsfoton
- [ ] Rate limiting / debounce på Supabase-anrop i schema-sidan vid snabb swipe

---

## Prioriteringsmatris

| Feature | Användarvärde | Effort | Prioritet |
|---|---|---|---|
| Fotouppgift (ta bild direkt) | Hög | Låg | 🔴 Nu |
| Vatten-tracker med glas-räknare | Hög | Låg | 🔴 Nu |
| ScheduleWizard → backend | Hög | Medel | 🔴 Nu |
| Veckostaplar i Översikt | Medel | Låg | 🔴 Nu |
| PR-tracking per övning | Hög | Medel | 🟠 Snart |
| Push-notifikationer | Hög | Medel | 🟠 Snart |
| Badge/achievement-system | Medel | Låg | 🟠 Snart |
| Framstegsfoto-galleri | Hög | Medel | 🟠 Snart |
| Viloimer mellan set | Medel | Låg | 🟠 Snart |
| Activity-screen | Medel | Medel | 🟠 Snart |
| AI-coach | Hög | Hög | 🟡 Senare |
| Social / leaderboard | Medel | Hög | 🟡 Senare |
| Apple Watch-app | Medel | Hög | 🟡 Senare |
| Betalvägg (RevenueCat) | Hög | Hög | 🟡 Senare |
| Video-formkontroll | Medel | Mycket hög | 🔵 Vision |
| Marketplace för scheman | Medel | Mycket hög | 🔵 Vision |
