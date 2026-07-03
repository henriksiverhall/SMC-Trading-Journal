import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'v2.0.62-dev',
    date: '2026-07-03',
    entries: [
      { type: 'infra', text: 'Supabase PROD-schema dokumenterat som SQL-snapshot i supabase/migrations/20260703124700_schema_snapshot.sql. Innehåller public-tabeller, constraints, RLS, policies, RPC-functions och grants. Ingen användar- eller tradedata ingår.' },
    ]
  },
  {
    version: 'v2.0.61-dev',
    date: '2026-07-03',
    entries: [
      { type: 'feature', text: 'Integritetspolicy-sida porterad från prod v1.9.9 till React. Fristående sida på #/privacy, tillgänglig utan inloggning och länkad från signup samt Profil.' },
    ]
  }
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
