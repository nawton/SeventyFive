import { verifySignature, isSubscriptionEvent, subscriptionRowFromEvent, type StripeSubscriptionEvent } from '../logic'

const SECRET = 'whsec_test_secret'

/** Bygger en giltig Stripe-Signature-header för payload+secret, precis som
    Stripe själv gör vid utskick. */
async function makeSignatureHeader(payload: string, secret: string, tSeconds: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${tSeconds}.${payload}`))
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `t=${tSeconds},v1=${hex}`
}

describe('verifySignature', () => {
  const payload = JSON.stringify({ hello: 'world' })

  it('accepterar en korrekt signerad, färsk payload', async () => {
    const now = Math.floor(Date.now() / 1000)
    const header = await makeSignatureHeader(payload, SECRET, now)
    expect(await verifySignature(payload, header, SECRET)).toBe(true)
  })

  it('avvisar signatur skapad med fel hemlighet', async () => {
    const now = Math.floor(Date.now() / 1000)
    const header = await makeSignatureHeader(payload, 'whsec_wrong', now)
    expect(await verifySignature(payload, header, SECRET)).toBe(false)
  })

  it('avvisar om payloaden ändrats efter signering', async () => {
    const now = Math.floor(Date.now() / 1000)
    const header = await makeSignatureHeader(payload, SECRET, now)
    expect(await verifySignature(JSON.stringify({ hello: 'tampered' }), header, SECRET)).toBe(false)
  })

  it('avvisar en för gammal tidsstämpel (replay-skydd, >5 min)', async () => {
    const old = Math.floor(Date.now() / 1000) - 301
    const header = await makeSignatureHeader(payload, SECRET, old)
    expect(await verifySignature(payload, header, SECRET)).toBe(false)
  })

  it('accepterar nära gränsen men inom fönstret (295 s)', async () => {
    // Inte exakt 300 s — verifySignature läser Date.now() på nytt internt,
    // så en test på exakt gränsen blir flaky mot den reella klockan
    const nearEdge = Math.floor(Date.now() / 1000) - 295
    const header = await makeSignatureHeader(payload, SECRET, nearEdge)
    expect(await verifySignature(payload, header, SECRET)).toBe(true)
  })

  it('avvisar header utan t eller v1', async () => {
    expect(await verifySignature(payload, 'v1=abc', SECRET)).toBe(false)
    expect(await verifySignature(payload, 't=123', SECRET)).toBe(false)
    expect(await verifySignature(payload, '', SECRET)).toBe(false)
  })

  it('avvisar en v1 med fel längd utan att kasta', async () => {
    const now = Math.floor(Date.now() / 1000)
    await expect(verifySignature(payload, `t=${now},v1=deadbeef`, SECRET)).resolves.toBe(false)
  })
})

describe('isSubscriptionEvent', () => {
  it('true för alla customer.subscription.*-händelser', () => {
    expect(isSubscriptionEvent('customer.subscription.created')).toBe(true)
    expect(isSubscriptionEvent('customer.subscription.updated')).toBe(true)
    expect(isSubscriptionEvent('customer.subscription.deleted')).toBe(true)
  })
  it('false för andra Stripe-händelser', () => {
    expect(isSubscriptionEvent('invoice.paid')).toBe(false)
    expect(isSubscriptionEvent('checkout.session.completed')).toBe(false)
    expect(isSubscriptionEvent('customer.updated')).toBe(false)
  })
})

describe('subscriptionRowFromEvent', () => {
  function makeEvent(over: Partial<StripeSubscriptionEvent['data']['object']> = {}, type = 'customer.subscription.updated'): StripeSubscriptionEvent {
    return {
      type,
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_456',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1800000000,
          items: { data: [{ price: { id: 'price_annual' } }] },
          ...over,
        },
      },
    }
  }

  it('mappar en aktiv prenumeration korrekt', () => {
    const row = subscriptionRowFromEvent(makeEvent(), 'u1')
    expect(row).toEqual({
      user_id: 'u1',
      stripe_customer_id: 'cus_456',
      stripe_subscription_id: 'sub_123',
      status: 'active',
      price_id: 'price_annual',
      current_period_end: new Date(1800000000 * 1000).toISOString(),
      cancel_at_period_end: false,
    })
  })

  it('deleted-eventet sätter alltid status till canceled, oavsett fältets värde', () => {
    const row = subscriptionRowFromEvent(makeEvent({ status: 'active' }, 'customer.subscription.deleted'), 'u1')
    expect(row.status).toBe('canceled')
  })

  it('saknat pris blir null istället för att krascha', () => {
    const row = subscriptionRowFromEvent(makeEvent({ items: undefined }), 'u1')
    expect(row.price_id).toBeNull()
    const row2 = subscriptionRowFromEvent(makeEvent({ items: { data: [] } }), 'u1')
    expect(row2.price_id).toBeNull()
  })

  it('cancel_at_period_end förs igenom oförändrad', () => {
    expect(subscriptionRowFromEvent(makeEvent({ cancel_at_period_end: true }), 'u1').cancel_at_period_end).toBe(true)
  })
})
