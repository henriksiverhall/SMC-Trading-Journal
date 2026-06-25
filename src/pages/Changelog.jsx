import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.39-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: ny sida i sidomenyn. ForexFactory-data via Worker-proxy. Filter på impact (Hög/Medium/Låg), valuta (USD/EUR/GBP/JPY/CAD/AUD/NZD/CHF), tidsperiod (Denna vecka / Nästa vecka / Idag). Händelser grupperade per dag, sorterade på impact sedan tid. Aktuellt utfall/prognos/föregående visas.' },
    ]
  },
  {
    version: 'v2.0.38-dev',
    date: '2026-06-25',
    entries: [
      { type: 'improvement', text: 'Dashboard: statistik borttagen från välkomstwidget (finns i Statistik-widget under). Klockor högerställda mot RTH-rutan.' },
    ]
  },
  {
    version: 'v2.0.37-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Dashboard: 4 analoga sessionsklockor (Din tid + London/NY/Tokyo). Varje marknadsklocka visar stadens lokala tid, sessionsbåge för handelstider, nedräkning HH:MM:SS till open/close. RTH-instrumentruta för Guld/Olja/ES·NQ·YM. Tema-kompatibla CSS-variabler.' },
    ]
  },
  {
    version: 'v2.0.36-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Analytics: CustomFieldsWidget expand/kollaps per fält, max 10 rader, backtest-nycklar filtreras.' },
      { type: 'fix', text: 'Admin + Profile: maxWidth höjt till 1100px. _patch_CustomFieldsWidget.jsx borttagen.' },
    ]
  },
  {
    version: 'v2.0.35-dev',
    date: '2026-06-24',
    entries: [
      { type: 'fix', text: 'Analytics RR-optimerare och SL-optimering: tabellerna är nu kollapsade per default.' },
      { type: 'fix', text: 'Dashboard välkommen-widget: "X nytt" ändrat till "X nytt meddelande".' },
    ]
  },
  {
    version: 'v2.0.34-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin e-postbyte skyddas av Supabase JWT.' },
    ]
  },
  {
    version: 'v2.0.33-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'AuthPage: "Glömt lösenord"-modal.' },
    ]
  },
  {
    version: 'v2.0.32-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin UserProfileModal: e-postbyte, lösenordsåterställning. Separata unread-räknare.' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard: välkomstbanner, session-countdown. Analytics: Expectancy, Recovery Factor, SL-optimerare, psykologisk analys.' },
    ]
  },
  {
    version: 'v2.0.21-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Admin Branding: bakgrundsbilder, transparens.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filter, strategi-dropdown, sortering. PiP: BroadcastChannel live-uppdatering.' },
    ]
  },
  {
    version: 'v2.0.15-dev',
    date: '2026-06-21',
    entries: [
      { type: 'feature', text: 'PiP-widget, Checklist portad, obligatoriska fält.' },
    ]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [
      { type: 'feature', text: 'DragGrid widget-system, Meddelanden, Journal MFE/MAE.' },
    ]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [
      { type: 'infra', text: 'React 18 + Vite 5, Cloudflare Workers, Supabase.' },
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
