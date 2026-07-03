import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.62-dev',
    date: '2026-07-03',
    entries: [
      { type: 'infra', text: 'Supabase PROD-schema dokumenterat som SQL-snapshot i supabase/migrations/20260703124700_schema_snapshot.sql. Innehåller public-tabeller, constraints, RLS, policies, RPC-functions och grants. Ingen användar- eller tradedata ingår.' },
      { type: 'infra', text: 'OBS: äldre changelog-texter i denna komponent är komprimerade i samband med AI-uppdatering. För detaljerad historik, se GitHub-historik och AI Handoff.' },
    ]
  },
  {
    version: 'v2.0.61-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Integritetspolicy-sida porterad från prod v1.9.9 till React. Fristående sida på #/privacy, tillgänglig utan inloggning och länkad från signup samt Profil.' },
    ]
  },
  {
    version: 'v2.0.60-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Dashboard: Operatör-kortet ligger kvar till vänster medan övriga HUD-kort högerställs.' },
      { type: 'feature', text: 'Mer glow genomgående på kort, badges, R-värden och streak-rutor.' },
    ]
  },
  {
    version: 'v2.0.59-dev',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'Dashboard HUD-kort visar nu lokal tid som huvudsiffra och tydlig öppnar/stänger om-rad.' },
      { type: 'fix', text: 'Dashboard-hälsningen gjordes om till HUD-kort och dubblettknappen Log Trade togs bort.' },
    ]
  },
  {
    version: 'v2.0.58-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Dashboard fick ny HUD/high-tech visuell riktning med digitala sessionskort och glow-effekter.' },
      { type: 'infra', text: 'Mobil/platta-CSS lämnades orörd; befintlig mobil-döljning återanvändes.' },
    ]
  },
  {
    version: 'v2.0.57-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Import: parser för TopstepX/ProjectX.' },
      { type: 'fix', text: 'Import: TradingView Backtesting-parsern hanterar entry/exit-rader per trade number.' },
      { type: 'fix', text: 'Import: Tradovate-parsern matchar verklig export och filtrerar Status=Filled.' },
    ]
  },
  {
    version: 'v2.0.56-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Journal: root cause för mobilbredd hittad. .journal-form-card behövde min-width:0 som CSS Grid-item.' },
    ]
  },
  {
    version: 'v2.0.55-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Journal: datum- och tidfält på iOS Safari tvingas respektera containerns bredd.' },
    ]
  },
  {
    version: 'v2.0.54-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Dashboard: widgetgrid satt permanent till 1 kolumn för att stoppa mobilbuggen på roten.' },
    ]
  },
  {
    version: 'v2.0.53-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Dashboard: sessionsklockor döljs på mobil.' },
      { type: 'fix', text: 'Checklist: knappar staplas tydligare.' },
      { type: 'fix', text: 'Skydd mot läckande horisontell scroll vid sidbyte.' },
    ]
  },
  {
    version: 'v2.0.52-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'DragGrid columns={2} var rotorsak till mobilproblem; widgetgriden tvingas till 1 kolumn.' },
      { type: 'infra', text: 'overflow-x:hidden och min-width:0 genomgående på kort och formulär.' },
    ]
  },
  {
    version: 'v2.0.51-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'Analytics och Journal-formulär fick separata mobil/platta-brytpunkter.' },
    ]
  },
  {
    version: 'v2.0.50-dev',
    date: '2026-07-02',
    entries: [
      { type: 'fix', text: 'AuthPage mobilanpassad; bildpanel döljs på små skärmar.' },
    ]
  },
  {
    version: 'v2.0.49-dev',
    date: '2026-07-02',
    entries: [
      { type: 'feature', text: 'Full mobil/platta-anpassning med overlay-sidebar, hamburgerknapp och bättre kort/tabeller.' },
    ]
  },
  {
    version: 'v2.0.48-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Import-sida för TradingView, Tradovate, MetaTrader och NinjaTrader CSV.' },
    ]
  },
  {
    version: 'v2.0.46-dev',
    date: '2026-07-01',
    entries: [
      { type: 'feature', text: 'Journal lightbox och PiP Log Trade-flöde.' },
    ]
  },
  {
    version: 'v2.0.45-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal chart-länk trunkeras korrekt.' },
      { type: 'feature', text: 'Worker konverterar TradingView Copy link-URL:er till S3 PNG-URL.' },
    ]
  },
  {
    version: 'v2.0.44-dev',
    date: '2026-07-01',
    entries: [
      { type: 'fix', text: 'Journal chart-rad fick stabil grid-layout.' },
      { type: 'infra', text: 'TV Pine Script Journal Tool parkerad; Profil TV-flik dold.' },
    ]
  },
  {
    version: 'v2.0.43-dev',
    date: '2026-06-30',
    entries: [
      { type: 'feature', text: 'Journal multiimage-stöd med flera bilder/länkar per trade.' },
    ]
  },
  {
    version: 'v2.0.42-dev',
    date: '2026-06-29',
    entries: [
      { type: 'feature', text: 'Ekonomisk kalender via TradingView-widget.' },
    ]
  },
  {
    version: 'v2.0.40-dev',
    date: '2026-06-27',
    entries: [
      { type: 'feature', text: 'Dashboard sessionsklockor och RTH-instrumentruta.' },
    ]
  },
  {
    version: 'v2.0.36-dev',
    date: '2026-06-25',
    entries: [
      { type: 'feature', text: 'Analytics CustomFieldsWidget expand/kollaps per fält.' },
      { type: 'fix', text: 'Admin och Profile maxWidth höjt.' },
    ]
  },
  {
    version: 'v2.0.32-dev',
    date: '2026-06-24',
    entries: [
      { type: 'feature', text: 'Admin UserProfileModal, e-postbyte och lösenordsåterställning.' },
    ]
  },
  {
    version: 'v2.0.23-dev',
    date: '2026-06-23',
    entries: [
      { type: 'feature', text: 'Dashboard välkomstbanner, session-countdown och Analytics-mått.' },
    ]
  },
  {
    version: 'v2.0.19-dev',
    date: '2026-06-22',
    entries: [
      { type: 'feature', text: 'Journal filter, strategi-dropdown, kolumnsortering och PiP live-uppdatering.' },
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
