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
  const [heroOpacity, setHeroOpacity] = useState(0.82)
  const [formOpacity, setFormOpacity] = useState(1.0)

  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    sb.from('user_settings').select('settings').eq('user_id', ADMIN_USER_ID).single()
      .then(({ data }) => {
        const b = data?.settings?.branding
        if (b?.opacity?.hero != null) setHeroOpacity(b.opacity.hero)
        if (b?.opacity?.form != null) setFormOpacity(b.opacity.form)
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

  // rgba background colours directly – no CSS class interference
  const heroBg  = `rgba(10,12,18,${heroOpacity})`
  const formBg  = `rgba(10,12,18,${formOpacity})`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'grid',
      gridTemplateColumns: 'clamp(220px, 22vw, 380px) clamp(320px, 26vw, 440px)',
      fontFamily: 'var(--font)',
    }}>
      {/* Full-screen background image – behind everything */}
      {heroUrl && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${heroUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      )}

      {/* Hero panel – NO className, full inline styles */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 48, overflow: 'hidden',
        backgroundColor: heroBg,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, background: 'var(--accent-dim)',
            border: '1px solid rgba(0,212,170,0.3)', borderRadius: 'var(--r2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.5px',
          }}>TL</div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>TradeLog</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{
            fontSize: 44, fontWeight: 800, letterSpacing: '-2px',
            lineHeight: 1.05, color: 'var(--text)', margin: '0 0 18px',
          }}>
            Track your trades.<br />
            <span style={{ color: 'var(--accent)' }}>Master your edge.</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text3)', lineHeight: 1.65, maxWidth: 400, margin: 0 }}>
            Professional trading journal built for futures and FX traders.
            R-based analytics, pre-trade checklists, and AI-powered insights — all in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 40 }}>
            {[['R','Risk-based tracking'],['AI','Pattern analysis'],['∞','Trades logged']].map(([val, lbl]) => (
              <div key={val} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 'var(--r2)', padding: '14px 16px',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{val}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontWeight: 500 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12, color: 'var(--text4)' }}>
          TradeLog {APP_VERSION} · journal.smctrading.se
        </div>
      </div>

      {/* Form panel – NO className, full inline styles */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px', overflowY: 'auto',
        backgroundColor: formBg,
      }}>
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
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                {mode === 'login' ? 'Välkommen tillbaka' : 'Skapa konto'}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 6 }}>
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
