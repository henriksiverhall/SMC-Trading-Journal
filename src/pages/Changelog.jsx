import Topbar from '../components/Topbar'

const CHANGELOG = [
  { version: 'DO-NOT-MERGE', date: '2026-07-03', entries: [{ type: 'fix', text: 'Do not merge this branch. Use clean branch instead.' }] },
]

const TYPE_CONFIG = {
  feature:     { label:'Feature',     bg:'rgba(0,212,170,0.12)',  color:'var(--accent)' },
  fix:         { label:'Fix',         bg:'rgba(239,68,68,0.12)',  color:'#ef4444' },
  infra:       { label:'Infra',       bg:'rgba(99,102,241,0.12)', color:'#818cf8' },
  improvement: { label:'Förbättring', bg:'rgba(245,158,11,0.12)', color:'#f59e0b' },
}

export default function Changelog() {
  return <div style={{ flex:1 }}><Topbar title="Changelog" subtitle="Do not merge this branch" /></div>
}
