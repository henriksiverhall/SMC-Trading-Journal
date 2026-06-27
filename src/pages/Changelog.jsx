import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.41-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: EODHD API som primär källa (officiellt REST API, ingen scraping). Hämtar 14 dagar framåt – täcker denna och nästa vecka alltid. ForexFactory behålls som automatisk fallback om EODHD misslyckas.' },
      { type: 'feature', text: 'Impact-klassificering för EODHD: 100+ event-typer mappade till Hög/Medium/Låg i tre lager (exakt match, partiell match, keyword-fallback). Täcker NFP, CPI, GDP, räntebeslut, PMI, m.fl. för USD/EUR/GBP/JPY/CAD/AUD/NZD/CHF.' },
      { type: 'feature', text: 'Admin System-flik: knapp för manuell kalender-refresh med tydligt resultat (lyckades/misslyckades, källa, antal event). Cache-status visas per vecka.' },
      { type: 'feature', text: 'Dashboard: kalender-widget med Idag/Kommande-läge. Visar high/medium-impact events kompakt med impact-färg, tid, valuta och prognos. Klick på Alla → tar till full kalendersida.' },
      { type: 'improvement', text: 'Dashboard: Statistik och Equity Curve är nu halvbredd (span 1) som default – kan ändras via Anpassa widgets.' },
      { type: 'improvement', text: 'Supabase: calendar_history-tabell skapad för framtida historikarkiv (veckonyckel YYYY-WNN, week_start/week_end för datumfiltrering).' },
    ]
  },
  {
    version: 'v2.0.40-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Dashboard: sessionsklockor visar varje stads lokala tid på analoga visare och digital display. Din tid-klocka accent-färgad. Sessionsbjåge visar marknadernas öppettider.' },
      { type: 'fix', text: 'Sessionsbjågar: urtavlans kant alltid neutral (var(--border2)), sessionsbjågen 3px tunn. Ingen röd/grön ring runt hela klockan.' },
      { type: 'feature', text: 'RTH-instrumentruta: Guld (08:20 ET), Olja (09:00 ET), ES/NQ/YM (09:30 ET) med nedräkning HH:MM:SS och öppen/stängd-status.' },
      { type: 'improvement', text: 'Välkomstwidget: statistikblock borttaget, klockor högerställda mot RTH-rutan med separatorlinje emellan.' },
    ]
  },
  {
    version: 'v2.0.39-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: ny sida i sidomenyn. ForexFactory-data cachad i Supabase via Worker-proxy. Filter på impact, valuta och tidsperiod. Händelser grupperade per dag, sorterade på impact sedan tid.' },
      { type: 'infra', text: 'Supabase: calendar_cache-tabell för caching av FF-kalenderdata. Automatisk refresh via scheduled Worker varje natt.' },
      { type: 'feature', text: 'Admin System-flik: ny flik i Admin med kalender-cache-status och manuell refresh-knapp (JWT-skyddad).' },
    ]
  },
  {
    version: 'v2.0.38-dev',
    date: '2026-06-25',
    entries: [
      { type: 'improvement', text: 'Dashboard: statistik borttagen från välkomstwidget – finns i Statistik-widget under. Klockor högerställda mot RTH-rutan.' },
    ]
  },
  {
    version: 'v2.0.37-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Dashboard: 4 analoga sessionsklockor (Din tid + London/NY/Tokyo). Varje marknadsklocka visar stadens lokala tid, sessionsbjåge för handelstider, nedräkning HH:MM:SS till open/close. RTH-instrumentruta för Guld/Olja/ES·NQ·YM. Tema-kompatibla CSS-variabler.' },
    ]
  },
  {
    version: 'v2.0.36-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Analytics: CustomFieldsWidget expand/kollaps per fält, max 10 rader, backtest-nycklar filtreras.' },
      { type: 'fix', text: 'Admin + Profile: maxWidth höjt till 1100px.' },
    ]
  },
  {
    version: 'v2.0.35-dev',
    date: '2026-06-24',
    entries: [
      { type: 'fix', text: 'Analytics RR-optimerare och SL-optimering: tabellerna är nu kollapsade per default.' },
      { type: 'fix', text: 'Dashboard välkommen-widget: “X nytt” ändrat till “X nytt meddelande”.' },
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
      { type: 'feature', text: 'AuthPage: “Glömt lösenord”-modal.' },
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
      { type: 'feature', text: 'Admin Branding: bakgrundsbilder, transparens per sida.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filter, strategi-dropdown, kolumnsortering. PiP: BroadcastChannel live-uppdatering.' },
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
      { type: 'feature', text: 'DragGrid widget-system, Meddelanden/Support, Journal MFE/MAE.' },
    ]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [
      { type: 'infra', text: 'React 18 + Vite 5, Cloudflare Workers, Supabase. TradeLog v2.0 grund.' },
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
