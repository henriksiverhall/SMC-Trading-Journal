import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import PiPWidget from './PiPWidget'

export default function Topbar({ title, subtitle, actions }) {
  const { user, userSettings } = useAuth()
  const initial = (userSettings?.displayName || user?.email || 'U')[0].toUpperCase()
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('tl_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('tl_theme', dark ? 'dark' : 'light')
  }, [dark])

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
        <div className="avatar" title={user?.email}>{initial}</div>
      </div>
    </header>
  )
}
