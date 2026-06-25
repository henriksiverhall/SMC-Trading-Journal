import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { APP_VERSION } from '../lib/constants'

const icons = {
  dashboard: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>),
  journal:   (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  checklist: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>),
  analytics: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>),
  calendar:  (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>),
  profile:   (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  admin:     (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  roadmap:   (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  changelog: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>),
  logout:    (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  chevronLeft:  (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>),
  chevronRight: (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>),
}

export default function Sidebar({ activePage, onNavigate, onOpenChange }) {
  const [open, setOpen] = useState(true)
  const { isAdmin, signOut, unreadCount } = useAuth()

  function toggle() {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
    { id: 'journal',   label: 'Journal',   icon: icons.journal },
    { id: 'checklist', label: 'Checklist', icon: icons.checklist },
    { id: 'analytics', label: 'Analytics', icon: icons.analytics },
    { id: 'calendar',  label: 'Kalender',  icon: icons.calendar },
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">TL</div>
        {open && (
          <div>
            <div className="sidebar-logo-text">TradeLog</div>
            <div className="sidebar-logo-version">{APP_VERSION}</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(item => (
          <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)} title={!open ? item.label : undefined}>
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}

        {isAdmin && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 8 }}>Admin</div>
            <button className={`nav-item ${activePage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')} title={!open ? 'Administration' : undefined}>
              <span style={{ position: 'relative', flexShrink: 0 }}>
                {icons.admin}
                {unreadCount > 0 && !open && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1px solid var(--bg2)' }} />
                )}
              </span>
              <span className="nav-label">Administration</span>
              {unreadCount > 0 && open && (
                <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: '16px' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button className={`nav-item ${activePage === 'roadmap' ? 'active' : ''}`}
              onClick={() => onNavigate('roadmap')} title={!open ? 'Roadmap' : undefined}>
              {icons.roadmap}<span className="nav-label">Roadmap</span>
            </button>
            <button className={`nav-item ${activePage === 'changelog' ? 'active' : ''}`}
              onClick={() => onNavigate('changelog')} title={!open ? 'Changelog' : undefined}>
              {icons.changelog}<span className="nav-label">Changelog</span>
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className={`nav-item ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile')} title={!open ? 'Profil' : undefined}>
          <span style={{ position: 'relative', flexShrink: 0 }}>
            {icons.profile}
            {unreadCount > 0 && !open && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '1px solid var(--bg2)' }} />
            )}
          </span>
          <span className="nav-label">Profil</span>
          {unreadCount > 0 && open && (
            <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#000', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center', lineHeight: '16px' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button className="nav-item" onClick={signOut} title={!open ? 'Logga ut' : undefined}>
          {icons.logout}<span className="nav-label">Logga ut</span>
        </button>
        <button className="sidebar-toggle" onClick={toggle}>
          {open ? icons.chevronLeft : icons.chevronRight}
        </button>
      </div>
    </aside>
  )
}
