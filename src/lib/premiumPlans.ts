// =============================================================================
// PREMIUM-PLANERNA — visningstexterna för paywallen. Priserna här är bara
// text; de faktiska beloppen bestäms av Stripe-priserna (STRIPE_PRICE_ID_*).
// Uppdatera BÅDA ställena när priset ändras.
// =============================================================================

export type PlanKey = 'annual' | 'monthly'

export interface PremiumPlan {
  key: PlanKey
  title: string
  price: string
  perWeek: string
  badge?: string
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  { key: 'annual',  title: 'Årligen',    price: '699 kr/år',  perWeek: '13 kr/vecka', badge: 'SPARA 40%' },
  { key: 'monthly', title: 'Månadsvis',  price: '99 kr/mån',  perWeek: '23 kr/vecka' },
]

/** Vad Premium ger — checklistan på paywallen */
export const PREMIUM_BENEFITS = [
  'Personliga löpplaner mot ditt mål — från 5K till marathon, med tävlingsdag och nedtrappning',
  'Intervallguidning med röst under passet: segment, vila och tempo i öronen',
  'Full statistik: intervalltrend, tempoutveckling och ärliga kalorier',
]
