import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatFull(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    // OBS: get_admin_users() är en SECURITY DEFINER-funktion (inte längre en
    // direkt-läsbar vy) - den kollar internt att frågande user är admin via
    // admin_flags innan den returnerar något från auth.users.
    const { data, error } = await sb.rpc('get_admin_users')
    if (error) { console.error('get_admin_users failed:', error); setLoading(false); return }
    if (!data) { setLoading(false); return }
    const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const ids = sorted.map(u => u.user_id)
    const [settingsRes, tradesRes, flagsRes] = await Promise.all([
      sb.from('user_settings').select('user_id, settings').in('user_id', ids),
      sb.from('trades').select('user_id').in('user_id', ids),
      sb.from('admin_flags').select('user_id, is_admin').in('user_id', ids),
    ])
    const settingsMap = {}; settingsRes.data?.forEach(s => settingsMap[s.user_id] = s.settings)
    const tradeCount = {}; tradesRes.data?.forEach(t => tradeCount[t.user_id] = (tradeCount[t.user_id] || 0) + 1)
    const flagMap = {}; flagsRes.data?.forEach(f => flagMap[f.user_id] = f.is_admin)
    setUsers(sorted.map(u => ({ ...u, settings: settingsMap[u.user_id] || {}, trade_count: tradeCount[u.user_id] || 0, is_admin: flagMap[u.user_id] || false })))
    setLoading(false)
  }

  async function toggleAI(userId, current) {
    await sb.rpc('admin_set_user_setting', { target_user_id: userId, setting_key: 'ai_enabled', setting_value: !current })
    loadUsers()
  }

  async function deleteUser(userId, email) {
    if (!window.confirm(`Ta bort ${email}? Går inte att ångra.`)) return
    await sb.rpc('delete_user_completely', { target_user_id: userId })
    loadUsers()
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Användare ({users.length})</div>
        <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Uppdatera</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
        ) : (
          <table className="journal-table">
            <thead><tr>
              <th>Email</th><th>Registrerad</th><th>Trades</th>
              <th>Bekräftad</th><th>Admin</th><th>AI</th><th></th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td style={{ color: 'var(--text)' }}>
                    {u.email}
                    {u.user_id === currentUserId && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 3 }}>du</span>
                    )}
                  </td>
                  <td className="mono">{formatTime(u.created_at)}</td>
                  <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{u.trade_count}</td>
                  <td><span style={{ fontSize: 11, color: u.confirmed_at ? 'var(--green)' : 'var(--text4)' }}>{u.confirmed_at ? '✓ Ja' : 'Nej'}</span></td>
                  <td><span style={{ fontSize: 11, color: u.is_admin ? 'var(--accent)' : 'var(--text4)' }}>{u.is_admin ? '✓ Admin' : '—'}</span></td>
                  <td>
                    <button className={`btn btn-sm ${u.settings?.ai_enabled ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => toggleAI(u.user_id, u.settings?.ai_enabled)}
                      disabled={u.user_id === currentUserId}>
                      {u.settings?.ai_enabled ? 'På' : 'Av'}
                    </button>
                  </td>
                  <td>
                    {u.user_id !== currentUserId && (
                      <button className="btn btn-sm" onClick={() => deleteUser(u.user_id, u.email)}
                        style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        Ta bort
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────
function BroadcastTab({ adminId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await sb.from('messages').select('*').order('created_at', { ascending: false })
    setMessages(data || [])
    setLoading(false)
  }

  function startEdit(m) {
    setEditingId(m.id)
    setTitle(m.title)
    setBody(m.body)
    setShowNew(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setTitle('')
    setBody('')
  }

  async function create(publish) {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    await sb.from('messages').insert({
      title: title.trim(), body: body.trim(), created_by: adminId,
      is_published: publish, published_at: publish ? new Date().toISOString() : null,
    })
    setTitle(''); setBody(''); setShowNew(false)
    await load(); setSaving(false)
  }

  async function saveEdit() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    await sb.from('messages').update({ title: title.trim(), body: body.trim() }).eq('id', editingId)
    cancelEdit()
    await load(); setSaving(false)
  }

  async function publish(id) {
    await sb.from('messages').update({ is_published: true, published_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function unpublish(id) {
    await sb.from('messages').update({ is_published: false, published_at: null }).eq('id', id)
    load()
  }

  async function deleteMsg(id) {
    if (!window.confirm('Ta bort meddelandet?')) return
    await sb.from('messages').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowNew(s => !s); cancelEdit() }}>
          {showNew ? 'Avbryt' : '+ Nytt meddelande'}
        </button>
      </div>

      {/* New message form */}
      {showNew && (
        <div className="card">
          <div className="card-header"><div className="card-title">Nytt broadcast-meddelande</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Titel</label>
              <input className="form-control" placeholder="t.ex. Ny funktion: Widget-system" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Innehåll</label>
              <textarea className="form-control" rows={5} placeholder="Skriv meddelandet här…"
                value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => create(true)} disabled={saving}>📢 Publicera nu</button>
              <button className="btn btn-ghost" onClick={() => create(false)} disabled={saving}>Spara som utkast</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
      ) : messages.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga meddelanden ännu.</div>
      ) : messages.map(m => (
        <div key={m.id} className="card">
          <div className="card-body">
            {editingId === m.id ? (
              /* Edit form inline */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Redigerar meddelande</div>
                <div className="form-group">
                  <label className="form-label">Titel</label>
                  <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Innehåll</label>
                  <textarea className="form-control" rows={5} value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>💾 Spara</button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Avbryt</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: m.is_published ? 'var(--green-dim)' : 'var(--bg4)',
                      color: m.is_published ? 'var(--green)' : 'var(--text4)'
                    }}>{m.is_published ? '● Publicerat' : 'Utkast'}</span>
                    {m.published_at && <span style={{ fontSize: 11, color: 'var(--text4)' }}>{new Date(m.published_at).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{m.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {!m.is_published
                    ? <button className="btn btn-primary btn-sm" onClick={() => publish(m.id)}>Publicera</button>
                    : <button className="btn btn-ghost btn-sm" onClick={() => unpublish(m.id)}>Avpublicera</button>
                  }
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(m)}>✏️ Redigera</button>
                  <button className="btn btn-sm" onClick={() => deleteMsg(m.id)}
                    style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                    Ta bort
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Support tab ───────────────────────────────────────────────────────────────
function SupportTab({ adminId }) {
  const [threads, setThreads] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState('open')

  useEffect(() => { loadThreads() }, [])
  useEffect(() => { if (activeThread) loadMessages(activeThread.id) }, [activeThread])

  async function loadThreads() {
    setLoading(true)
    const { data: threadData } = await sb.from('inbox_threads')
      .select('*').order('updated_at', { ascending: false })
    // get_admin_users() istället för sb.from('admin_users') - vyn är borttagen,
    // se UsersTab.loadUsers() för bakgrund.
    const { data: userData, error: userError } = await sb.rpc('get_admin_users')
    if (userError) console.error('get_admin_users failed:', userError)
    const userMap = {}; userData?.forEach(u => userMap[u.user_id] = u.email)
    setUsers(userMap)
    setThreads(threadData || [])
    setLoading(false)
  }

  async function loadMessages(threadId) {
    const { data } = await sb.from('inbox_messages')
      .select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
    setMessages(data || [])
    // Mark unread messages from user as read (admin reading them)
    const unread = (data || []).filter(m => m.sender_id !== adminId && !m.read_at)
    for (const m of unread) {
      await sb.from('inbox_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
    }
  }

  async function sendReply() {
    if (!replyBody.trim() || !activeThread) return
    setSending(true)
    await sb.from('inbox_messages').insert({ thread_id: activeThread.id, sender_id: adminId, body: replyBody.trim() })
    await sb.from('inbox_threads').update({ updated_at: new Date().toISOString() }).eq('id', activeThread.id)
    setReplyBody('')
    await loadMessages(activeThread.id)
    await loadThreads()
    setSending(false)
  }

  async function toggleStatus(thread) {
    const newStatus = thread.status === 'open' ? 'closed' : 'open'
    await sb.from('inbox_threads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', thread.id)
    setActiveThread(t => t ? { ...t, status: newStatus } : t)
    loadThreads()
  }

  async function sendDirect(userId) {
    const subject = window.prompt('Ämne för direktmeddelande:')
    if (!subject) return
    const body = window.prompt('Meddelande:')
    if (!body) return
    const { data: thread } = await sb.from('inbox_threads')
      .insert({ user_id: userId, subject, status: 'open', thread_type: 'direct' })
      .select().single()
    if (thread) {
      await sb.from('inbox_messages').insert({ thread_id: thread.id, sender_id: adminId, body })
      loadThreads()
    }
  }

  const filtered = threads.filter(t => filter === 'all' ? true : t.status === filter)

  if (activeThread) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => { setActiveThread(null); setMessages([]) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'var(--font)' }}>
          ← Tillbaka
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{activeThread.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>
            {users[activeThread.user_id] || activeThread.user_id} ·
            {activeThread.thread_type === 'support' ? ' 🎫 Support' : ' 💬 Direkt'}
          </div>
        </div>
        <button className={`btn btn-sm ${activeThread.status === 'open' ? 'btn-ghost' : 'btn-primary'}`}
          onClick={() => toggleStatus(activeThread)}>
          {activeThread.status === 'open' ? '✓ Stäng ärende' : '↺ Återöppna'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {messages.map(m => {
          const isAdmin = m.sender_id === adminId
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                background: isAdmin ? 'var(--accent-dim)' : 'var(--bg3)',
                border: `1px solid ${isAdmin ? 'rgba(0,212,170,0.2)' : 'var(--border)'}`,
                borderRadius: isAdmin ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
              }}>{m.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3 }}>
                {isAdmin ? 'Du (admin)' : users[activeThread.user_id] || 'Användare'} · {formatFull(m.created_at)}
              </div>
            </div>
          )
        })}
      </div>

      {activeThread.status === 'open' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea className="form-control" rows={2} placeholder="Skriv svar… (⌘+Enter för att skicka)"
            value={replyBody} onChange={e => setReplyBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply() }}
            style={{ resize: 'none', flex: 1 }} />
          <button className="btn btn-primary" onClick={sendReply}
            disabled={sending || !replyBody.trim()} style={{ alignSelf: 'flex-end', flexShrink: 0 }}>
            {sending ? '…' : 'Svara'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', padding: '12px 0' }}>
          Ärendet är stängt.
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {['open','closed','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
            {f === 'open' ? 'Öppna' : f === 'closed' ? 'Stängda' : 'Alla'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text4)' }}>{filtered.length} ärenden</span>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga ärenden.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => setActiveThread(t)}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--r2)', padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                  {users[t.user_id] || t.user_id} ·
                  {t.thread_type === 'support' ? ' 🎫 Support' : ' 💬 Direkt'} ·
                  {formatFull(t.updated_at)}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                background: t.status === 'open' ? 'var(--green-dim)' : 'var(--bg4)',
                color: t.status === 'open' ? 'var(--green)' : 'var(--text4)'
              }}>{t.status === 'open' ? 'Öppet' : 'Stängt'}</span>
              <span style={{ color: 'var(--text4)', fontSize: 12 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('users')

  const TABS = [
    { id: 'users',     label: '👥 Användare' },
    { id: 'support',   label: '🎫 Support' },
    { id: 'broadcast', label: '📢 Meddelanden' },
  ]

  if (!isAdmin) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Administration" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Access denied</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Administration" />
      <div className="page-content">

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--text)' : 'var(--text3)',
                padding: '10px 16px',
                borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users'     && <UsersTab currentUserId={user?.id} />}
        {tab === 'support'   && <SupportTab adminId={user?.id} />}
        {tab === 'broadcast' && <BroadcastTab adminId={user?.id} />}
      </div>
    </div>
  )
}