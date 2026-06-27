import Topbar from '../components/Topbar'
import EconomicCalendar from '../components/EconomicCalendar'

export default function Calendar() {
  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Ekonomisk kalender" subtitle="EODHD · 14 dagar framåt" />
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">📰 Ekonomisk kalender</div>
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>Källa: EODHD (FF fallback)</span>
          </div>
          <div className="card-body">
            <EconomicCalendar />
          </div>
        </div>
      </div>
    </div>
  )
}
