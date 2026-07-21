# Stripe-abonnemang — setup

Arkitekturen: appen öppnar Stripe Checkout i webbläsaren (fungerar i Expo Go),
en webhook speglar abonnemangsstatusen till `subscriptions`-tabellen, och appen
läser bara tabellen. Inga kortuppgifter passerar appen eller vår backend.

```
App ──invoke──▶ stripe-checkout ──▶ Stripe Checkout (webbläsare)
App ──invoke──▶ stripe-portal   ──▶ Stripes kundportal (webbläsare)
Stripe ──webhook──▶ stripe-webhook ──▶ subscriptions-tabellen ◀──läser── App
```

## Engångssteg

1. **Stripe-konto** — skapa på stripe.com. Jobba i **testläge** tills allt funkar
   (testkort: `4242 4242 4242 4242`, valfritt datum/CVC).

2. **Produkt + priser** — Dashboard → Product catalog → Add product.
   "SeventyFive Premium" med TVÅ återkommande priser: månadsvis (t.ex. 99 kr)
   och årligen (t.ex. 699 kr). Kopiera båda pris-id:na (`price_…`).
   Visningstexterna i appen bor i `src/lib/premiumPlans.ts` — uppdatera dem
   så de matchar de faktiska beloppen.

3. **Kör migrationen** (skapar `subscriptions`-tabellen med RLS):
   ```bash
   supabase db push
   ```

4. **Sätt secrets** (Supabase → Edge Functions → Secrets, eller CLI):
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_…
   supabase secrets set STRIPE_PRICE_ID_ANNUAL=price_…
   supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_…
   ```
   (`STRIPE_PRICE_ID` fungerar som fallback om du bara har ett pris.)

5. **Deploya funktionerna:**
   ```bash
   supabase functions deploy stripe-checkout
   supabase functions deploy stripe-portal
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   (`--no-verify-jwt` på webhooken — Stripe skickar ingen Supabase-JWT;
   signaturverifieringen i funktionen är autentiseringen.)

6. **Registrera webhooken** — Stripe Dashboard → Developers → Webhooks →
   Add endpoint:
   - URL: `https://<projekt-ref>.supabase.co/functions/v1/stripe-webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Kopiera signing secret (`whsec_…`) och sätt den:
     ```bash
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…
     ```

7. **Aktivera kundportalen** — Dashboard → Settings → Billing → Customer portal
   → aktivera (annars ger stripe-portal ett fel).

## Testa flödet

1. Öppna profilsidan i appen → "SeventyFive Premium" → **Uppgradera**.
2. Betala med testkortet i webbläsaren.
3. Tillbaka i appen: kortet ska visa **AKTIVT** + förnyelsedatum inom några
   sekunder (webhooken skriver, kortet läser om vid fokus).
4. **Hantera abonnemang** → säg upp i portalen → kortet visar "Avslutas …".

## Går live

- Byt till live-nycklar (`sk_live_…`, nytt `price_…`, ny webhook + `whsec_…`).
- **App Store-varning:** digitala abonnemang köpta i appen ska enligt Apples
  regel 3.1.1 gå via In-App Purchase. Stripe-via-webbläsare är den vanliga
  gråzonen (och uttryckligen tillåtet i USA sedan 2025 samt inom EU under
  DMA), men räkna med att det kan bli en diskussion vid App Store-granskningen.
  Planera i värsta fall för Apple IAP som komplement för iOS-försäljning.
