import Topbar from '../components/Topbar'

const CHANGELOG = [
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
      { type: 'feature', text: 'Analytics: Egna fält som analysdimension – widget visar WR och netto R per unikt värde för varje eget fält i custom_data. Uppdateras automatiskt utan konfiguration.' },
      { type: 'feature', text: 'Admin: "Visa som"-knapp i användartabellen – admin kan se Dashboard, Analytics och Journal som en vald användare utan att byta inloggning.' },
      { type: 'feature', text: 'Impersonation-banner – orange fält längst upp visar vem som visas. Klicka Avsluta för att återgå till admin-vyn.' },
    ]
  },
  {
    version: 'v2.0.25-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Analytics: SL-optimerare – simulerar vad som händer om SL breddas X%. Visar räddade trades, ny WR, netto R-förändring och optimalt SL-intervall. Kräver MAE-data.' },
      { type: 'feature', text: 'Analytics: Psykologisk analys – disciplinpoäng (0–100), regelbaserade insikter om förlustsvitar, revenge-trading, session-WR och övertradingmönster.' },
      { type: 'improvement', text: 'Analytics: WR per handelssession (London/NY/övrigt) i psykologisk widget – identifierar vilken session som ger bäst resultat.' },
    ]
  },
  {
    version: 'v2.0.24-dev',
    date: '2026-06-24',
    entries: [
      { type: 'fix', text: 'DragGrid: columns-prop ignorerades – widgets renderades alltid i en kolumn. Nu används CSS grid med gridTemplateColumns så Dashboard visas i 2 kolumner.' },
      { type: 'feature', text: 'DragGrid: stöd för span-prop – widgets med span:2 spänner över hela bredden (Välkommen, Statistik, Equity Curve).' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard: välkomstbanner med namn, datum, total R, WR och session-countdown (London/NY)' },
      { type: 'feature', text: 'Dashboard: Idag-widget (trades idag, P&L idag), snabbåtgärder, 2-kolumns layout' },
      { type: 'feature', text: 'Dashboard: Expectancy, Recovery Factor och Längsta svit tillagda i statistikgrid' },
      { type: 'feature', text: 'Analytics: Expectancy, Recovery Factor och Längsta svit tillagda i statistikgrid' },
      { type: 'feature', text: 'Analytics: Win Rate per veckodag – ny widget med insikt om bästa/sämsta handelsdagar' },
      { type: 'improvement', text: 'Analytics RR-optimerare: finare steg (0.1R istället för 0.5R) för psykologisk precisionsoptimering' },
    ]
  },
  {
    version: 'v2.0.22-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Admin Branding: transparens-sliders för hero-panel, formulär-panel och sid-bakgrund (0-100%)' },
      { type: 'fix',     text: 'Bakgrundsbild på andra sidor (Dashboard, Journal mm) fungerar nu – hanteras centralt i App.jsx istället för per sida' },
      { type: 'improvement', text: 'AuthPage: hero-transparens styrs live av Admin-inställningen, ingen omstart behövs' },
    ]
  },
  {
    version: 'v2.0.21-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'AuthPage: bakgrundsbild (mörk/ljus) på inloggningssidan med halvtransparent overlay för läsbarhet. Helt på svenska.' },
      { type: 'feature', text: 'Admin – Branding-flik: ändra/ladda upp bakgrundsbilder för mörkt/ljust tema och välj vilka sidor de ska visas på med kryssrutor' },
      { type: 'feature', text: 'useBranding-hook för framtida sidor som ska stödja bakgrundsbild' },
    ]
  },
  {
    version: 'v2.0.20-dev',
    date: '2026-06-22',
    entries: [
      { type: 'fix',         text: 'Topbar: Profil-länk i avatar-dropdown navigerade till 404 (href=/profile i SPA). Ersatt med window.__tlNavigate som sätts av App.jsx' },
      { type: 'improvement', text: 'Topbar: e-post trunkeras med ellipsis istället för att radbryta fult i avatar-dropdown' },
      { type: 'feature',     text: 'Journal: kolumnsortering – klicka på Datum/Symbol/Entry/SL/TP/Utfall/R/Grade/Strategi för att sortera' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal: filterrad (Utfall, Riktning, Strategi, Datumintervall) ovanför tradelistan' },
      { type: 'feature', text: 'Journal + PiP: Strategi-fältet är nu en dropdown populerad från dina checklistor, med fritext-fallback' },
      { type: 'feature', text: 'Journal: lyssnar på BroadcastChannel och uppdaterar listan live när ett trade sparas från PiP' },
      { type: 'feature', text: 'PiP: Logga trade-fliken är nu ett fullständigt formulär (alla fält som i Journal, inkl. scale-ins, targets, exit-tid, emotion, chart, egna fält)' },
      { type: 'fix',     text: 'PiP: trade sparat i PiP syns nu direkt i Journal utan att stänga fönstret eller ladda om sidan (BroadcastChannel)' },
      { type: 'feature', text: 'Topbar: Avatar-ikonen har nu en dropdown med Profil och Logga ut' },
      { type: 'improvement', text: 'Profil: helt på svenska, repeat-password-fält, uppdaterad privacy-text med acceptans av integritetsvillkor' },
    ]
  },
  {
    version: 'v2.0.18-dev',
    date: '2026-06-22',
    entries: [
      { type: 'fix', text: 'tradeUtils: hoppa över R-konvertering om result_unit=R är satt – backtest-trades med fasta R-värden räknas nu korrekt (+2R/-1R/+3R)' },
    ]
  },
  {
    version: 'v2.0.17-dev',
    date: '2026-06-22',
    entries: [
      { type: 'fix',     text: 'tradeUtils: R-beräkning använder nu abs(entry-sl) som faktisk risk istället för risk_pts (box-storlek) – ger korrekt R oavsett var SL sitter' },
      { type: 'feature', text: 'Analytics: Kontosimulator – ange kontostorlek och risk% live och se dollar P&L, Max DD i $ och %, kontrakt per trade, dollar equity-kurva' },
    ]
  },
  {
    version: 'v2.0.16-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'tradeUtils.js: delad normaliseringsfunktion för trades – konverterar outcome (Win/Loss→W/L) och result (punkter→R via risk_pts) från alla kända import-format' },
      { type: 'fix',     text: 'Analytics + Journal: normalizeTrades() appliceras vid fetch – backtest-trades (Blackwatch m.fl.) beräknas nu korrekt med rätt WR, R-värden och statistik' },
    ]
  },
  {
    version: 'v2.0.15-dev',
    date: '2026-06-21',
    entries: [
      { type: 'feature', text: 'PiP-widget: flytande fönster med Checklist- och Logga trade-flikar, öppnas via ⧉-knappen i topbaren (kräver Chromium/Edge/Chrome)' },
    ]
  },
  {
    version: 'v2.0.14-dev',
    date: '2026-06-21',
    entries: [
      { type: 'fix',         text: 'Checklist editor: sparning fungerar nu (updated_at-kolumn saknas i schemat – borttagen från anropet)' },
      { type: 'improvement', text: 'Checklist editor: Spara-knapp finns nu längst ned i editorn (inte bara i headern)' },
      { type: 'improvement', text: 'Checklist: 2-kolumns layout, kollapsar automatiskt till 1 kolumn på smalt fönster' },
    ]
  },
  {
    version: 'v2.0.13-dev',
    date: '2026-06-21',
    entries: [
      { type: 'feature',     text: 'Checklist: inbyggd editor – redigera namn, faser och steg, sätt blocker/stop/journalmärkning, flytta och ta bort' },
      { type: 'feature',     text: 'Checklist: skapa ny strategi och ta bort befintlig direkt i UI:t' },
    ]
  },
  {
    version: 'v2.0.12-dev',
    date: '2026-06-17',
    entries: [
      { type: 'feature',     text: 'Checklist: portad från prod med standardstrategierna (Unicorn, Globex, Venom, Turtle), hopfällbara faser, progressbar, blocker-varningar' },
      { type: 'fix',         text: 'Kanban: INSERT-policy saknades i prod RLS – kort kunde aldrig sparas av en oautentiserad klient (upsert kräver INSERT-rättighet)' },
    ]
  },
  {
    version: 'v2.0.11-dev',
    date: '2026-06-17',
    entries: [
      { type: 'improvement', text: 'Analytics AI-historik: kollapsad som standard, klicka för att expandera – samma mönster som prod' },
    ]
  },
  {
    version: 'v2.0.10-dev',
    date: '2026-06-17',
    entries: [
      { type: 'improvement', text: 'Journal: Log Trade-panelen scrollar internt när den är högre än fönstret – behöver inte längre scrolla i tradelistan för att nå fältens nederkant' },
    ]
  },
  {
    version: 'v2.0.9-dev',
    date: '2026-06-17',
    entries: [
      { type: 'feature',     text: 'Journal: Exit datum och Exit tid tillagda som valfria fält (för statistik på handelslängd)' },
      { type: 'feature',     text: 'Analytics: Max Drawdown (peak-to-trough R i kronologisk ordning) tillagd i statistikraden' },
    ]
  },
  {
    version: 'v2.0.8-dev',
    date: '2026-06-17',
    entries: [
      { type: 'fix',         text: 'Kanban: race-fix – snabba drag i rad skickade parallella persist-anrop, nu köade i serie' },
      { type: 'fix',         text: 'Journal: native HTML required-attribut på Utfall orsakade webbläsarens egen validering istället för vår – borttagen' },
      { type: 'improvement', text: 'Analytics AI-analys: sparas nu i userSettings (överlever refresh/utloggning), fingerprint förhindrar onödiga API-anrop när inget ändrats' },
    ]
  },
  {
    version: 'v2.0.7-dev',
    date: '2026-06-17',
    entries: [
      { type: 'improvement', text: 'Journal obligatoriska fält: röd * vid etikett istället för röd ram, "Fyll i:"-hint visas bara efter ett misslyckat sparförsök' },
    ]
  },
  {
    version: 'v2.0.6-dev',
    date: '2026-06-17',
    entries: [
      { type: 'fix',         text: 'AI-analys: Analytics.jsx skickade fel format till Anthropic API ({prompt} istället för {model, messages}) – rättat till korrekt Messages API-format' },
      { type: 'fix',         text: 'Kanban: Roadmap.jsx läste stale lokal state som bas vid persist, överskrev ändringar gjorda i andra flikar eller av admin – nu alltid färsk läsning från DB' },
      { type: 'improvement', text: 'Journal obligatoriska fält: kryssrutor i Anpassa-panelen, drag och obligatorisk-togglar låsta bakom Anpassa-läget, knappen lyser när aktiv' },
    ]
  },
  {
    version: 'v2.0.5-dev',
    date: '2026-06-17',
    entries: [
      { type: 'feature', text: 'Journal: Individuell fältdragning – varje fält flyttbart fritt, 2-kolumns rad-grid (para ihop, byt plats, eller egen full-bredd-rad)' },
      { type: 'feature', text: 'Journal: Fältordning syncar mellan enheter via userSettings istället för bara lokalt i webbläsaren' },
      { type: 'improvement', text: 'Journal: Log Trade-panelen breddad responsivt (420–520px) istället för fast 420px' },
      { type: 'fix',     text: 'Worker (AI-proxy): CORS tillät bara en hårdkodad origin som inte matchade den faktiska dev-URL:en – orsakade "Kunde inte ansluta till AI-tjänsten". Nu tillåts båda kända origins' },
    ]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [
      { type: 'feature', text: 'Widget-system – DragGrid: lägg till/ta bort och sortera widgets fritt på Dashboard och Analytics' },
      { type: 'feature', text: 'Meddelanden – Allmänt (broadcast från admin) och Mina ärenden (support-trådar), badge för olästa' },
      { type: 'feature', text: 'Admin – Support-flik: lista och svara på supportärenden, skapa/publicera broadcast-meddelanden' },
      { type: 'feature', text: 'Journal: Faktisk exit, Risk%+kontostorlek, Fler targets, R auto, egna fält' },
      { type: 'infra',   text: 'MFE/MAE bytt från TwelveData till egen Yahoo Finance-pipeline (Worker + market_bars-tabell), löser rate-limit och sessionsgräns-buggar' },
      { type: 'infra',   text: 'Historisk backfill av EUR/USD 5-min till market_bars (2023–2026) för djupare backtesting' },
      { type: 'fix',     text: 'RR-optimerare: korrekt proxy-logik för MFE, sessionsbunden beräkning, capture rate + bästa missade trade' },
      { type: 'fix',     text: 'Supabase-säkerhet: admin_users-vyn (exponerade auth-data) borttagen, get_admin_users() läser auth.users direkt med egen behörighetskoll' },
    ]
  },
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
