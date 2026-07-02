import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.49-dev',
    date: '2026-07-02',
    entries: [
      { type: 'feature', text: 'Full mobil/platta-anpassning: sidebar blir en overlay-drawer med hamburgermeny på skärmar ≤768px, stängs automatiskt vid navigering. Topbar får hamburger-knapp.' },
      { type: 'fix', text: 'Journal: tvåkolumns-layout (Log Trade + tabell) blir en kolumn på mobil/platta. Formuläret slutar vara sticky så det inte låser scroll.' },
      { type: 'fix', text: 'PiP-knappen döljs på mobil/platta – Document Picture-in-Picture stöds inte i mobila webbläsare. Checklist och Logga trade nås istället direkt via huvudnavigeringen.' },
      { type: 'infra', text: 'Nya CSS-brytpunkt vid 768px i globals.css: kort, tabeller och modaler får mindre padding/font-storlek för bättre läsbarhet på små skärmar.' },
    ]
  },
  {
    version: 'v2.0.48-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Import-sida: stöd för TradingView Backtesting (Strategy Tester CSV), Tradovate (Orders.csv), MetaTrader 4/5 (History CSV) och NinjaTrader 7/8 (Trades CSV). 3-stegs flöde: välj plattform → dra/släpp CSV → granska + importera. Valfri strategi-sättning på alla importerade trades.' },
      { type: 'fix', text: 'PiP: ↺ Rensa-knapp tillagd bredvid Spara-knappen i Logga trade-flödet.' },
      { type: 'fix', text: 'Journal: ↺ Rensa-knapp alltid synlig bredvid Spara-knappen (ersätter tidigare Avbryt som bara syntes vid redigering).' },
    ]
  },
  {
    version: 'v2.0.46-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Journal: klick på bild i detaljmodalen öppnar lightbox-overlay.' },
      { type: 'feature', text: 'PiP: Logga trade-flödet identiskt med standard Log Trade – scale-ins, targets, R-preview, multiimage, Känsla.' },
    ]
  },
  {
    version: 'v2.0.45-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal: chart-länk display:block – ellipsis-trunkering fungerar korrekt.' },
      { type: 'feature', text: 'Worker: TV “Copy link”-URL:er konverteras auto till S3 PNG-URL.' },
    ]
  },
  {
    version: 'v2.0.44-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal: chart-rad grid-layout (36px | auto | 1fr | 24px).' },
      { type: 'infra', text: 'TV Pine Script Journal Tool parkerad. Profil TV-flik dold.' },
    ]
  },
  {
    version: 'v2.0.43-dev',
    date: '2026-06-30',
    entries: [
      { type: 'feature', text: 'Journal: multiimage-stöd – flera bilder/länkar per trade med tagg. R2-bucket tradelog-trade-images.' },
    ]
  },
  {
    version: 'v2.0.42-dev',
    date: '2026-06-29',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender: inbäddad TradingView Economic Calendar-widget.' },
    ]
  },
  {
    version: 'v2.0.40-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Dashboard: analoga sessionsklockor (London/NY/Tokyo + din tid), RTH-instrumentruta.' },
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
      { type: 'feature', text: 'Dashboard: välkomstbanner, session-countdown. Analytics: Expectancy, Recovery Factor, SL-optimerare.' },
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
    entries: [{ type:'feature', text:'PiP-widget, Checklist portad, obligatoriska fält.' }]
  },
  {
    version: 'v2.0.4-dev',
    date: '2026-06-15',
    entries: [{ type:'feature', text:'DragGrid widget-system, Meddelanden/Support, Journal MFE/MAE.' }]
  },
  {
    version: 'v2.0.0-dev',
    date: '2026-06-11',
    entries: [{ type:'infra', text:'React 18 + Vite 5, Cloudflare Workers, Supabase. TradeLog v2.0 grund.' }]
  },
]

const TYPE_CONFIG = {
  feature:     { label:'Feature',     bg:'rgba(0,212,170,0.12)',  color:'var(--accent)' },
  fix:         { label:'Fix',         bg:'rgba(239,68,68,0.12)',  color:'#ef4444' },
  infra:       { label:'Infra',       bg:'rgba(99,102,241,0.12)', color:'#818cf8' },
  improvement: { label:'Förbättring', bg:'rgba(245,158,11,0.12)', color:'#f59e0b' },
}

export default function Changelog() {
  return (
    <div style={{ flex:1 }}>
      <Topbar title="Changelog" subtitle="Dev v2.0 – versionshistorik" />
      <div className="page-content" style={{ maxWidth:760 }}>
        {CHANGELOG.map((release,ri) => (
          <div key={release.version} style={{ marginBottom:36 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:14 }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:ri===0?'var(--accent)':'var(--text)', ...(ri===0?{textShadow:'0 0 20px rgba(0,212,170,0.25)'}:{}) }}>{release.version}</span>
              <span style={{ fontSize:12, color:'var(--text4)', fontFamily:'var(--mono)' }}>{release.date}</span>
              {ri===0&&<span style={{ fontSize:10, fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:20, padding:'2px 8px' }}>SENASTE</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {release.entries.map((entry,ei)=>{
                const cfg=TYPE_CONFIG[entry.type]||TYPE_CONFIG.feature
                return(
                  <div key={ei} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:4, background:cfg.bg, color:cfg.color, flexShrink:0, marginTop:1, letterSpacing:.3, minWidth:46, textAlign:'center' }}>{cfg.label}</span>
                    <span style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{entry.text}</span>
                  </div>
                )
              })}
            </div>
            {ri<CHANGELOG.length-1&&<div style={{ borderBottom:'1px solid var(--border)', marginTop:28 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
