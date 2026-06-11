import Topbar from '../components/Topbar'

export default function Roadmap() {
  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Roadmap" />
      <div className="page-content">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text3)', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🗺️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>Roadmap / Kanban</div>
          <div style={{ fontSize: 13 }}>Coming soon in v2.0</div>
        </div>
      </div>
    </div>
  )
}
