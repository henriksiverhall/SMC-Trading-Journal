import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.3-dev',
    date: '2026-06-14',
    entries: [
      { type: 'feature', text: 'Analytics: Equity curve – kumulativt R som linjediagram över tid' },
      { type: 'feature', text: 'Analytics: MFE/MAE-analys via TwelveData – avg MFE, MAE, lämnat på bordet, per-trade tabell' },
      { type: 'feature', text: 'Analytics: RR-optimerare – simulerar WR och expectancy vid RR 1.0–4.0R baserat på MFE-data' },
      { type: 'feature', text: 'Analytics: AI-analys – skickar statistik till Claude via Worker, visar råd med sessionshistorik' },
      { type: 'infra',   text: 'TwelveData-integration portad från prod – symbol-map, OHLC-fetch, caching i custom_data' },
      { type: 'fix',     text: 'Journal: R-logik direction-agnostisk – använder Math.abs(), fungerar korrekt utan vald riktning' },
      { type: 'fix',     text: 'Kanban: collapse-pil (▼/▲) i kolumnhuvud – kolumnen behåller bredd, korten döljs' },
    ]
  },
  {
    version: 'v2.0.2-dev',
    date: '2026-06-12',
    entries: [
      { type: 'feature', text: 'Journal: Scale-in – flera entries med weighted average entry och R-beräkning' },
      { type: 'feature', text: 'Journal: Partial exits – delvinsttagningar med live R-preview viktat per exit' },
      { type: 'feature', text: 'Journal: Monetärt resultat – visar +$X.XX i formulärheadern för futures' },
      { type: 'feature', text: 'Journal: Redigera trade – Edit-knapp i detaljmodal, fyller formuläret inkl. scale-ins' },
      { type: 'feature', text: 'Journal: Ta bort trade – Delete-knapp i detaljmodal med bekräftelse' },
      { type: 'feature', text: 'Journal: CSV-export – exportknappen fungerar, laddar ner .csv med alla fält' },
      { type: 'feature', text: 'Kanban: Ingress på kort – första 90 tecken av beskrivning visas direkt' },
      { type: 'feature', text: 'Kanban: Sortering – dropdown för prioritet, skapdatum eller titel A–Ö' },
      { type: 'feature', text: 'Kanban: Prioritet – 🔴/🟡/🟢 visas på kort och i redigera-modal' },
      { type: 'feature', text: 'Kanban: Datum – skapdatum visas på kort och i detaljmodal' },
      { type: 'feature', text: 'Kanban: Större detaljmodal – 640px bred, 8-raders textarea, bättre layout' },
      { type: 'infra',   text: 'Sidebar: open-state propageras till App.jsx – main-content expanderar vid inhopdragen meny' },
    ]
  },
  {
    version: 'v2.0.1-dev',
    date: '2026-06-12',
    entries: [
      { type: 'infra',   text: 'Auto-deploy: Cloudflare Worker kopplad till dev-branch – push triggar deploy automatiskt' },
      { type: 'fix',     text: 'sessionStorage page-state – aktiv sida återställs vid page refresh' },
      { type: 'feature', text: 'Kanban Roadmap – 6 kolumner, drag-and-drop, taggar [DEV]/[PROD]/[IDÉ], admin-redigering' },
      { type: 'infra',   text: 'Kanban läser/skriver alltid mot prod Supabase admin-användaren – en gemensam roadmap' },
      { type: 'infra',   text: 'roadmapTasks migrerat från gammalt array-format till nytt objekt-format' },
    ]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [
      { type: 'infra',   text: 'React 18 + Vite 5 migration påbörjad – ny projektstruktur, Cloudflare Workers hosting' },
      { type: 'infra',   text: 'Separat dev Supabase-instans (qmmpxupsxdouvoqgvgri)' },
      { type: 'feature', text: 'AuthPage – login, signup, logout via Supabase Auth med AuthContext' },
      { type: 'feature', text: 'Dashboard – stats-grid (WR, R, PF), senaste trades' },
      { type: 'feature', text: 'Journal – trade-formulär med futures-spec badge, grade, emotion, strategi' },
      { type: 'feature', text: 'Analytics – filter, grade/emotion/strategi-breakdown med Recharts' },
      { type: 'feature', text: 'Profil – visningsnamn, risk%, kontostorlek, byt lösenord, radera konto' },
      { type: 'feature', text: 'Admin – användarlista, AI-toggle, radera användare' },
      { type: 'infra',   text: 'Design system – globals.css med CSS-variabler, Inter + JetBrains Mono, kollapsbar sidebar' },
    ]
  },
]

const TYPE_CONFIG = {
  feature: { label: 'Feature',  bg: 'rgba(0,212,170,0.12)',  color: 'var(--accent)' },
  fix:     { label: 'Fix',      bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
  infra:   { label: 'Infra',    bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
}

export default function Changelog() {
  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Changelog" subtitle="Dev v2.0 – versionshistorik" />
      <div className="page-content" style={{ maxWidth: 760 }}>
        {CHANGELOG.map((release, ri) => (
          <div key={release.version} style={{ marginBottom: 36 }}>
            {/* Release header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700,
                color: ri === 0 ? 'var(--accent)' : 'var(--text)',
                ...(ri === 0 ? { textShadow: '0 0 20px rgba(0,212,170,0.25)' } : {})
              }}>{release.version}</span>
              <span style={{ fontSize: 12, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{release.date}</span>
              {ri === 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 20, padding: '2px 8px' }}>SENASTE</span>
              )}
            </div>

            {/* Entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {release.entries.map((entry, ei) => {
                const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.feature
                return (
                  <div key={ei} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                      background: cfg.bg, color: cfg.color,
                      flexShrink: 0, marginTop: 1, letterSpacing: 0.3, minWidth: 46, textAlign: 'center'
                    }}>{cfg.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{entry.text}</span>
                  </div>
                )
              })}
            </div>

            {ri < CHANGELOG.length - 1 && (
              <div style={{ borderBottom: '1px solid var(--border)', marginTop: 28 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
