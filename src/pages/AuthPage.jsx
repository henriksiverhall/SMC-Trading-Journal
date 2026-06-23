import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { APP_VERSION } from '../lib/constants'

const ADMIN_USER_ID = 'a55874aa-d36a-4d07-a40f-778b3a66d671'
const DEFAULT_DARK  = '/images/hero-dark.png'
const DEFAULT_LIGHT = '/images/hero-light.png'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [heroUrl, setHeroUrl] = useState(null)
  const [branding, setBrandingState] = useState(null)

  // Ladda branding-inställningar från admin-kontot
  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    sb.from('user_settings').select('settings').eq('user_id', ADMIN_USER_ID).single()
      .then(({ data }) => {
        const b = data?.settings?.branding
        setBrandingState(b || {})
        if (b?.showOn?.auth !== false) {
          const url = isDark
            ? (b?.heroImages?.dark || DEFAULT_DARK)
            : (b?.heroImages?.light || DEFAULT_LIGHT)
          setHeroUrl(url)
        }
      })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (password.length < 6) { setError('Lösenordet måste vara minst 6 tecken.'); setLoading(false); return }
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { display_name: displayName || email.split('@')[0] } }
    })
    if (error) setError(error.message)
    else setMode('confirm')
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'grid',
      gridTemplateColumns: 'clamp(220px, 22vw, 380px) clamp(320px, 26vw, 440px)',
    }}>
      {/* Full-screen background image */}
      {heroUrl && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${heroUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      )}

      {/* Hero panel – halvtransparent mot bakgrundsbilden */}
      <div className="auth-hero" style={{
        position: 'relative', zIndex: 1,
        background: heroUrl
          ? `linear-gradient(135deg, rgba(10,12,18,${branding?.opacity?.hero ?? 0.82}) 0%, rgba(10,12,18,${Math.max(0, (branding?.opacity?.hero ?? 0.82) - 0.27)}) 100%)`
          : undefined,
        backdropFilter: heroUrl ? 'blur(1px)' : undefined,
        borderRight: 'none',
      }}>
        <div className="auth-hero-logo">
          <div className="auth-hero-logo-icon">TL</div>
          <div><div className="auth-hero-logo-name">TradeLog</div></div>
        </div>
        <div className="auth-hero-content">
          <h1 className="auth-hero-headline">
            Track your trades.<br />
            <span>Master your edge.</span>
          </h1>
          <p className="auth-hero-sub">
            Professional trading journal built for futures and FX traders.
            R-based analytics, pre-trade checklists, and AI-powered insights — all in one place.
          </p>
          <div className="auth-hero-stats">
            <div className="auth-hero-stat" style={{ background: heroUrl ? 'rgba(255,255,255,0.05)' : undefined }}>
              <div className="auth-hero-stat-value">R</div>
              <div className="auth-hero-stat-label">Risk-based tracking</div>
            </div>
            <div className="auth-hero-stat" style={{ background: heroUrl ? 'rgba(255,255,255,0.05)' : undefined }}>
              <div className="auth-hero-stat-value">AI</div>
              <div className="auth-hero-stat-label">Pattern analysis</div>
            </div>
            <div className="auth-hero-stat" style={{ background: heroUrl ? 'rgba(255,255,255,0.05)' : undefined }}>
              <div className="auth-hero-stat-value">∞</div>
              <div className="auth-hero-stat-label">Trades logged</div>
            </div>
          </div>
        </div>
        <div className="auth-hero-footer">TradeLog {APP_VERSION} · journal.smctrading.se</div>
      </div>

      {/* Form panel – opak, ingen transparens */}
      <div className="auth-panel" style={{ position: 'relative', zIndex: 1 }}>
        {mode === 'confirm' ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Kontrollera din e-post</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
              Vi skickade en bekräftelselänk till<br />
              <strong style={{ color: 'var(--text)' }}>{email}</strong><br /><br />
              Klicka på länken för att aktivera ditt konto.
            </div>
            <button className="btn btn-ghost" onClick={() => setMode('login')}>Tillbaka till inloggning</button>
          </div>
        ) : (
          <>
            <div className="auth-panel-header">
              <div className="auth-panel-title">
                {mode === 'login' ? 'Välkommen tillbaka' : 'Skapa konto'}
              </div>
              <div className="auth-panel-sub">
                {mode === 'login' ? 'Logga in på ditt TradeLog-konto' : 'Börja logga dina trades idag'}
              </div>
            </div>

            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form className="auth-form" onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Visningsnamn</label>
                  <input className="form-control" type="text" placeholder="t.ex. Henrik S."
                    value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="nickname" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">E-post</label>
                <input className="form-control" type="email" placeholder="du@exempel.com"
                  value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Lösenord</label>
                <input className="form-control" type="password"
                  placeholder={mode === 'signup' ? 'Minst 6 tecken' : '••••••••'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
              {mode === 'signup' && (
                <p style={{ fontSize: 11, color: 'var(--text4)', lineHeight: 1.6 }}>
                  Genom att skapa ett konto accepterar du våra{' '}
                  <span style={{ color: 'var(--text3)', textDecoration: 'underline', cursor: 'pointer' }}>integritetsvillkor</span>.
                </p>
              )}
              <button type="submit" className="btn btn-primary w-full"
                style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
                {loading ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>Inget konto?{' '}<button onClick={() => { setMode('signup'); setError('') }}>Registrera dig</button></>
              ) : (
                <>Har du redan ett konto?{' '}<button onClick={() => { setMode('login'); setError('') }}>Logga in</button></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}