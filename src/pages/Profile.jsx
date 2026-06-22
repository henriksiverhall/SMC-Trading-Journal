import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { APP_VERSION } from '../lib/constants'
import Topbar from '../components/Topbar'

export default function Profile() {
  const { user, userSettings, saveSettings, signOut } = useAuth()
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
    <div style={{ flex: 1 }}>
      <Topbar title="Profil" />
      <div className="page-content" style={{ maxWidth: 640 }}>

        {/* Kontoinformation */}
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

        {/* Byt lösenord */}
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

        {/* Integritet */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Integritet</div></div>
          <div className="card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
            <p>Dina tradingdata är privata och enbart synliga för dig. Vi säljer inte eller delar dina uppgifter med tredje part.</p>
            <p style={{ marginTop: 8 }}>Genom att skapa ett konto på TradeLog accepterade du våra integritetsvillkor och användarvillkor. Vid frågor, kontakta oss via den e-postadress som är kopplad till ditt konto.</p>
            <p style={{ marginTop: 8 }}>Du kan när som helst begära full radering av dina uppgifter nedan.</p>
          </div>
        </div>

        {/* Farlig zon */}
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

      </div>
    </div>
  )
}
