import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { sb } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userSettings, setUserSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadSettings(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadSettings(session.user.id)
      else { setUserSettings({}); setLoading(false); setUnreadCount(0) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadSettings(userId) {
    try {
      const { data, error } = await sb.from('user_settings').select('settings').eq('user_id', userId).maybeSingle()
      if (data?.settings) {
        setUserSettings(data.settings)
      } else if (error || !data) {
        // No row exists yet – create one silently
        await sb.from('user_settings').upsert({ user_id: userId, settings: {}, updated_at: new Date().toISOString() })
      }
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

  const refreshUnread = useCallback(async (userId) => {
    if (!userId) return
    try {
      // Always check both broadcast and inbox regardless of role
      // Admin will have 0 broadcast unread naturally (they publish them)
      const [{ data: published }, { data: reads }, { data: unreadInbox }] = await Promise.all([
        sb.from('messages').select('id').eq('is_published', true),
        sb.from('message_reads').select('message_id').eq('user_id', userId),
        sb.from('inbox_messages')
          .select('id, inbox_threads!inner(user_id)')
          .eq('inbox_threads.user_id', userId)
          .neq('sender_id', userId)
          .is('read_at', null)
      ])
      const readIds = new Set((reads || []).map(r => r.message_id))
      const unreadBroadcast = (published || []).filter(m => !readIds.has(m.id)).length
      setUnreadCount(unreadBroadcast + (unreadInbox?.length || 0))
    } catch (e) {
      console.warn('refreshUnread:', e)
    }
  }, [])

  useEffect(() => {
    if (user) refreshUnread(user.id)
  }, [user, refreshUnread])

  async function signOut() {
    await sb.auth.signOut()
    setUser(null)
    setUserSettings({})
    setUnreadCount(0)
  }

  const isAdmin = userSettings?.is_admin === true
  const aiEnabled = userSettings?.ai_enabled === true || isAdmin

  return (
    <AuthContext.Provider value={{
      user, userSettings, loading, isAdmin, aiEnabled,
      saveSettings, signOut, loadSettings,
      unreadCount, refreshUnread
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
