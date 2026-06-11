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
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
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
    setMsg('Saved!')
    setTimeout(() => setMsg(''), 2000)
    setSaving(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwMsg('')
    if (pwNew.length < 6) { setPwMsg('Min. 6 characters'); return }
    const { error } = await sb.auth.updateUser({ password: pwNew })
    if (error) setPwMsg(error.message)
    else { setPwMsg('Password updated!'); setPwOld(''); setPwNew('') }
  }

  async function handleDeleteAccount() {
    if (!confirm('Delete your account and all data? This cannot be undone.')) return
    await sb.from('deletion_requests').insert({ user_id: user.id, status: 'pending' })
    alert('Deletion request submitted. Your account will be removed within 30 days.')
    signOut()
  }

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Profile" />
      <div className="page-content" style={{ maxWidth: 640 }}>

        {/* Account info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Account</div></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{user?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Trades logged</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{tradeCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Member since</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Version</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{APP_VERSION}</div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Display name</label>
                <input className="form-control" type="text" placeholder="Your name"
                  value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {msg || (saving ? 'Saving…' : 'Save')}
              </button>
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Change Password</div></div>
          <div className="card-body">
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-control" type="password" placeholder="Min. 6 characters"
                  value={pwNew} onChange={e => setPwNew(e.target.value)} />
              </div>
              {pwMsg && (
                <div className={pwMsg.includes('updated') ? 'auth-success' : 'auth-error'}>{pwMsg}</div>
              )}
              <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
                Update password
              </button>
            </form>
          </div>
        </div>

        {/* Privacy */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Privacy</div></div>
          <div className="card-body" style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
            <p>Your trading data is private and only visible to you. We do not sell or share your data with third parties. For questions, contact us via the email address on your account marked "Privacy".</p>
            <p style={{ marginTop: 8 }}>You can request full data deletion below at any time.</p>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="card-header">
            <div className="card-title" style={{ color: 'var(--red)' }}>Danger Zone</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
              Permanently delete your account and all associated trading data. This action cannot be undone.
            </div>
            <button className="btn btn-danger" onClick={handleDeleteAccount}>
              Delete account & data
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
