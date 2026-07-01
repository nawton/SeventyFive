# SeventyFive — Roadmap & Framtida Funktioner
**Nawton AB** | Senast uppdaterad: 2026-07-01

---

## Prioritering

| Symbol | Betydelse |
|---|---|
| 🔴 | Hög prioritet — bygga snart |
| 🟡 | Medel prioritet — planerad |
| 🟢 | Låg prioritet / framtid |
| ✅ | Klar |

---

## 1. Kärna — 75 Hard-specifikt

Dessa funktioner gör appen autentisk mot originalkonceptet.

### 🔴 Progressfoto per dag
- Användaren tar ett foto varje dag som en del av foto-uppgiften
- Foton lagras i Supabase Storage kopplat till `daily_logs`
- Gallerivy där man kan scrolla dag 1 → dag 75 och se sin transformation
- Kräver: Supabase Storage bucket (`progress-photos`), kamera-permissions
- **Varför:** En av 75 Hards starkaste funktioner — transformation synlig dag 1 vs dag 75

### 🔴 Streak-räknare (riktig)
- Räknar faktiska konsekutiva klarade dagar via queries på `daily_logs`
- Visas på hemskärmen med flamikon (🔥 X dagar i rad)
- Nollställs automatiskt om en dag missas
- **Varför:** Viktigaste motivationsverktyget i hela appen

### 🟡 Vattenspårning (avancerad)
- Istället för en enkel bock — en visuell widget för att logga deciliter under dagen
- Tryck "+" för varje glas/flaska, se en "fyll på"-animation
- Mål baserat på nivå (3L / 4L / 4.5L)
- Lagras per timme i `daily_logs` som JSONB

### 🟡 Läsningslogg
- Logga antal sidor lästa (inte bara klar/inte klar)
- Lägg till bok (titel + författare) som man läser
- Progressbar mot dagmålet (10 eller 20 sidor)
- Bokhistorik — vilka böcker klarades under utmaningen

### 🟡 Dag 75-firande
- Animerad "celebration screen" när användaren klarar hela utmaningen
- Sammanfattning: antal klarade dagar, foton, böcker lästa
- Konfetti-animation (via `react-native-confetti-cannon` eller Reanimated)
- Delningsbart resultat-kort

---

## 2. Motivation & Retention

### 🔴 Push-notiser med schema
- Personliga påminnelser baserade på användarens dagschema
- Morgonpåminnelse: "God morgon! Dags att starta dag X"
- Kväll: "2 timmar kvar — X uppgifter inte klara"
- Kräver: `expo-dev-client` (fungerar ej i Expo Go)
- Kräver: `expo-notifications` + schemalagda triggers

### 🟡 Veckosammanfattning
- Skickas varje söndag som push-notis eller visas in-app
- "Vecka X: 5/7 dagar klarade — bra jobbat!"
- Motiverande text baserat på resultat

### 🟡 Daglig motivationscitat
- Roterande citat på hemskärmen (eller som notis)
- Kopplas till användarens "Varför" från onboarding-quizet
- Kan vara AI-genererat (Anton) eller ett statiskt bibliotek

### 🟢 Comeback-funktion
- När användaren startar om efter ett misslyckande
- Visa uppmuntrande skärm: "Du kom till dag X förra gången — slå det!"
- Historik över tidigare försök

---

## 3. Betalmodell & Monetisering

Schema finns redan i databasen (`subscription_status: trial/active/expired`).

### 🔴 RevenueCat-integration
- Enklast för in-app köp på iOS + Android
- Hantera prenumerationer, trials, återköp
- Webhook till Supabase för att uppdatera `subscription_status`

### 🔴 Paywall-skärm
- Visas efter 14 dagars gratis provperiod
- Tydlig värdepropå: vad användaren får med premium
- Pris: bestäms av Nawton (t.ex. 99 kr/mån eller 499 kr/år)

### 🟡 Gratis vs Premium — definiera tiers
- **Gratis:** Starta utmaning, daglig checklista, grundläggande stats
- **Premium:** Progressfoton, vattenspårning avancerad, notiser, historik, AI-coach

### 🟢 Referral-program
- Bjud in en vän → båda får 1 extra vecka gratis

---

## 4. Socialt & Viral Growth

### 🟡 Dela dag-kort
- Generera ett delningsbart bildkort: "Dag 23/75 ✅ — SeventyFive by Nawton"
- Innehåller dagens stats + avatar
- Dela direkt till Instagram Stories, WhatsApp etc.
- Kräver: `react-native-view-shot` för att rendera vy till bild

### 🟢 Vän-utmaningar
- Bjud in en kompis att starta samma dag
- Se varandras framsteg (utan att se varandras foton)
- Push-notis när en vän klarar en dag

### 🟢 Completion Certificate
- Digitalt intyg i PDF/bild-format: "Nawid klarade 75 Hard den 2026-09-01"
- Delningsbart på LinkedIn/sociala medier

### 🟢 Leaderboard
- Anonym ranking baserat på antal klarade dagar
- "Top 100 användare den här månaden"

---

## 5. Plattform & Teknik

### 🟡 Offline-stöd
- Buffra uppgiftsavklarningar lokalt (AsyncStorage) om ingen uppkoppling
- Synka när uppkoppling återkommer
- Viktigt för gym-miljöer utan WiFi

### 🟢 iOS Widget
- Dag-nummer + progress-ring direkt på iPhone-hemskärmen
- Kräver: `expo-widgets` eller native Swift-extension

### 🟢 Apple Health / Google Fit-integration
- Synka träningspass automatiskt från Health-appen
- Autoavklara träning-uppgiften om 45+ min registreras

### 🟢 iPad-stöd
- Anpassa layout för större skärmar
- Sidebar-navigation istället för tab-bar

---

## 6. Anton's Ansvarsområden

*(Dokumenterat här för helhetsbild — Anton driver dessa)*

### 🔴 AI-coach
- Personlig coach som refererar till användarens "Varför" från quizet
- Svarar på ursäkter med skräddarsydda motargument
- Pushar notiser baserat på beteendemönster

### 🔴 Google OAuth (fullt fungerande)
- Färdigställa Google-inloggning i production-build

### 🟡 Avancerat träningsbibliotek
- Fler övningar, muskelgruppsfilter
- Träningspass-byggare med AI-rekommendationer
- Progressionsspårning (vikt, reps, sets per övning)

### 🟡 Cardio-förbättringar
- Karta med rutt-visualisering
- Pace, hjärtfrekvens (Apple Watch)
- Segmentanalys

### 🟢 Betalning & backend-infrastruktur
- Stripe/RevenueCat server-side webhooks
- Backend-funktioner via Supabase Edge Functions

---

## Närmaste Sprint (rekommendation)

Baserat på nuvarande appstatus är dessa tre saker näst mest värdefulla:

1. **🔴 Progressfoto** — autentiskt 75 Hard, stark retention-funktion
2. **🔴 Streak-räknare** — enklaste att bygga, stor motivationspåverkan
3. **🔴 RevenueCat + Paywall** — börja tjäna pengar

---

*Uppdatera denna fil när funktioner påbörjas eller slutförs.*
*Flytta till ✅ när en funktion är live i production.*
