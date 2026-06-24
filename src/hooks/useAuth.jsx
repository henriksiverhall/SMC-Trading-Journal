import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

const AuthContext = createContext(null)
const SESSION_KEY = 'tl_impersonating'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userSettings, setUserSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [unreadBroadcast, setUnreadBroadcast] = useState(0)
  const [unreadInbox, setUnreadInbox] = useState(0)

  const [impersonating, setImpersonating] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null }
    catch { return null }
  })
  const [impersonatedSettings, setImpersonatedSettings] = useState({})

  async function startImpersonation(targetUser) {
    const { data } = await sb.from('user_settings').select('settings').eq('user_id', targetUser.id).maybeSingle()
    setImpersonatedSettings(data?.settings || {})
    setImpersonating(targetUser)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(targetUser))
  }

  function stopImpersonation() {
    setImpersonating(null)
    setImpersonatedSettings({})
    sessionStorage.removeItem(SESSION_KEY)
  }

  useEffect(() => {
    const saved = impersonating
    if (saved?.id) {
      sb.from('user_settings').select('settings').eq('user_id', saved.id).maybeSingle()
        .then(({ data }) => setImpersonatedSettings(data?.settings || {}))
    }
  }, [])

  const viewAsUser = impersonating ? { id: impersonating.id, email: impersonating.email } : null
  const viewAsSettings = impersonating ? impersonatedSettings : null

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadSettings(session.user.id); fetchUnread(session.user.id) }
      else setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadSettings(session.user.id); fetchUnread(session.user.id) }
      else {
        setUserSettings({}); setLoading(false)
        setUnreadBroadcast(0); setUnreadInbox(0)
        stopImpersonation()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUnread(userId) {
    if (!userId) return
    try {
      const [{ data: published }, { data: reads }, { data: inboxMsgs }] = await Promise.all([
        sb.from('messages').select('id').eq('is_published', true),
        sb.from('message_reads').select('message_id').eq('user_id', userId),
        sb.from('inbox_messages')
          .select('id, inbox_threads!inner(user_id)')
          .eq('inbox_threads.user_id', userId)
          .neq('sender_id', userId)
          .is('read_at', null)
      ])
      const readIds = new Set((reads || []).map(r => r.message_id))
      setUnreadBroadcast((published || []).filter(m => !readIds.has(m.id)).length)
      setUnreadInbox(inboxMsgs?.length || 0)
    } catch (e) { console.warn('fetchUnread:', e) }
  }

  async function loadSettings(userId) {
    try {
      const { data } = await sb.from('user_settings').select('settings').eq('user_id', userId).maybeSingle()
      if (data?.settings) setUserSettings(data.settings)
      else await sb.from('user_settings').upsert({ user_id: userId, settings: {}, updated_at: new Date().toISOString() })
    } catch (e) { console.warn('loadSettings:', e) }
    finally { setLoading(false) }
  }

  async function saveSettings(newSettings) {
    if (!user) return
    const merged = { ...userSettings, ...newSettings }
    setUserSettings(merged)
    await sb.from('user_settings').upsert({ user_id: user.id, settings: merged, updated_at: new Date().toISOString() })
  }

  function refreshUnread(userId) { fetchUnread(userId || user?.id) }

  async function signOut() {
    // Rensa page-state så nästa inloggning inte hamnar på en admin-sida
    sessionStorage.removeItem('tl_page')
    await sb.auth.signOut()
    setUser(null); setUserSettings({})
    setUnreadBroadcast(0); setUnreadInbox(0)
    stopImpersonation()
  }

  const isAdmin = userSettings?.is_admin === true
  const aiEnabled = userSettings?.ai_enabled === true || isAdmin
  const unreadCount = unreadBroadcast + unreadInbox

  return (
    <AuthContext.Provider value={{
      user, userSettings, loading, isAdmin, aiEnabled,
      saveSettings, signOut, loadSettings,
      unreadCount, unreadBroadcast, unreadInbox, refreshUnread,
      impersonating, viewAsUser, viewAsSettings,
      startImpersonation, stopImpersonation,
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
