import Topbar from '../components/Topbar'

const CHANGELOG = [
  {
    version: 'UNSAFE-BRANCH',
    date: '2026-07-03',
    entries: [
      { type: 'fix', text: 'This PR branch should not be merged. Changelog was damaged during tool testing. Use a clean branch instead.' },
    ]
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
              <span style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:ri===0?'var(--accent)':'var(--text)' }}>{release.version}</span>
              <span style={{ fontSize:12, color:'var(--text4)', fontFamily:'var(--mono)' }}>{release.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
