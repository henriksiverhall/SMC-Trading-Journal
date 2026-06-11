import { useState } from 'react'
import { sb } from '../lib/supabase'
import { APP_VERSION } from '../lib/constants'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | signup | confirm
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { display_name: displayName || email.split('@')[0] } }
    })
    if (error) setError(error.message)
    else setMode('confirm')
    setLoading(false)
  }

  return (
    <div className="auth-page">
      {/* Hero panel */}
      <div className="auth-hero">
        <div className="auth-hero-logo">
          <div className="auth-hero-logo-icon">TL</div>
          <div>
            <div className="auth-hero-logo-name">TradeLog</div>
          </div>
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
            <div className="auth-hero-stat">
              <div className="auth-hero-stat-value">R</div>
              <div className="auth-hero-stat-label">Risk-based tracking</div>
            </div>
            <div className="auth-hero-stat">
              <div className="auth-hero-stat-value">AI</div>
              <div className="auth-hero-stat-label">Pattern analysis</div>
            </div>
            <div className="auth-hero-stat">
              <div className="auth-hero-stat-value">∞</div>
              <div className="auth-hero-stat-label">Trades logged</div>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          TradeLog {APP_VERSION} · journal.smctrading.se
        </div>
      </div>

      {/* Auth panel */}
      <div className="auth-panel">
        {mode === 'confirm' ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Check your email</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
              We sent a confirmation link to<br />
              <strong style={{ color: 'var(--text)' }}>{email}</strong><br /><br />
              Click the link to activate your account.
            </div>
            <button className="btn btn-ghost" onClick={() => setMode('login')}>Back to login</button>
          </div>
        ) : (
          <>
            <div className="auth-panel-header">
              <div className="auth-panel-title">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </div>
              <div className="auth-panel-sub">
                {mode === 'login'
                  ? 'Sign in to your TradeLog account'
                  : 'Start tracking your trades today'}
              </div>
            </div>

            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form className="auth-form" onSubmit={mode === 'login' ? handleLogin : handleSignup}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Display name</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. Henrik S."
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    autoComplete="nickname"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'signup' && (
                <p style={{ fontSize: 11, color: 'var(--text4)', lineHeight: 1.6 }}>
                  By creating an account you agree to our{' '}
                  <span style={{ color: 'var(--text3)', textDecoration: 'underline', cursor: 'pointer' }}>
                    Privacy Policy
                  </span>.
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ justifyContent: 'center', marginTop: 4 }}
                disabled={loading}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError('') }}>Sign up</button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button onClick={() => { setMode('login'); setError('') }}>Sign in</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
