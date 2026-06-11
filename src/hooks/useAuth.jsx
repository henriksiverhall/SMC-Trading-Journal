import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userSettings, setUserSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadSettings(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadSettings(session.user.id)
      else { setUserSettings({}); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadSettings(userId) {
    try {
      const { data } = await sb.from('user_settings').select('settings').eq('user_id', userId).single()
      if (data?.settings) setUserSettings(data.settings)
    } catch (e) {
      console.warn('loadSettings:', e)
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings(newSettings) {
    if (!user) return
    const merged = { ...userSettings, ...newSettings }
    setUserSettings(merged)
    await sb.from('user_settings').upsert({
      user_id: user.id,
      settings: merged,
      updated_at: new Date().toISOString()
    })
  }

  async function signOut() {
    await sb.auth.signOut()
    setUser(null)
    setUserSettings({})
  }

  const isAdmin = userSettings?.is_admin === true
  const aiEnabled = userSettings?.ai_enabled === true || isAdmin

  return (
    <AuthContext.Provider value={{ user, userSettings, loading, isAdmin, aiEnabled, saveSettings, signOut, loadSettings }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
