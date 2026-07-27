import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// =============================================================================
// LOGGA IN — riktig inloggning mot samma konto som appen. Webben har inget
// träningsgränssnitt än, så inloggad visas en ärlig "allt händer i appen"-
// vy med namnet som kvitto på att kontot funkar.
// =============================================================================

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedInName, setSignedInName] = useState<string | null>(null)

  // Redan inloggad sedan tidigare? Visa det direkt.
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const { data } = await supabase!
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .maybeSingle()
      setSignedInName(data?.name || session.user.email || 'du')
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (authError || !data.user) {
      setError('Fel e-post eller lösenord. Försök igen.')
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', data.user.id)
      .maybeSingle()
    setSignedInName(profile?.name || data.user.email || 'du')
  }

  async function handleSignOut() {
    await supabase?.auth.signOut()
    setSignedInName(null)
    setPassword('')
  }

  return (
    <main className="loginWrap">
      {/* Träningssidan: lågan, budskapet och reglerna som bakgrundston */}
      <aside className="loginSide">
        <div className="loginSideInner">
          <div className="loginFlame">🔥</div>
          <h2>Dags att checka in.</h2>
          <p>
            Två pass. Vattnet. Kosten. Läsningen. Fotot.
            Dagen räknas inte förrän allt är ibockat.
          </p>
          <ul>
            <li>🏃 GPS-spårade pass</li>
            <li>📸 Dagens framstegsfoto</li>
            <li>⚡ Håll streaken vid liv</li>
          </ul>
        </div>
      </aside>

      <section className="loginCard">
        {signedInName ? (
          <>
            <h1>Hej {signedInName.split(' ')[0]}! 👋</h1>
            <p className="loginHint">
              Du är inloggad. Själva träningen, utmaningen och flödet bor i
              appen på din iPhone, webben är än så länge bara skyltfönstret.
            </p>
            <Link to="/app" className="loginBtn">Skaffa appen</Link>
            <button type="button" className="loginBtn loginBtnGhost" onClick={handleSignOut}>
              Logga ut
            </button>
          </>
        ) : (
          <>
            <h1>Logga in</h1>
            <p className="loginHint">Samma konto som i appen.</p>
            {!supabase && (
              <p className="loginError">
                Inloggningen är inte konfigurerad i den här miljön ännu.
              </p>
            )}
            <form onSubmit={handleSubmit}>
              <label>
                E-post
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Lösenord
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && <p className="loginError">{error}</p>}
              <button type="submit" className="loginBtn" disabled={busy || !supabase}>
                {busy ? 'Loggar in…' : 'Logga in'}
              </button>
            </form>
            <p className="loginFoot">
              Inget konto? <Link to="/app">Skaffa appen</Link> så skapar du det där.
            </p>
          </>
        )}
      </section>
    </main>
  )
}
