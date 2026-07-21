import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  session: Session | null
  userId:  string | null
  ready:   boolean
}

const AuthContext = createContext<AuthState>({ session: null, userId: null, ready: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, userId: null, ready: false })

  useEffect(() => {
    // Läs session från SecureStore — inget nätverksanrop
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ session, userId: session?.user.id ?? null, ready: true })
    })

    // Uppdatera vid inloggning, utloggning och token-refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setState({ session, userId: session?.user.id ?? null, ready: true })
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

/** Returnerar { session, userId, ready } utan eget nätverksanrop per skärm. */
export function useAuth(): AuthState {
  return useContext(AuthContext)
}
