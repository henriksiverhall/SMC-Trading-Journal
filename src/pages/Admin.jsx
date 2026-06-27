// ── System-flik: ersätt bara SystemTab och BrandingTab – resten av Admin.jsx är oförändrat ──
// OBS: Denna fil är komplett Admin.jsx

import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { WORKER_URL } from '../lib/constants'
import Topbar from '../components/Topbar'

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatFull(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function UserProfileModal({ user: u, adminId, onClose, onDelete, onRefresh }) {
  const { startImpersonation } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('info')
  const [newEmail, setNewEmail] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: trades } = await sb.from('trades').select('outcome, result').eq('user_id', u.user_id)
      const withR = (trades || []).filter(t => t.result != null)
      const wins = withR.filter(t => t.outcome === 'W')
      const losses = withR.filter(t => t.outcome === 'L')
      const totalR = withR.reduce((a, t) => a + (t.result || 0), 0)
      const wr = withR.length ? (wins.length / withR.length * 100).toFixed(1) : null
      const winR = wins.reduce((a, t) => a + t.result, 0)
      const lossR = Math.abs(losses.reduce((a, t) => a + t.result, 0))
      const pf = lossR > 0 ? (winR / lossR).toFixed(2) : winR > 0 ? '∞' : '—'
      setStats({ total: (trades || []).length, withR: withR.length, wins: wins.length, losses: losses.length, totalR: totalR.toFixed(2), wr, pf })
      setLoading(false)
    }
    load()
  }, [u.user_id])

  function clearAction() { setActionMsg(''); setActionErr('') }

  async function handleChangeEmail() {
    if (!newEmail.trim() || !newEmail.includes('@')) { setActionErr('Ogiltig e-postadress'); return }
    setActionLoading(true); clearAction()
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) throw new Error('Ingen aktiv session')
      const resp = await fetch(`${WORKER_URL}/admin/update-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: u.user_id, updates: { email: newEmail.trim() } }),
      })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || 'Misslyckades')
      setActionMsg('E-post uppdaterad till ' + newEmail.trim())
      setNewEmail('')
      onRefresh && onRefresh()
    } catch (e) { setActionErr(e.message) }
    setActionLoading(false)
  }

  async function handleResetPassword() {
    setActionLoading(true); clearAction()
    try {
      const { error } = await sb.auth.resetPasswordForEmail(u.email, {
        redirectTo: 'https://smc-trading-journal-dev.henrik-siverhall.workers.dev',
      })
      if (error) throw error
      setActionMsg('Återställningsmail skickat till ' + u.email)
    } catch (e) { setActionErr(e.message) }
    setActionLoading(false)
  }

  const row = (label, value, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', color: color || 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  )

  const inp = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '7px 10px', fontSize: 13, fontFamily: 'var(--font)', boxSizing: 'border-box' }
  const SECTIONS = [{ id: 'info', label: 'Info' }, { id: 'email', label: '✏️ E-post' }, { id: 'resetpw', label: '📧 Återställning' }]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: '28px 32px', width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{u.email}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {u.is_admin && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 7px', borderRadius: 20 }}>Admin</span>}
              {u.settings?.ai_enabled && <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.12)', padding: '2px 7px', borderRadius: 20 }}>AI på</span>}
              <span style={{ fontSize: 10, fontWeight: 700, color: u.confirmed_at ? 'var(--green)' : 'var(--text4)', background: u.confirmed_at ? 'var(--green-dim)' : 'var(--bg4)', padding: '2px 7px', borderRadius: 20 }}>
                {u.confirmed_at ? '✓ Bekräftad' : 'Ej bekräftad'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => { setSection(s.id); clearAction() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: section === s.id ? 700 : 500, color: section === s.id ? 'var(--text)' : 'var(--text4)', padding: '8px 12px', borderBottom: `2px solid ${section === s.id ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, transition: 'color 0.15s' }}>
              {s.label}
            </button>
          ))}
        </div>
        {section === 'info' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Konto</div>
              {row('Registrerad', formatTime(u.created_at))}
              {row('Senaste inloggning', u.last_sign_in_at ? formatTime(u.last_sign_in_at) : '—')}
              {row('User ID', u.user_id.slice(0, 18) + '…', 'var(--text4)')}
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tradingstatistik</div>
              {loading ? <div style={{ fontSize: 13, color: 'var(--text4)', padding: '12px 0' }}>Laddar…</div> : (
                <>
                  {row('Antal trades', stats.total, 'var(--accent)')}
                  {stats.withR > 0 && <>
                    {row('Win Rate', stats.wr !== null ? stats.wr + '%' : '—', parseFloat(stats.wr) >= 50 ? 'var(--green)' : 'var(--red)')}
                    {row('Total R', (parseFloat(stats.totalR) > 0 ? '+' : '') + stats.totalR + 'R', parseFloat(stats.totalR) >= 0 ? 'var(--green)' : 'var(--red)')}
                    {row('Profit Factor', stats.pf)}
                    {row('V / F', `${stats.wins}V / ${stats.losses}F`)}
                  </>}
                  {stats.total === 0 && <div style={{ fontSize: 12, color: 'var(--text4)', padding: '8px 0' }}>Inga trades loggade ännu.</div>}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {u.user_id !== adminId && <button className="btn btn-primary btn-sm" onClick={() => { startImpersonation({ id: u.user_id, email: u.email }); window.__tlNavigate?.('dashboard'); onClose() }}>👁 Visa som</button>}
              {u.user_id !== adminId && <button onClick={() => { onDelete(u.user_id, u.email); onClose() }} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ta bort</button>}
            </div>
          </>
        )}
        {section === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nuvarande: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{u.email}</span></div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text4)', display: 'block', marginBottom: 6 }}>Ny e-postadress</label>
              <input style={inp} type="email" placeholder="ny@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleChangeEmail} disabled={actionLoading || !newEmail.trim()}>{actionLoading ? 'Sparar…' : 'Byt e-post'}</button>
            {actionMsg && <div style={{ fontSize: 13, color: 'var(--green)', padding: '8px 12px', background: 'var(--green-dim)', borderRadius: 'var(--r)' }}>✓ {actionMsg}</div>}
            {actionErr && <div style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r)' }}>✗ {actionErr}</div>}
          </div>
        )}
        {section === 'resetpw' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
              Skickar ett återställningsmail till <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{u.email}</span>.<br />
              Användaren sätter nytt lösenord via länken i mailet.
            </div>
            <button className="btn btn-primary" onClick={handleResetPassword} disabled={actionLoading}>{actionLoading ? 'Skickar…' : '📧 Skicka återställningsmail'}</button>
            {actionMsg && <div style={{ fontSize: 13, color: 'var(--green)', padding: '8px 12px', background: 'var(--green-dim)', borderRadius: 'var(--r)' }}>✓ {actionMsg}</div>}
            {actionErr && <div style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--r)' }}>✗ {actionErr}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function UsersTab({ currentUserId }) {
  const { startImpersonation } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await sb.rpc('get_admin_users')
    if (error) { console.error(error); setLoading(false); return }
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
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Användare ({users.length})</div>
          <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Uppdatera</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div> : (
            <table className="journal-table">
              <thead><tr><th>Email</th><th>Registrerad</th><th>Trades</th><th>Bekräftad</th><th>Admin</th><th>AI</th><th></th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ color: 'var(--text)' }} onClick={() => setSelectedUser(u)}>
                      <span style={{ fontWeight: 500 }}>{u.email}</span>
                      {u.user_id === currentUserId && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 3 }}>du</span>}
                    </td>
                    <td className="mono" onClick={() => setSelectedUser(u)}>{formatTime(u.created_at)}</td>
                    <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setSelectedUser(u)}>{u.trade_count}</td>
                    <td onClick={() => setSelectedUser(u)}><span style={{ fontSize: 11, color: u.confirmed_at ? 'var(--green)' : 'var(--text4)' }}>{u.confirmed_at ? '✓ Ja' : 'Nej'}</span></td>
                    <td onClick={() => setSelectedUser(u)}><span style={{ fontSize: 11, color: u.is_admin ? 'var(--accent)' : 'var(--text4)' }}>{u.is_admin ? '✓ Admin' : '—'}</span></td>
                    <td><button className={`btn btn-sm ${u.settings?.ai_enabled ? 'btn-primary' : 'btn-ghost'}`} onClick={e => { e.stopPropagation(); toggleAI(u.user_id, u.settings?.ai_enabled) }} disabled={u.user_id === currentUserId}>{u.settings?.ai_enabled ? 'På' : 'Av'}</button></td>
                    <td>{u.user_id !== currentUserId && <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); startImpersonation({ id: u.user_id, email: u.email }); window.__tlNavigate?.('dashboard') }} style={{ whiteSpace: 'nowrap' }}>👁 Visa som</button>}</td>
                    <td>{u.user_id !== currentUserId && <button className="btn btn-sm" onClick={e => { e.stopPropagation(); deleteUser(u.user_id, u.email) }} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ta bort</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {selectedUser && <UserProfileModal user={selectedUser} adminId={currentUserId} onClose={() => setSelectedUser(null)} onDelete={(id, email) => { deleteUser(id, email); setSelectedUser(null) }} onRefresh={loadUsers} />}
    </>
  )
}

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
    setMessages(data || []); setLoading(false)
  }

  function startEdit(m) { setEditingId(m.id); setTitle(m.title); setBody(m.body); setShowNew(false) }
  function cancelEdit() { setEditingId(null); setTitle(''); setBody('') }

  async function create(publish) {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    await sb.from('messages').insert({ title: title.trim(), body: body.trim(), created_by: adminId, is_published: publish, published_at: publish ? new Date().toISOString() : null })
    setTitle(''); setBody(''); setShowNew(false); await load(); setSaving(false)
  }

  async function saveEdit() {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    await sb.from('messages').update({ title: title.trim(), body: body.trim() }).eq('id', editingId)
    cancelEdit(); await load(); setSaving(false)
  }

  async function publish(id) { await sb.from('messages').update({ is_published: true, published_at: new Date().toISOString() }).eq('id', id); load() }
  async function unpublish(id) { await sb.from('messages').update({ is_published: false, published_at: null }).eq('id', id); load() }
  async function deleteMsg(id) { if (!window.confirm('Ta bort?')) return; await sb.from('messages').delete().eq('id', id); load() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowNew(s => !s); cancelEdit() }}>{showNew ? 'Avbryt' : '+ Nytt meddelande'}</button>
      </div>
      {showNew && (
        <div className="card">
          <div className="card-header"><div className="card-title">Nytt broadcast-meddelande</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Titel</label><input className="form-control" placeholder="t.ex. Ny funktion" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Innehåll</label><textarea className="form-control" rows={5} value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => create(true)} disabled={saving}>📢 Publicera nu</button>
              <button className="btn btn-ghost" onClick={() => create(false)} disabled={saving}>Spara som utkast</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
        : messages.length === 0 ? <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga meddelanden ännu.</div>
        : messages.map(m => (
          <div key={m.id} className="card">
            <div className="card-body">
              {editingId === m.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group"><label className="form-label">Titel</label><input className="form-control" value={title} onChange={e => setTitle(e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Innehåll</label><textarea className="form-control" rows={5} value={body} onChange={e => setBody(e.target.value)} style={{ resize: 'vertical' }} /></div>
                  <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>💾 Spara</button><button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Avbryt</button></div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: m.is_published ? 'var(--green-dim)' : 'var(--bg4)', color: m.is_published ? 'var(--green)' : 'var(--text4)' }}>{m.is_published ? '● Publicerat' : 'Utkast'}</span>
                      {m.published_at && <span style={{ fontSize: 11, color: 'var(--text4)' }}>{formatFull(m.published_at)}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{m.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {!m.is_published ? <button className="btn btn-primary btn-sm" onClick={() => publish(m.id)}>Publicera</button> : <button className="btn btn-ghost btn-sm" onClick={() => unpublish(m.id)}>Avpublicera</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(m)}>✏️ Redigera</button>
                    <button className="btn btn-sm" onClick={() => deleteMsg(m.id)} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Ta bort</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  )
}

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
    const { data: threadData } = await sb.from('inbox_threads').select('*').order('updated_at', { ascending: false })
    const { data: userData } = await sb.rpc('get_admin_users')
    const userMap = {}; userData?.forEach(u => userMap[u.user_id] = u.email)
    setUsers(userMap); setThreads(threadData || []); setLoading(false)
  }

  async function loadMessages(threadId) {
    const { data } = await sb.from('inbox_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
    setMessages(data || [])
    const unread = (data || []).filter(m => m.sender_id !== adminId && !m.read_at)
    for (const m of unread) await sb.from('inbox_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
  }

  async function sendReply() {
    if (!replyBody.trim() || !activeThread) return
    setSending(true)
    await sb.from('inbox_messages').insert({ thread_id: activeThread.id, sender_id: adminId, body: replyBody.trim() })
    await sb.from('inbox_threads').update({ updated_at: new Date().toISOString() }).eq('id', activeThread.id)
    setReplyBody(''); await loadMessages(activeThread.id); await loadThreads(); setSending(false)
  }

  async function toggleStatus(thread) {
    const newStatus = thread.status === 'open' ? 'closed' : 'open'
    await sb.from('inbox_threads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', thread.id)
    setActiveThread(t => t ? { ...t, status: newStatus } : t); loadThreads()
  }

  const filtered = threads.filter(t => filter === 'all' ? true : t.status === filter)

  if (activeThread) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => { setActiveThread(null); setMessages([]) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'var(--font)' }}>← Tillbaka</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{activeThread.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--text4)' }}>{users[activeThread.user_id] || activeThread.user_id} · {activeThread.thread_type === 'support' ? '🎫 Support' : '💬 Direkt'}</div>
        </div>
        <button className={`btn btn-sm ${activeThread.status === 'open' ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleStatus(activeThread)}>
          {activeThread.status === 'open' ? '✓ Stäng ärende' : '↺ Återöppna'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {messages.map(m => {
          const isAdmin = m.sender_id === adminId
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', padding: '10px 14px', background: isAdmin ? 'var(--accent-dim)' : 'var(--bg3)', border: `1px solid ${isAdmin ? 'rgba(0,212,170,0.2)' : 'var(--border)'}`, borderRadius: isAdmin ? '12px 12px 2px 12px' : '12px 12px 12px 2px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3 }}>{isAdmin ? 'Du (admin)' : users[activeThread.user_id] || 'Användare'} · {formatFull(m.created_at)}</div>
            </div>
          )
        })}
      </div>
      {activeThread.status === 'open' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea className="form-control" rows={2} placeholder="Skriv svar…" value={replyBody} onChange={e => setReplyBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply() }} style={{ resize: 'none', flex: 1 }} />
          <button className="btn btn-primary" onClick={sendReply} disabled={sending || !replyBody.trim()} style={{ alignSelf: 'flex-end', flexShrink: 0 }}>{sending ? '…' : 'Svara'}</button>
        </div>
      ) : <div style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', padding: '12px 0' }}>Ärendet är stängt.</div>}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {['open','closed','all'].map(f => <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>{f === 'open' ? 'Öppna' : f === 'closed' ? 'Stängda' : 'Alla'}</button>)}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text4)' }}>{filtered.length} ärenden</span>
      </div>
      {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
        : filtered.length === 0 ? <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga ärenden.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => setActiveThread(t)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>{users[t.user_id] || t.user_id} · {t.thread_type === 'support' ? '🎫 Support' : '💬 Direkt'} · {formatFull(t.updated_at)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: t.status === 'open' ? 'var(--green-dim)' : 'var(--bg4)', color: t.status === 'open' ? 'var(--green)' : 'var(--text4)' }}>{t.status === 'open' ? 'Öppet' : 'Stängt'}</span>
              <span style={{ color: 'var(--text4)', fontSize: 12 }}>›</span>
            </div>
          ))}
        </div>}
    </div>
  )
}

// ── System-flik ────────────────────────────────────────────────────────────────
// Workern returnerar: { primary: { ok, source, events, from, to, error }, fallback: {...} | null }
function SystemTab() {
  const [calStatus, setCalStatus] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)

  useEffect(() => { loadCalStatus() }, [])

  async function loadCalStatus() {
    const { data } = await sb.from('calendar_cache').select('week_key, fetched_at, data').order('week_key')
    if (data) {
      const byWeek = {}
      data.forEach(r => byWeek[r.week_key] = { fetched_at: r.fetched_at, count: Array.isArray(r.data) ? r.data.length : 0 })
      setCalStatus(byWeek)
    }
  }

  async function triggerRefresh() {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) throw new Error('Ingen aktiv session')
      const resp = await fetch(`${WORKER_URL}/calendar/refresh-admin`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const json = await resp.json()
      if (!resp.ok || json.error) throw new Error(json.error || `HTTP ${resp.status}`)
      setRefreshResult({ ok: true, data: json })
      await loadCalStatus()
    } catch (e) {
      setRefreshResult({ ok: false, error: e.message })
    }
    setRefreshing(false)
  }

  const info = calStatus?.['thisweek']
  const sourceLabel = { eodhd: 'EODHD', ff: 'ForexFactory' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">📅 Ekonomisk kalender – cache</div>
          <button className="btn btn-primary btn-sm" onClick={triggerRefresh} disabled={refreshing}>
            {refreshing ? '⏳ Hämtar…' : '↻ Uppdatera nu'}
          </button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.6 }}>
            Kalenderdata hämtas automatiskt varje natt via <strong>EODHD</strong> (14 dagar framåt) med ForexFactory som fallback.
            Klicka "Uppdatera nu" för att trigga en manuell refresh.
          </p>

          {/* Cache-status – en ruta för 14-dagarsperioden */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: `1px solid ${info ? 'var(--border2)' : 'var(--border)'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Cachad kalenderdata (14 dagar framåt)
              </div>
              {info ? (
                <>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                    {info.count} event
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                    Senast hämtad: {new Date(info.fetched_at).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text4)' }}>Ingen data i cache</div>
              )}
            </div>
          </div>

          {/* Resultat efter refresh */}
          {refreshResult && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--r)', fontSize: 13,
              background: refreshResult.ok ? 'var(--green-dim)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${refreshResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
              color: refreshResult.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {refreshResult.ok ? (() => {
                const { primary, fallback } = refreshResult.data
                const used = primary?.ok ? primary : fallback
                return (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>✓ Refresh lyckades</div>
                    {primary?.ok ? (
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                        Källa: <strong>{sourceLabel[primary.source] || primary.source}</strong> · {primary.events} event · {primary.from} → {primary.to}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>
                          EODHD misslyckades: {primary?.error}
                        </div>
                        {fallback?.ok ? (
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                            Fallback: <strong>{sourceLabel[fallback.source] || fallback.source}</strong> · {fallback.events} event
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--red)' }}>
                            Fallback misslyckades också: {fallback?.error}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })() : (
                <div><span style={{ fontWeight: 700 }}>✗ Refresh misslyckades:</span> {refreshResult.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const { user, isAdmin, unreadInbox } = useAuth()
  const [tab, setTab] = useState('users')

  const TABS = [
    { id: 'users',     label: '👥 Användare' },
    { id: 'support',   label: unreadInbox > 0 ? `🎫 Support (${unreadInbox} ny)` : '🎫 Support' },
    { id: 'broadcast', label: '📢 Meddelanden' },
    { id: 'branding',  label: '🖼 Branding' },
    { id: 'system',    label: '⚙️ System' },
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
      <div className="page-content" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? 'var(--text)' : 'var(--text3)', padding: '10px 16px', borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, transition: 'color 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'users'     && <UsersTab currentUserId={user?.id} />}
        {tab === 'support'   && <SupportTab adminId={user?.id} />}
        {tab === 'broadcast' && <BroadcastTab adminId={user?.id} />}
        {tab === 'branding'  && <BrandingTab adminId={user?.id} />}
        {tab === 'system'    && <SystemTab />}
      </div>
    </div>
  )
}

function BrandingTab({ adminId }) {
  const SUPABASE_URL = 'https://qmmpxupsxdouvoqgvgri.supabase.co'
  const ALL_PAGES = [
    { id: 'auth', label: 'Inloggningssida' }, { id: 'dashboard', label: 'Dashboard' },
    { id: 'journal', label: 'Journal' }, { id: 'analytics', label: 'Analytics' }, { id: 'checklist', label: 'Checklist' },
  ]
  const DEFAULT_SETTINGS = {
    heroImages: { dark: '/images/hero-dark.png', light: '/images/hero-light.png' },
    showOn: { auth: true, dashboard: false, journal: false, analytics: false, checklist: false },
    opacity: { hero: 0.82, form: 1.0, page: 0.15 },
  }
  const { userSettings, saveSettings } = useAuth()
  const [branding, setBranding] = useState(DEFAULT_SETTINGS)
  const [uploading, setUploading] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (userSettings?.branding) setBranding({ ...DEFAULT_SETTINGS, ...userSettings.branding }) }, [userSettings])

  function setOpacity(key, val) { setBranding(b => ({ ...b, opacity: { ...(b.opacity || {}), [key]: parseFloat(val) } })) }
  function setImage(theme, url) { setBranding(b => ({ ...b, heroImages: { ...b.heroImages, [theme]: url } })) }
  function togglePage(pageId) { setBranding(b => ({ ...b, showOn: { ...b.showOn, [pageId]: !b.showOn[pageId] } })) }

  async function handleUpload(theme, file) {
    if (!file) return; setUploading(theme)
    const name = `hero-${theme}.${file.name.split('.').pop()}`
    const { sb } = await import('../lib/supabase')
    const { error } = await sb.storage.from('branding').upload(name, file, { upsert: true })
    if (error) { alert('Upload misslyckades: ' + error.message); setUploading(null); return }
    setImage(theme, `${SUPABASE_URL}/storage/v1/object/public/branding/${name}`); setUploading(null)
  }

  async function handleSave() { await saveSettings({ branding }); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const inp = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font)', width: '100%' }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">🖼 Bakgrundsbilder</div>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>{saved ? '✓ Sparat' : 'Spara'}</button>
        </div>
        <div className="card-body">
          {['dark', 'light'].map(theme => (
            <div key={theme} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{theme === 'dark' ? '🌙 Mörkt tema' : '☀️ Ljust tema'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4, display: 'block' }}>Bild-URL</label>
                  <input style={inp} value={branding.heroImages[theme]} onChange={e => setImage(theme, e.target.value)} />
                  <label style={{ fontSize: 11, color: 'var(--text4)', marginTop: 8, marginBottom: 4, display: 'block' }}>Eller ladda upp</label>
                  <input type="file" accept="image/*" onChange={e => handleUpload(theme, e.target.files[0])} style={{ fontSize: 11, color: 'var(--text3)' }} />
                  {uploading === theme && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>Laddar upp…</div>}
                </div>
                {branding.heroImages[theme] && (
                  <div style={{ height: 120, borderRadius: 'var(--r)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg3)' }}>
                    <img src={branding.heroImages[theme]} alt={theme} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">📍 Visa på sidor</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {ALL_PAGES.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: `1px solid ${branding.showOn[p.id] ? 'var(--accent)' : 'var(--border)'}` }}>
                <input type="checkbox" checked={!!branding.showOn[p.id]} onChange={() => togglePage(p.id)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Genomskinlighet</div>
            {[{ key: 'hero', label: 'Hero-panel (inloggning)', def: 0.82 }, { key: 'form', label: 'Formulär-panel (inloggning)', def: 1.0 }, { key: 'page', label: 'Bakgrund på övriga sidor', def: 0.15 }].map(({ key, label, def }) => {
              const val = branding.opacity?.[key] ?? def
              const transPct = Math.round((1 - val) * 100)
              return (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                    <span>{label}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{transPct}% genomskinlig</span>
                  </div>
                  <input type="range" min="0" max="100" value={transPct} onChange={e => setOpacity(key, 1 - parseInt(e.target.value) / 100)} style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text4)', marginTop: 3 }}><span>Ogenomskinlig</span><span>Helt genomskinlig</span></div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
