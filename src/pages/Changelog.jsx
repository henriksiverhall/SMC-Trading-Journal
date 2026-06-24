import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.29-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin: klick på rad i användartabellen öppnar profilmodal med kontodetaljer, tradingstatistik (WR, total R, PF, V/F) och snabblänkar till Visa som och Ta bort.' },
    ]
  },
  {
    version: 'v2.0.28-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Roadmap: kollaps-state sparas i localStorage – kolumner håller sig minimerade/expanderade vid refresh.' },
      { type: 'feature', text: 'Roadmap: arkivfunktion – arkivera kort via modal-knapp, visa/dölj arkivkolumn med knapp i toolbar. Arkiverade kort kan återställas.' },
      { type: 'feature', text: 'Profil: Meddelanden som flik – broadcast-meddelanden och inkorg samlade direkt i Profil-sidan med oläst-indikator.' },
    ]
  },
  {
    version: 'v2.0.27-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Impersonation: "Visa som" håller sig vid page refresh – läget sparas i sessionStorage och återställs automatiskt.' },
      { type: 'feature', text: 'Journal: stöd för "Visa som" – visar vald användares trades och checklistor i read-only-läge.' },
      { type: 'improvement', text: 'Analytics: debug-logging borttagen.' },
      { type: 'infra', text: 'Supabase RLS: admin kan nu läsa checklists och user_profiles för alla användare (krävs för impersonation).' },
    ]
  },
  {
    version: 'v2.0.26-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Analytics: Egna fält som analysdimension – widget visar WR och netto R per unikt värde för varje eget fält i custom_data.' },
      { type: 'feature', text: 'Admin: "Visa som"-knapp i användartabellen – admin kan se Dashboard, Analytics och Journal som en vald användare.' },
      { type: 'feature', text: 'Impersonation-banner – orange fält längst upp visar vem som visas.' },
    ]
  },
  {
    version: 'v2.0.25-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Analytics: SL-optimerare – simulerar vad som händer om SL breddas X%.' },
      { type: 'feature', text: 'Analytics: Psykologisk analys – disciplinpoäng, förlustsvitar, revenge-trading, session-WR.' },
      { type: 'improvement', text: 'Analytics: WR per handelssession (London/NY/övrigt).' },
    ]
  },
  {
    version: 'v2.0.24-dev',
    date: '2026-06-24',
    entries: [
      { type: 'fix', text: 'DragGrid: columns-prop ignorerades – nu CSS grid med gridTemplateColumns.' },
      { type: 'feature', text: 'DragGrid: stöd för span-prop – widgets med span:2 spänner hela bredden.' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard: välkomstbanner, session-countdown, Idag-widget, 2-kolumns layout.' },
      { type: 'feature', text: 'Analytics: Expectancy, Recovery Factor, Longest streak, WR per veckodag.' },
      { type: 'improvement', text: 'Analytics RR-optimerare: 0.1R-steg.' },
    ]
  },
  {
    version: 'v2.0.22-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Admin Branding: transparens-sliders för hero/formulär/sid-bakgrund.' },
      { type: 'fix', text: 'Bakgrundsbild på övriga sidor hanteras nu centralt i App.jsx.' },
    ]
  },
  {
    version: 'v2.0.21-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'AuthPage: bakgrundsbild med transparens, på svenska.' },
      { type: 'feature', text: 'Admin Branding-flik: mörk/ljus bakgrundsbild, per-sida-val.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filterrad, strategi-dropdown från checklistor, kolumnsortering.' },
      { type: 'feature', text: 'PiP: fullständigt loggformulär, BroadcastChannel live-uppdatering.' },
      { type: 'feature', text: 'Topbar: avatar-dropdown med Profil och Logga ut.' },
    ]
  },
  {
    version: 'v2.0.17-dev',
    date: '2026-06-22',
    entries: [
      { type: 'fix', text: 'tradeUtils: R-beräkning direction-agnostisk med abs(entry-sl).' },
      { type: 'feature', text: 'Analytics: Kontosimulator med dollar P&L och equity-kurva.' },
    ]
  },
  {
    version: 'v2.0.15-dev',
    date: '2026-06-21',
    entries: [
      { type: 'feature', text: 'PiP-widget: flytande fönster med Checklist- och Logga trade-flikar (Chromium).' },
    ]
  },
  {
    version: 'v2.0.12-dev',
    date: '2026-06-17',
    entries: [
      { type: 'feature', text: 'Checklist portad med standardstrategier, inbyggd editor, 2-kolumns layout.' },
    ]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [
      { type: 'feature', text: 'Widget-system DragGrid, Meddelanden (broadcast + support), Journal utökad med egna fält.' },
      { type: 'infra', text: 'MFE/MAE via Yahoo Finance Worker + market_bars, Supabase-säkerhet fixad.' },
    ]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [
      { type: 'infra', text: 'React 18 + Vite 5, Cloudflare Workers hosting.' },
      { type: 'feature', text: 'Dashboard, Journal, Analytics, Profil, Admin – grundläggande sidor.' },
      { type: 'infra', text: 'Design system – CSS-variabler, Inter + JetBrains Mono, kollapsbar sidebar.' },
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
