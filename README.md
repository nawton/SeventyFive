# SeventyFive

**75 dagar. 5 uppgifter. Inga undantag.**

SeventyFive är en mobilapp (iOS & Android) som förvandlar den klassiska **75 Hard**-utmaningen till en levande, social och visuellt filmisk upplevelse. Fem icke förhandlingsbara dagliga uppgifter — träning, kost, vatten, läsning och en progressbild — spåras med en animerad 75-dagarsring. Missar du en dag väntar ett äkta val: börja om från dag 1, eller fortsätt på egen risk. Det är den insatsen som gör att utmaningen faktiskt förändrar dig.

Byggd av **Nawton**.

---

## Innehåll

- [Funktioner](#funktioner)
- [Tech stack](#tech-stack)
- [Kom igång](#kom-igång)
- [Projektstruktur](#projektstruktur)
- [Backend](#backend)
- [Tester](#tester)
- [Roadmap](#roadmap)

---

## Funktioner

### 🔥 Utmaningen
- Animerat 75-dagars ringdiagram med daglig progress
- Fem dagliga uppgifter: Träning, Kost, Vatten, Läsning, Progressbild
- Omstartsmekanik — missar du en dag måste du aktivt välja att starta om eller fortsätta
- Segerscreen med firande vid dag 75

### 📅 Schema & Träning
- Kalenderremsa med rullningsbar månadsöversikt och swipebar dagsvy
- Återkommande och engångspass, egen övningsredigerare
- Övningsväljare med muskelgrupps-body-map och stillbildsförhandsvisning
- GPS-spårad kardio med karta och live-statistik
- Schemaguide (Schedule Wizard) som genererar personliga träningsprogram

### 📊 Framsteg
- Streak- och completion-rate-översikt
- Kardiohistorik med veckostatistik (distans, tempo, kalorier)
- Styrke-heatmap: SVG-kroppskarta som visar muskelgruppsintensitet i tre nivåer

### 👤 Profil & Socialt
- Strava-liknande fotoflöde med privata, signerade progressbilder
- Community-flöde med pass från dig och dina vänner, likes och kommentarer
- Sök, följ och profiler för andra användare
- Granulär sekretess: sökbarhet, följarantagning och synlighet av aktivitet
- Blockering och rapportering av innehåll

### 💎 Premium
Utmaningen är alltid gratis. Premium (Stripe-baserat, 99 kr/mån eller 699 kr/år) låser upp:
- Personliga löpprogram (5K till maraton, med nedtrappning)
- Röststyrd intervallcoachning
- Avancerad statistik (tempoprogression, exakta kalorier, intervalltrender)

Mjuk uppsäljningsdesign — alltid avvisningsbar, ingen påtvingad betalvägg.

### 🎨 Design
Mörkt, filmiskt gränssnitt (`#0A0A0C`) med en orange kärnaccent (`#FFA817`) för utmaningen och en mint/teal-accent (`#4ED9C4`) reserverad för premium-ytor. Glasmorfism, haptisk feedback och Reanimated-drivna animationer ger en polerad känsla i klass med Strava eller Runna.

---

## Tech stack

| Lager | Teknik |
|---|---|
| Ramverk | [Expo](https://docs.expo.dev/versions/v56.0.0/) 54 (React Native 0.81, React 19) |
| Routing | expo-router 6 (fil-baserad routing) |
| Backend | [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Edge Functions) |
| Betalningar | Stripe (checkout, billing portal, webhooks via Supabase Edge Functions) |
| Animationer | react-native-reanimated 4, react-native-worklets |
| Kartor | react-native-maps, expo-location |
| Grafik | react-native-svg, react-native-body-highlighter |
| Felspårning | Sentry |
| Tester | Jest + jest-expo + @testing-library/react-native |
| Språk | TypeScript |

---

## Kom igång

### Förutsättningar
- Node.js + npm
- Expo CLI (`npx expo`)
- Ett Supabase-projekt

### Installation

```bash
npm install
```

### Miljövariabler

Skapa en `.env.local` i projektroten:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### Kör appen

```bash
npm start        # Expo dev server
npm run ios      # iOS-simulator
npm run android  # Android-emulator
npm run web      # Webbläsare
```

> **OBS:** Expo har ändrats sedan träningsdata skars av. Läs de exakta versionerade dokumenten på [docs.expo.dev/versions/v56.0.0](https://docs.expo.dev/versions/v56.0.0/) innan du skriver kod mot Expo-API:er.

---

## Projektstruktur

```
app/                  # Skärmar & routing (expo-router)
  (auth)/              # Inloggning, registrering
  (app)/                # Huvudappen (tabs, dashboard, schema, stats, profil)
  cardio*.tsx           # Kardiopass, GPS-sammanfattning
  premium.tsx           # Betalvägg

src/
  components/          # Återanvändbara UI-komponenter
  hooks/                # Custom React-hooks
  lib/                  # Klienter & konfiguration (t.ex. Supabase)
  services/             # Affärslogik / API-anrop
  stores/               # State management
  types/                # TypeScript-typer
  testUtils/             # Testhjälpmedel

supabase/
  migrations/          # Databasschema
  functions/            # Edge functions (Stripe m.m.)
```

---

## Backend

Databas, autentisering, filhantering och serverlös logik hanteras via Supabase. Schema, RLS-policys och migrationer finns i [supabase/migrations](supabase/migrations). Stripe-integrationen (checkout, webhook, billing portal) körs som Supabase Edge Functions i [supabase/functions](supabase/functions).

---

## Tester

```bash
npm test
```

Testerna körs med Jest via `jest-expo`-presetet, se `jest.setup.js` för mockar och testkonfiguration.

---

## Roadmap

Se [ROADMAP.md](ROADMAP.md) för nuläge och kommande funktioner — inklusive nästa stora satsning: en **AI-coach** som ger adaptiv, personlig coachning baserad på din träningsdata och progress, långt utöver dagens statiska scheman.

---

## Licens

Se [LICENSE](LICENSE).
