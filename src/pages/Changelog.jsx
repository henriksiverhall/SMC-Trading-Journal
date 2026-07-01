import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.43-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal: URL-text i chart-listan trunkeras nu korrekt med "…" – bryter inte längre ut utanför kortet.' },
      { type: 'infra', text: 'TV Pine Script Journal Tool parkerad (se Roadmap). TV Replay stödjer inte alerts – Supabase Realtime-kanalen för tv_pending och autoFillFromTv borttagna. Koden bevarad kommenterad. Pine-filen sparad i Drive.' },
    ]
  },
  {
    version: 'v2.0.45-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'TradingView-integration: Pine Script v6-indikator (TradeLog Connector) skickar trade-data till TradeLog via webhook. Entry, SL, TP, symbol, riktning, datum och tid auto-fylls i Journal-formuläret i realtid via Supabase Realtime.' },
      { type: 'feature', text: 'Dold metadata från TradingView sparas per trade (_tv_meta): timeframe, ATR14, RSI14, EMA20/50, VWAP, bar OHLCV, session-typ, pointvalue, is_backtest-flagga. Används framöver i analytics och AI-analys.' },
      { type: 'feature', text: 'Profil: ny flik "TradingView" med steg-för-steg installationsguide (5 steg), kopiera-knapp för webhook-URL, återskapa-token, testping med realtidsfeedback (✅ Ansluten!).' },
      { type: 'infra', text: 'Supabase: ny tabell tv_pending (user_id, payload JSONB, consumed, created_at) med RLS och Realtime aktiverat. Ny RPC update_tv_token för säker token-rotation.' },
      { type: 'infra', text: 'Worker: nya endpoints POST /tv-webhook/:token (tar emot Pine Script-data), POST /tv-webhook-ping/:token (testanslutning), POST /tv-webhook-regen (JWT, roterar token). Webhook-tokens genererade för alla befintliga users.' },
    ]
  },
  {
    version: 'v2.0.44-dev',
    date: '2026-06-30',
    entries: [
      { type: 'fix', text: 'Journal: chart-länkar i listan trunkeras nu korrekt med "..." istället för att bryta ut på höger sida (display:block på länken krävdes för att overflow/textOverflow skulle fungera).' },
      { type: 'fix', text: 'Journal: tydligare felmeddelande när automatisk bildhämtning misslyckas (t.ex. TradingView 403) – förklarar att "Ladda upp skärmbild" bör användas istället.' },
      { type: 'infra', text: 'Bekräftat: TradingView blockerar serverside-hämtning av snapshot-bilder (403) oavsett User-Agent. Manuell skärmdumpsuppladdning rekommenderas. Löses framöver via TradingView-integrationen (Pine Script screenshot).' },
    ]
  },
  {
    version: 'v2.0.43-dev',
    date: '2026-06-30',
    entries: [
      { type: 'feature', text: 'Journal: chart-fältet ersatt med multiimage-stöd – flera bilder/länkar per trade, var och en taggad (4h/1h/15m/5m/1m/Entry/SL/TP/Exit/Övrigt eller egen tagg). Stöd för både URL-hämtning och direkt filuppladdning från datorn.' },
      { type: 'infra', text: 'Cloudflare Worker: ny R2-bucket "tradelog-trade-images" (binding TRADE_IMAGES) samt nya endpoints POST /trade-images/save, GET /trade-images/:key (publik proxy-läsning), DELETE /trade-images/:key (JWT, ägarskyddad).' },
      { type: 'feature', text: 'Journal: detaljmodalen visar nu alla charts grupperade per tagg med 88x88px miniatyrer (bilder) eller länk-ikon, klickbara för att öppna i nytt fönster.' },
    ]
  },
  {
    version: 'v2.0.42-dev',
    date: '2026-06-29',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender (full sida): bytt till inbäddad TradingView Economic Calendar-widget. Löser problemet med nästa veckas data permanent – realtidsdata, inget eget API behövs. Mörkt tema, fyller hela fönsterhöjden under topbaren.' },
      { type: 'fix', text: 'Dashboard-widgeten för kalender behålls med vår egen Supabase-cache (FF-data) – separat från full-sidans TradingView-widget.' },
      { type: 'infra', text: 'Undersökt: EODHD free-plan tillåter inte economic-events-endpointen. Kräver betald plan. Kod och secret på plats – fungerar automatiskt vid uppgradering.' },
      { type: 'infra', text: 'Undersökt: ForexFactory, MQL5 och Investing.com blockerar Cloudflare Workers och Supabase Edge Functions IP-ranges. TradingView embedded widget är enda fungerande lösningen.' },
    ]
  },
  {
    version: 'v2.0.41-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: EODHD API som primär källa. Hämtar 14 dagar framåt. ForexFactory som automatisk fallback.' },
      { type: 'feature', text: 'Impact-klassificering: 100+ event-typer mappade till Hög/Medium/Låg.' },
      { type: 'feature', text: 'Dashboard: kalender-widget med Idag/Kommande-läge, high/medium-impact events.' },
    ]
  },
  {
    version: 'v2.0.40-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Dashboard: analoga sessionsklockor (Din tid + London/NY/Tokyo), RTH-instrumentruta med nedräkning.' },
    ]
  },
  {
    version: 'v2.0.39-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: ny sida i sidomenyn med ForexFactory-data, filter på impact/valuta/period.' },
    ]
  },
  {
    version: 'v2.0.36-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Analytics: CustomFieldsWidget expand/kollaps per fält.' },
      { type: 'fix', text: 'Admin + Profile: maxWidth höjt till 1100px.' },
    ]
  },
  {
    version: 'v2.0.32-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin UserProfileModal: e-postbyte, lösenordsåterställning. AuthPage: Glömt lösenord-modal.' },
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
