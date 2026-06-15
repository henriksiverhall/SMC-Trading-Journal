import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Journal from './pages/Journal'
import Checklist from './pages/Checklist'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Roadmap from './pages/Roadmap'
import Changelog from './pages/Changelog'
import Sidebar from './components/Sidebar'

const VALID_PAGES = ['dashboard','journal','checklist','analytics','profile','admin','roadmap','changelog']

export default function App() {
  const { user, loading, isAdmin } = useAuth()
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('tl_page')
    return VALID_PAGES.includes(saved) ? saved : 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    sessionStorage.setItem('tl_page', page)
  }, [page])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>TL</div>
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
    </div>
  )

  if (!user) return <AuthPage />

  const pages = {
    dashboard: <Dashboard onNavigate={setPage} />,
    journal:   <Journal />,
    checklist: <Checklist />,
    analytics: <Analytics />,
    profile:   <Profile />,
    admin:     <Admin />,
    roadmap:   <Roadmap />,
    changelog: isAdmin ? <Changelog /> : <Dashboard onNavigate={setPage} />,
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={page} onNavigate={setPage} onOpenChange={setSidebarOpen} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {pages[page] || pages.dashboard}
      </main>
    </div>
  )
}
