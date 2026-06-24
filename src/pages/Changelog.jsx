import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.34-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin e-postbyte: anropet skyddas nu av Supabase JWT istället för KANBAN_SECRET – ingen hemlig nökkel i frontend-koden.' },
      { type: 'improvement', text: 'Worker /admin/update-user: tillåter bara e-postbyte (inte lösenord), verifierar att anroparen är admin via JWT.' },
    ]
  },
  {
    version: 'v2.0.33-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'AuthPage: "Glömt lösenord"-länk öppnar modal – användaren skriver sin e-post och får återställningsmail utan att lämna inloggningssidan.' },
    ]
  },
  {
    version: 'v2.0.32-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin UserProfileModal: fullständiga admin-verktyg – ändra e-post, skicka lösenordsåterställning.' },
      { type: 'fix', text: 'Profile: unread-badge visas korrekt per flik. Admin Support-vy: maxWidth 860px. Dashboard: öppna ärenden visas separat.' },
    ]
  },
  {
    version: 'v2.0.31-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'useAuth: separata unreadBroadcast + unreadInbox räknare. signOut rensar sessionStorage.tl_page.' },
    ]
  },
  {
    version: 'v2.0.30-dev',
    date: '2026-06-24',
    entries: [
      { type: 'improvement', text: 'Sidebar: Meddelanden-menyval borttaget. Badge på Profil-knappen vid olästa.' },
      { type: 'feature', text: 'Profil: tre flikar – Konto, Allmänt, Mina ärenden. Dashboard: välkommen-widget med olästa-knapp.' },
    ]
  },
  {
    version: 'v2.0.29-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin: klick på rad öppnar profilmodal med kontodetaljer och tradingstatistik.' },
    ]
  },
  {
    version: 'v2.0.28-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Roadmap: kollaps-state i localStorage, arkivfunktion.' },
    ]
  },
  {
    version: 'v2.0.27-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Impersonation: persist via sessionStorage. Journal + Dashboard stöder "Visa som".' },
    ]
  },
  {
    version: 'v2.0.26-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Analytics: egna fält som analysdimension. Admin: impersonation-banner.' },
    ]
  },
  {
    version: 'v2.0.25-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Analytics: SL-optimerare, psykologisk analys.' },
    ]
  },
  {
    version: 'v2.0.24-dev',
    date: '2026-06-24',
    entries: [
      { type: 'fix', text: 'DragGrid: columns/span-prop fungerar korrekt.' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard: välkomstbanner, session-countdown, Idag-widget.' },
      { type: 'feature', text: 'Analytics: Expectancy, Recovery Factor, WR per veckodag.' },
    ]
  },
  {
    version: 'v2.0.21-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Admin Branding: bakgrundsbilder, transparens, per-sida-val.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filterrad, strategi-dropdown, kolumnsortering. PiP: BroadcastChannel.' },
    ]
  },
  {
    version: 'v2.0.15-dev',
    date: '2026-06-21',
    entries: [
      { type: 'feature', text: 'PiP-widget (Chromium), Checklist portad med editor.' },
    ]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [
      { type: 'feature', text: 'Widget-system DragGrid, Meddelanden, Journal MFE/MAE.' },
    ]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [
      { type: 'infra', text: 'React 18 + Vite 5, Cloudflare Workers. Alla grundsidor portade.' },
    ]
  },
]

const TYPE_CONFIG = {
  feature:     { label: 'Feature',     bg: 'rgba(0,212,170,0.12)',  color: 'var(--accent)' },
  fix:         { label: 'Fix',         bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  infra:       { label: 'Infra',       bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
  improvement: { label: 'Förbättring', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
}

export default function Changelog() {
  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Changelog" subtitle="Dev v2.0 – versionshistorik" />
      <div className="page-content" style={{ maxWidth: 760 }}>
        {CHANGELOG.map((release, ri) => (
          <div key={release.version} style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: ri === 0 ? 'var(--accent)' : 'var(--text)', ...(ri === 0 ? { textShadow: '0 0 20px rgba(0,212,170,0.25)' } : {}) }}>{release.version}</span>
              <span style={{ fontSize: 12, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{release.date}</span>
              {ri === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 20, padding: '2px 8px' }}>SENASTE</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {release.entries.map((entry, ei) => {
                const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.feature
                return (
                  <div key={ei} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, flexShrink: 0, marginTop: 1, letterSpacing: 0.3, minWidth: 46, textAlign: 'center' }}>{cfg.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{entry.text}</span>
                  </div>
                )
              })}
            </div>
            {ri < CHANGELOG.length - 1 && <div style={{ borderBottom: '1px solid var(--border)', marginTop: 28 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
