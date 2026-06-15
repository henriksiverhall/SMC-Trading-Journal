import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return d.toLocaleDateString('sv-SE', { weekday: 'short' })
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function Badge({ count }) {
  if (!count) return null
  return (
    <span style={{
      background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700,
      borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center',
      lineHeight: '16px', display: 'inline-block'
    }}>{count > 99 ? '99+' : count}</span>
  )
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────
function BroadcastTab({ user, refreshUnread }) {
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
    setReadIds(s => new Set([...s, msgId]))
    refreshUnread(user.id)
  }

  function toggle(id) {
    setExpanded(e => e === id ? null : id)
    markRead(id)
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
  if (!messages.length) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Inga meddelanden ännu.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {messages.map(m => {
        const isRead = readIds.has(m.id)
        const isOpen = expanded === m.id
        return (
          <div key={m.id} onClick={() => toggle(m.id)}
            style={{
              background: 'var(--bg2)', border: `1px solid ${!isRead ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--r2)', padding: '14px 18px', cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: !isRead ? '0 0 0 1px rgba(0,212,170,0.1)' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = !isRead ? 'rgba(0,212,170,0.3)' : 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isRead && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, fontWeight: isRead ? 500 : 700, fontSize: 14, color: 'var(--text)' }}>{m.title}</div>
              <span style={{ fontSize: 11, color: 'var(--text4)', flexShrink: 0 }}>{formatTime(m.published_at)}</span>
              <span style={{ color: 'var(--text4)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap'
              }}>
                {m.body}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Inbox tab ─────────────────────────────────────────────────────────────────
function InboxTab({ user, refreshUnread }) {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => { loadThreads() }, [])
  useEffect(() => { if (activeThread) loadMessages(activeThread.id) }, [activeThread])

  async function loadThreads() {
    const { data } = await sb.from('inbox_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setThreads(data || [])
    setLoading(false)
  }

  async function loadMessages(threadId) {
    const { data } = await sb.from('inbox_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setThreadMessages(data || [])
    // Mark all unread messages from admin as read
    const unread = (data || []).filter(m => m.sender_id !== user.id && !m.read_at)
    for (const m of unread) {
      await sb.from('inbox_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
    }
    if (unread.length) refreshUnread(user.id)
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
      await loadThreads()
      setActiveThread(thread)
    }
    setSending(false)
  }

  async function sendReply() {
    if (!replyBody.trim() || !activeThread) return
    setSending(true)
    await sb.from('inbox_messages').insert({ thread_id: activeThread.id, sender_id: user.id, body: replyBody.trim() })
    await sb.from('inbox_threads').update({ updated_at: new Date().toISOString() }).eq('id', activeThread.id)
    setReplyBody('')
    await loadMessages(activeThread.id)
    await loadThreads()
    setSending(false)
  }

  function unreadInThread(thread) {
    // We'll rely on backend for now; placeholder
    return false
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>

  // Thread detail view
  if (activeThread) return (
    <div>
      <button onClick={() => { setActiveThread(null); setThreadMessages([]) }}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0, fontFamily: 'var(--font)' }}>
        ← Tillbaka
      </button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{activeThread.subject}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: activeThread.status === 'open' ? 'var(--green-dim)' : 'var(--bg4)',
            color: activeThread.status === 'open' ? 'var(--green)' : 'var(--text4)'
          }}>{activeThread.status === 'open' ? '● Öppet' : '✓ Stängt'}</span>
          <span style={{ fontSize: 11, color: 'var(--text4)' }}>{formatTime(activeThread.created_at)}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {threadMessages.map(m => {
          const isMe = m.sender_id === user.id
          return (
            <div key={m.id} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isMe ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px',
                background: isMe ? 'var(--accent-dim)' : 'var(--bg3)',
                border: `1px solid ${isMe ? 'rgba(0,212,170,0.2)' : 'var(--border)'}`,
                borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap'
              }}>
                {m.body}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3 }}>
                {isMe ? 'Du' : 'Support'} · {formatTime(m.created_at)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply */}
      {activeThread.status === 'open' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea className="form-control" rows={2} placeholder="Skriv ett svar…"
            value={replyBody} onChange={e => setReplyBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) sendReply() }}
            style={{ resize: 'none', flex: 1 }} />
          <button className="btn btn-primary" onClick={sendReply} disabled={sending || !replyBody.trim()}
            style={{ alignSelf: 'flex-end', flexShrink: 0 }}>
            {sending ? '…' : 'Skicka'}
          </button>
        </div>
      )}
      {activeThread.status === 'closed' && (
        <div style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', padding: '12px 0' }}>
          Detta ärende är stängt.
        </div>
      )}
    </div>
  )

  // Thread list
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(s => !s)}>
          {showNew ? 'Avbryt' : '+ Nytt ärende'}
        </button>
      </div>

      {showNew && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Skapa support-ärende</div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Ämne</label>
            <input className="form-control" placeholder="Beskriv ditt ärende kort…"
              value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Meddelande</label>
            <textarea className="form-control" rows={4} placeholder="Beskriv ditt ärende i detalj…"
              value={newBody} onChange={e => setNewBody(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <button className="btn btn-primary" onClick={createThread}
            disabled={sending || !newSubject.trim() || !newBody.trim()}>
            {sending ? 'Skickar…' : 'Skicka ärende'}
          </button>
        </div>
      )}

      {!threads.length ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Inga ärenden ännu.<br />
          <span style={{ fontSize: 12 }}>Klicka "+ Nytt ärende" för att kontakta support.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.map(t => (
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
                  {t.thread_type === 'support' ? '🎫 Support' : '💬 Direkt'} · {formatTime(t.updated_at)}
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
export default function Messages() {
  const { user, unreadCount, refreshUnread } = useAuth()
  const [tab, setTab] = useState('broadcast')
  const [broadcastUnread, setBroadcastUnread] = useState(0)
  const [inboxUnread, setInboxUnread] = useState(0)

  useEffect(() => { calcUnread() }, [user])

  async function calcUnread() {
    if (!user) return
    const [{ data: published }, { data: reads }, { data: unreadInbox }] = await Promise.all([
      sb.from('messages').select('id').eq('is_published', true),
      sb.from('message_reads').select('message_id').eq('user_id', user.id),
      sb.from('inbox_messages')
        .select('id, inbox_threads!inner(user_id)')
        .eq('inbox_threads.user_id', user.id)
        .neq('sender_id', user.id)
        .is('read_at', null)
    ])
    const readIds = new Set((reads || []).map(r => r.message_id))
    setBroadcastUnread((published || []).filter(m => !readIds.has(m.id)).length)
    setInboxUnread(unreadInbox?.length || 0)
  }

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Meddelanden" />
      <div className="page-content" style={{ maxWidth: 720 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { id: 'broadcast', label: 'Allmänt', count: broadcastUnread },
            { id: 'inbox',     label: 'Mina ärenden', count: inboxUnread },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--text)' : 'var(--text3)',
                padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {t.label}
              {t.count > 0 && <Badge count={t.count} />}
            </button>
          ))}
        </div>

        {tab === 'broadcast' && <BroadcastTab user={user} refreshUnread={refreshUnread} />}
        {tab === 'inbox'     && <InboxTab user={user} refreshUnread={refreshUnread} />}
      </div>
    </div>
  )
}
