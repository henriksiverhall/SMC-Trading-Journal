import { useState, useEffect, useRef } from 'react'
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
import Messages from './pages/Messages'
import Calendar from './pages/Calendar'
import Import from './pages/Import'
import Privacy from './pages/Privacy'
import Sidebar from './components/Sidebar'

const VALID_PAGES = ['dashboard','journal','checklist','analytics','profile','admin','roadmap','changelog','messages','calendar','import']
const ADMIN_ONLY_PAGES = ['admin', 'roadmap', 'changelog']

export default function App() {
  // Integritetspolicy måste vara nåbar utan inloggning (GDPR-krav, länkas från
  // signup-formuläret). Hash-routing (#/privacy) istället för path-routing
  // eftersom Cloudflare Worker inte har server-side route-hantering för SPA:n.
  //
  // v2.0.64: window.location.hash lästes bara av vid FÖRSTA renderingen. Ett
  // klick på en vanlig <a href="#/privacy"> i samma flik (t.ex. från
  // AuthPage) byter bara webbläsarens URL utan att ladda om sidan – React
  // reagerar inte automatiskt på det, så komponentträdet renderades aldrig
  // om och Privacy-sidan visades aldrig. Fungerade bara från Profil eftersom
  // den länken har target="_blank" (ny flik = full omladdning = ny render).
  // Fix: lyssna på hashchange-eventet och håll hash i React-state.
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  if (hash === '#/privacy') return <Privacy />

  const { user, loading, isAdmin, impersonating, stopImpersonation } = useAuth()
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('tl_page')
    return VALID_PAGES.includes(saved) ? saved : 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bgStyle, setBgStyle] = useState({})
  const brandingRef = useRef(null)

  useEffect(() => {
    if (user && !isAdmin && ADMIN_ONLY_PAGES.includes(page)) setPage('dashboard')
  }, [user, isAdmin])

  useEffect(() => {
    const ADMIN_ID = 'a55874aa-d36a-4d07-a40f-778b3a66d671'
    import('./lib/supabase').then(({ sb }) => {
      sb.from('user_settings').select('settings').eq('user_id', ADMIN_ID).single()
        .then(({ data }) => { brandingRef.current = data?.settings?.branding || null; applyBg(page) })
    })
  }, [])

  function applyBg(currentPage) {
    const b = brandingRef.current
    if (!b?.showOn?.[currentPage]) { setBgStyle({}); return }
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    const url = isDark ? (b.heroImages?.dark || '/images/hero-dark.png') : (b.heroImages?.light || '/images/hero-light.png')
    const opacity = b.opacity?.page ?? 0.15
    setBgStyle({ backgroundImage:`url(${url})`, backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat', backgroundAttachment:'fixed', '--page-bg-opacity':opacity })
  }

  useEffect(() => { applyBg(page) }, [page])
  useEffect(() => { window.__tlNavigate = setPage; return () => { delete window.__tlNavigate } }, [setPage])
  useEffect(() => { sessionStorage.setItem('tl_page', page) }, [page])
  useEffect(() => {
    window.__tlOpenMobileMenu = () => setMobileMenuOpen(true)
    return () => { delete window.__tlOpenMobileMenu }
  }, [])
  useEffect(() => { setMobileMenuOpen(false) }, [page])
  // Skyddsnät: om en sida råkar bli bredare än viewport (t.ex. en widget som
  // inte krympt korrekt) kan hela dokumentet bli horisontellt scrollbart.
  // SPA:n byter bara innehåll utan full sidladdning, så en kvarvarande
  // horisontell scroll-position "läcker" till nästa sida och ser ut som att
  // dess fält "försvinner åt höger". Nollställ scroll-x vid varje sidbyte.
  useEffect(() => { window.scrollTo(0, window.scrollY); document.documentElement.scrollLeft = 0; document.body.scrollLeft = 0 }, [page])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', flexDirection:'column', gap:12 }}>
      <div style={{ width:36, height:36, background:'var(--accent-dim)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontWeight:800, fontSize:14 }}>TL</div>
      <div style={{ color:'var(--text3)', fontSize:13 }}>Loading…</div>
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
    messages:  <Messages />,
    calendar:  <Calendar />,
    import:    <Import />,
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        onOpenChange={setSidebarOpen}
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={setMobileMenuOpen}
      />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ position:'relative' }}>
        {Object.keys(bgStyle).length > 0 && (
          <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', backgroundImage:bgStyle.backgroundImage, backgroundSize:bgStyle.backgroundSize, backgroundPosition:bgStyle.backgroundPosition, backgroundRepeat:bgStyle.backgroundRepeat, opacity:bgStyle['--page-bg-opacity']||0.15 }} />
        )}
        {impersonating && (
          <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background:'rgba(245,158,11,0.95)', backdropFilter:'blur(4px)', padding:'8px 20px', display:'flex', alignItems:'center', gap:12, fontSize:13, fontWeight:600, color:'#000', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
            <span>👁 Visar som: <strong>{impersonating.email}</strong></span>
            <span style={{ color:'rgba(0,0,0,0.5)', fontSize:12 }}>Du är fortfarande inloggad som admin.</span>
            <button onClick={()=>{stopImpersonation();setPage('admin')}} style={{ marginLeft:'auto', background:'rgba(0,0,0,0.15)', border:'1px solid rgba(0,0,0,0.25)', borderRadius:6, padding:'4px 14px', fontSize:12, fontWeight:700, cursor:'pointer', color:'#000', fontFamily:'inherit' }}>✕ Avsluta</button>
          </div>
        )}
        <div style={{ position:'relative', zIndex:1, display:'contents' }}>
          {pages[page] || pages.dashboard}
        </div>
      </main>
    </div>
  )
}
