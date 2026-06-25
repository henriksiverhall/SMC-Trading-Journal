import { useState, useEffect, useRef } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { APP_VERSION } from '../lib/constants'
import Topbar from '../components/Topbar'

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none',
      borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      color: active ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font)', fontSize: 13,
      fontWeight: active ? 700 : 500, padding: '10px 18px', cursor: 'pointer',
      transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

function Badge({ count, color = 'var(--accent)', textColor = '#000' }) {
  if (!count) return null
  return <span style={{ marginLeft: 6, background: color, color: textColor, borderRadius: 20, fontSize: 10, fontWeight: 800, padding: '1px 6px', display: 'inline-block' }}>{count}</span>
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Igår'
  if (diff < 7) return d.toLocaleDateString('sv-SE', { weekday: 'short' })
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function BroadcastSection({ user, refreshUnread }) {
  const [messages, setMessages] = useState([])
  const [readIds, setReadIds] = useState(new Set())
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: msgs }, { data: reads }] = await Promise.all([
      sb.from('messages').select('*').eq('is_published', true).order('published_at', { ascending: false }),
      sb.from('message_reads').select('message_id').eq('user_id', user.id)
    ])
    setMessages(msgs || [])
    setReadIds(new Set((reads || []).map(r => r.message_id)))
    setLoading(false)
  }

  async function markRead(msgId) {
    if (readIds.has(msgId)) return
    await sb.from('message_reads').upsert({ user_id: user.id, message_id: msgId })
    setReadIds(prev => new Set([...prev, msgId]))
    refreshUnread(user.id)
  }

  function toggle(id) { setExpanded(e => e === id ? null : id); markRead(id) }

  if (loading) return <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
  if (!messages.length) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>Inga allmänna meddelanden ännu.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map(m => {
        const isRead = readIds.has(m.id)
        const isOpen = expanded === m.id
        return (
          <div key={m.id} onClick={() => toggle(m.id)} style={{
            background: 'var(--bg2)', border: `1px solid ${!isRead ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--r2)', padding: '14px 18px', cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = !isRead ? 'rgba(0,212,170,0.3)' : 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
              <div style={{ flex: 1, fontWeight: isRead ? 500 : 700, fontSize: 14, color: 'var(--text)' }}>{m.title}</div>
              <span style={{ fontSize: 11, color: 'var(--text4)', flexShrink: 0 }}>{formatTime(m.published_at)}</span>
              <span style={{ color: 'var(--text4)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {m.body}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InboxSection({ user, refreshUnread }) {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { loadThreads() }, [])
  useEffect(() => { if (activeThread) loadMessages(activeThread.id) }, [activeThread?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [threadMessages])

  async function loadThreads() {
    const { data } = await sb.from('inbox_threads')
      .select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setThreads(data || []); setLoading(false)
  }

  async function loadMessages(threadId) {
    const { data } = await sb.from('inbox_messages')
      .select('*').eq('thread_id', threadId).order('created_at', { ascending: true })
    setThreadMessages(data || [])
    const unread = (data || []).filter(m => m.sender_id !== user.id && !m.read_at)
    if (unread.length > 0) {
      await Promise.all(unread.map(m => sb.from('inbox_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)))
      refreshUnread(user.id)
    }
  }

  async function createThread() {
    if (!newSubject.trim() || !newBody.trim()) return
    setSending(true)
    const { data: thread } = await sb.from('inbox_threads')
      .insert({ user_id: user.id, subject: newSubject.trim(), status: 'open', thread_type: 'support' })
      .select().single()
    if (thread) {
      await sb.from('inbox_messages').insert({ thread_id: thread.id, sender_id: user.id, body: newBody.trim() })
      setNewSubject(''); setNewBody(''); setShowNew(false)
      await loadThreads(); setActiveThread(thread)
    }
    setSending(false)
  }

  async function sendReply() {
    if (!replyBody.trim() || !activeThread) return
    setSending(true)
    await sb.from('inbox_messages').insert({ thread_id: activeThread.id, sender_id: user.id, body: replyBody.trim() })
    await sb.from('inbox_threads').update({ updated_at: new Date().toISOString() }).eq('id', activeThread.id)
    setReplyBody(''); await loadMessages(activeThread.id); await loadThreads(); setSending(false)
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>

  if (activeThread) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => { setActiveThread(null); setThreadMessages([]) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'var(--font)' }}>
          ← Tillbaka
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{activeThread.subject}</div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: activeThread.status === 'open' ? 'var(--green-dim)' : 'var(--bg4)', color: activeThread.status === 'open' ? 'var(--green)' : 'var(--text4)' }}>
            {activeThread.status === 'open' ? '● Öppet' : '✓ Stängt'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, minHeight: 80 }}>
        {threadMessages.length === 0 && <div style={{ color: 'var(--text4)', fontSize: 12, padding: '12px 0' }}>Inga meddelanden än.</div>}
        {threadMessages.map(m => {
          const isMe = m.sender_id === user.id
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '10px 14px',
                background: isMe ? 'var(--accent-dim)' : 'var(--bg3)',
                border: `1px solid ${isMe ? 'rgba(0,212,170,0.25)' : 'var(--border)'}`,
                borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>{m.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, padding: '0 4px' }}>
                {isMe ? 'Du' : 'Support'} · {formatTime(m.created_at)}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {activeThread.status === 'open' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea className="form-control" rows={2} placeholder="Skriv ett svar… (Ctrl+Enter)"
            value={replyBody} onChange={e => setReplyBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }}
            style={{ resize: 'none', flex: 1 }} />
          <button className="btn btn-primary" onClick={sendReply} disabled={sending || !replyBody.trim()} style={{ flexShrink: 0 }}>
            {sending ? '…' : 'Skicka'}
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', padding: '12px 0', background: 'var(--bg3)', borderRadius: 'var(--r)' }}>
          Detta ärende är stängt.
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(s => !s)}>{showNew ? 'Avbryt' : '+ Nytt ärende'}</button>
      </div>

      {showNew && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Nytt support-ärende</div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Ämne</label>
            <input className="form-control" placeholder="Beskriv ditt ärende kort…" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Meddelande</label>
            <textarea className="form-control" rows={4} placeholder="Beskriv i detalj…" value={newBody} onChange={e => setNewBody(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <button className="btn btn-primary" onClick={createThread} disabled={sending || !newSubject.trim() || !newBody.trim()}>
            {sending ? 'Skickar…' : 'Skicka ärende'}
          </button>
        </div>
      )}

      {!threads.length ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Inga ärenden ännu.<br /><span style={{ fontSize: 12 }}>Klicka "+ Nytt ärende" för att kontakta support.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.map(t => (
            <div key={t.id} onClick={() => setActiveThread(t)} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
              padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--text4)' }}>{t.thread_type === 'support' ? '🎫 Support' : '💬 Direkt'} · {formatTime(t.updated_at)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: t.status === 'open' ? 'var(--green-dim)' : 'var(--bg4)', color: t.status === 'open' ? 'var(--green)' : 'var(--text4)' }}>
                {t.status === 'open' ? 'Öppet' : 'Stängt'}
              </span>
              <span style={{ color: 'var(--text4)', fontSize: 12 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KontoTab({ user, userSettings, saveSettings, signOut }) {
  const [displayName, setDisplayName] = useState(userSettings?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tradeCount, setTradeCount] = useState(0)
  const [pwNew, setPwNew] = useState('')
  const [pwRepeat, setPwRepeat] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    if (!user) return
    setDisplayName(userSettings?.displayName || '')
    sb.from('trades').select('id', { count: 'exact' }).eq('user_id', user.id).then(({ count }) => setTradeCount(count || 0))
  }, [user, userSettings])

  async function handleSaveProfile(e) {
    e.preventDefault(); setSaving(true); setMsg('')
    await saveSettings({ displayName })
    setMsg('Sparat!'); setTimeout(() => setMsg(''), 2000); setSaving(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault(); setPwMsg('')
    if (pwNew.length < 6) { setPwMsg('Minst 6 tecken krävs'); return }
    if (pwNew !== pwRepeat) { setPwMsg('Lösenorden matchar inte'); return }
    const { error } = await sb.auth.updateUser({ password: pwNew })
    if (error) setPwMsg(error.message)
    else { setPwMsg('Lösenord uppdaterat!'); setPwNew(''); setPwRepeat('') }
  }

  async function handleDeleteAccount() {
    if (!confirm('Radera ditt konto och all tradingdata? Detta kan inte ångras.')) return
    await sb.from('deletion_requests').insert({ user_id: user.id, status: 'pending' })
    alert('Begäran om radering skickad. Ditt konto raderas inom 30 dagar.')
    signOut()
  }

  const lbl = { fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
  const val = { fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Konto</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><div style={lbl}>E-post</div><div style={val}>{user?.email}</div></div>
            <div><div style={lbl}>Loggade trades</div><div style={{ ...val, color: 'var(--accent)', fontWeight: 700 }}>{tradeCount}</div></div>
            <div><div style={lbl}>Medlem sedan</div><div style={val}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('sv-SE') : '—'}</div></div>
            <div><div style={lbl}>Version</div><div style={{ ...val, color: 'var(--text3)' }}>{APP_VERSION}</div></div>
          </div>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Visningsnamn</label>
              <input className="form-control" type="text" placeholder="Ditt namn" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{msg || (saving ? 'Sparar…' : 'Spara')}</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Byt lösenord</div></div>
        <div className="card-body">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Nytt lösenord</label>
              <input className="form-control" type="password" placeholder="Minst 6 tecken" value={pwNew} onChange={e => setPwNew(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Upprepa nytt lösenord</label>
              <input className="form-control" type="password" placeholder="Upprepa lösenordet" value={pwRepeat} onChange={e => setPwRepeat(e.target.value)} style={{ borderColor: pwRepeat && pwRepeat !== pwNew ? 'var(--red)' : undefined }} />
              {pwRepeat && pwRepeat !== pwNew && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Lösenorden matchar inte</div>}
            </div>
            {pwMsg && <div className={pwMsg.includes('uppdaterat') ? 'auth-success' : 'auth-error'}>{pwMsg}</div>}
            <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} disabled={!pwNew || !pwRepeat || pwNew !== pwRepeat}>Uppdatera lösenord</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Integritet</div></div>
        <div className="card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
          <p>Dina tradingdata är privata och enbart synliga för dig. Vi säljer inte eller delar dina uppgifter med tredje part.</p>
          <p style={{ marginTop: 8 }}>Du kan när som helst begära full radering av dina uppgifter nedan.</p>
        </div>
      </div>

      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="card-header"><div className="card-title" style={{ color: 'var(--red)' }}>Farlig zon</div></div>
        <div className="card-body">
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>Radera ditt konto och all tillhörande tradingdata permanent. Denna åtgärd kan inte ångras.</div>
          <button className="btn btn-danger" onClick={handleDeleteAccount}>Radera konto och data</button>
        </div>
      </div>
    </>
  )
}

export default function Profile() {
  const { user, userSettings, saveSettings, signOut, unreadBroadcast, unreadInbox, refreshUnread } = useAuth()
  const [tab, setTab] = useState('konto')

  function handleTabChange(newTab) {
    setTab(newTab)
    if (newTab === 'broadcast' || newTab === 'inbox') {
      refreshUnread(user?.id)
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Profil" />
      <div className="page-content" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <TabBtn active={tab === 'konto'} onClick={() => handleTabChange('konto')}>Konto</TabBtn>
          <TabBtn active={tab === 'broadcast'} onClick={() => handleTabChange('broadcast')}>
            Allmänt{unreadBroadcast > 0 && <Badge count={unreadBroadcast} />}
          </TabBtn>
          <TabBtn active={tab === 'inbox'} onClick={() => handleTabChange('inbox')}>
            Mina ärenden{unreadInbox > 0 && <Badge count={unreadInbox} color="var(--red)" textColor="#fff" />}
          </TabBtn>
        </div>

        {tab === 'konto'     && <KontoTab user={user} userSettings={userSettings} saveSettings={saveSettings} signOut={signOut} />}
        {tab === 'broadcast' && <BroadcastSection user={user} refreshUnread={refreshUnread} />}
        {tab === 'inbox'     && <InboxSection user={user} refreshUnread={refreshUnread} />}
      </div>
    </div>
  )
}
