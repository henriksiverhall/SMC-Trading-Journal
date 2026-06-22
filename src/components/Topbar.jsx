import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import PiPWidget from './PiPWidget'

export default function Topbar({ title, subtitle, actions }) {
  const { user, userSettings, signOut } = useAuth()
  const initial = (userSettings?.displayName || user?.email || 'U')[0].toUpperCase()
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('tl_theme')
    return saved ? saved === 'dark' : true
  })
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('tl_theme', dark ? 'dark' : 'light')
  }, [dark])

  // Stäng dropdown om man klickar utanför
  useEffect(() => {
    function handleClickOutside(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--text4)', fontWeight: 500 }}>{subtitle}</span>}
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      <div className="topbar-right">
        <PiPWidget />
        <button
          className="theme-toggle"
          onClick={() => setDark(d => !d)}
          title={dark ? 'Växla till ljust tema' : 'Växla till mörkt tema'}
        >
          {dark ? '☀️' : '🌙'}
        </button>

        {/* Avatar med dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <div
            className="avatar"
            title={user?.email}
            onClick={() => setAvatarOpen(o => !o)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            {initial}
          </div>
          {avatarOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 180,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r2)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              zIndex: 1000, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 2 }}>Inloggad som</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, wordBreak: 'break-all' }}>{user?.email}</div>
              </div>
              <a href="/profile" onClick={() => setAvatarOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  color: 'var(--text2)', textDecoration: 'none', fontSize: 13,
                  transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                👤 Profil
              </a>
              <button onClick={() => { setAvatarOpen(false); signOut() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                  color: 'var(--red)', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                  transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                🚪 Logga ut
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
