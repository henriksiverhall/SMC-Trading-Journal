import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { APP_VERSION } from '../lib/constants'
import Topbar from '../components/Topbar'

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      color: active ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font)', fontSize: 13,
      fontWeight: active ? 700 : 500, padding: '10px 18px', cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
    }}>
      {children}
    </button>
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
    sb.from('trades').select('id', { count: 'exact' }).eq('user_id', user.id)
      .then(({ count }) => setTradeCount(count || 0))
  }, [user, userSettings])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true); setMsg('')
    await saveSettings({ displayName })
    setMsg('Sparat!')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwMsg('')
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

  const labelStyle = { fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
  const valueStyle = { fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Konto</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={labelStyle}>E-post</div>
              <div style={valueStyle}>{user?.email}</div>
            </div>
            <div>
              <div style={labelStyle}>Loggade trades</div>
              <div style={{ ...valueStyle, color: 'var(--accent)', fontWeight: 700 }}>{tradeCount}</div>
            </div>
            <div>
              <div style={labelStyle}>Medlem sedan</div>
              <div style={valueStyle}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('sv-SE') : '—'}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Version</div>
              <div style={{ ...valueStyle, color: 'var(--text3)' }}>{APP_VERSION}</div>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Visningsnamn</label>
              <input className="form-control" type="text" placeholder="Ditt namn"
                value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {msg || (saving ? 'Sparar…' : 'Spara')}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Byt lösenord</div></div>
        <div className="card-body">
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Nytt lösenord</label>
              <input className="form-control" type="password" placeholder="Minst 6 tecken"
                value={pwNew} onChange={e => setPwNew(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Upprepa nytt lösenord</label>
              <input className="form-control" type="password" placeholder="Upprepa lösenordet"
                value={pwRepeat} onChange={e => setPwRepeat(e.target.value)}
                style={{ borderColor: pwRepeat && pwRepeat !== pwNew ? 'var(--red)' : undefined }} />
              {pwRepeat && pwRepeat !== pwNew && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>Lösenorden matchar inte</div>
              )}
            </div>
            {pwMsg && (
              <div className={pwMsg.includes('uppdaterat') ? 'auth-success' : 'auth-error'}>{pwMsg}</div>
            )}
            <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}
              disabled={!pwNew || !pwRepeat || pwNew !== pwRepeat}>
              Uppdatera lösenord
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">Integritet</div></div>
        <div className="card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
          <p>Dina tradingdata är privata och enbart synliga för dig. Vi säljer inte eller delar dina uppgifter med tredje part.</p>
          <p style={{ marginTop: 8 }}>Genom att skapa ett konto på TradeLog accepterade du våra integritetsvillkor och användarvillkor.</p>
          <p style={{ marginTop: 8 }}>Du kan när som helst begära full radering av dina uppgifter nedan.</p>
        </div>
      </div>

      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="card-header">
          <div className="card-title" style={{ color: 'var(--red)' }}>Farlig zon</div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
            Radera ditt konto och all tillhörande tradingdata permanent. Denna åtgärd kan inte ångras.
          </div>
          <button className="btn btn-danger" onClick={handleDeleteAccount}>
            Radera konto och data
          </button>
        </div>
      </div>
    </>
  )
}

function MeddelandenTab({ user }) {
  const [messages, setMessages] = useState([])
  const [reads, setReads] = useState(new Set())
  const [inbox, setInbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeMsg, setActiveMsg] = useState(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: pub }, { data: readData }, { data: inboxData }] = await Promise.all([
        sb.from('messages').select('*').eq('is_published', true).order('created_at', { ascending: false }),
        sb.from('message_reads').select('message_id').eq('user_id', user.id),
        sb.from('inbox_messages')
          .select('*, inbox_threads!inner(user_id)')
          .eq('inbox_threads.user_id', user.id)
          .order('created_at', { ascending: false }),
      ])
      setMessages(pub || [])
      setReads(new Set((readData || []).map(r => r.message_id)))
      setInbox(inboxData || [])
      setLoading(false)
    }
    load()
  }, [user])

  async function markRead(msgId) {
    if (reads.has(msgId)) return
    await sb.from('message_reads').upsert({ user_id: user.id, message_id: msgId, read_at: new Date().toISOString() })
    setReads(r => new Set([...r, msgId]))
  }

  function openMsg(msg) {
    setActiveMsg(msg)
    markRead(msg.id)
  }

  if (loading) return <div style={{ color: 'var(--text3)', fontSize: 13, padding: 24 }}>Laddar…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header"><div className="card-title">📢 Meddelanden från TradeLog</div></div>
        {messages.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--text4)', fontSize: 13 }}>Inga meddelanden ännu.</div>
        ) : messages.map(m => {
          const unread = !reads.has(m.id)
          return (
            <div key={m.id} onClick={() => openMsg(m)}
              style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              {unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: unread ? 700 : 500, color: 'var(--text)', marginBottom: 2 }}>{m.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(m.created_at).toLocaleDateString('sv-SE')}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text4)' }}>→</span>
            </div>
          )
        })}
      </div>

      {inbox.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">✉️ Inkorg</div></div>
          {inbox.map(m => (
            <div key={m.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Meddelande</span>
                <span style={{ fontSize: 11, color: 'var(--text4)' }}>{new Date(m.created_at).toLocaleDateString('sv-SE')}</span>
              </div>
              <div style={{ color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>
      )}

      {activeMsg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setActiveMsg(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: '28px 32px', width: 600, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{activeMsg.title}</div>
              <button onClick={() => setActiveMsg(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 16 }}>{new Date(activeMsg.created_at).toLocaleDateString('sv-SE')}</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{activeMsg.content}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, userSettings, saveSettings, signOut, unreadCount } = useAuth()
  const [tab, setTab] = useState('konto')

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Profil" />
      <div className="page-content" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 0 }}>
          <TabBtn active={tab === 'konto'} onClick={() => setTab('konto')}>Konto</TabBtn>
          <TabBtn active={tab === 'meddelanden'} onClick={() => setTab('meddelanden')}>
            Meddelanden {unreadCount > 0 && <span style={{ marginLeft: 5, background: 'var(--accent)', color: '#000', borderRadius: 20, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>{unreadCount}</span>}
          </TabBtn>
        </div>

        {tab === 'konto' && (
          <KontoTab user={user} userSettings={userSettings} saveSettings={saveSettings} signOut={signOut} />
        )}
        {tab === 'meddelanden' && (
          <MeddelandenTab user={user} />
        )}
      </div>
    </div>
  )
}
