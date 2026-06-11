import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, gradeColor } from '../lib/constants'
import Topbar from '../components/Topbar'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    sb.from('trades').select('*').eq('user_id', user.id).order('date', { ascending: true })
      .then(({ data }) => { setTrades(data || []); setLoading(false) })
  }, [user])

  if (loading) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  )

  const withR = trades.filter(t => t.result != null)
  const wins = withR.filter(t => t.outcome === 'W')
  const losses = withR.filter(t => t.outcome === 'L')
  const totalR = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? (wins.length / withR.length * 100) : 0
  const winR = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf = lossR > 0 ? winR / lossR : winR > 0 ? Infinity : 0
  const avgR = withR.length ? totalR / withR.length : 0

  // Equity curve data
  let cumR = 0
  const equityData = withR.map((t, i) => {
    cumR += (t.result || 0)
    return { trade: i + 1, r: parseFloat(cumR.toFixed(2)) }
  })

  const recent = [...trades].reverse().slice(0, 5)

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: payload[0].value >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {payload[0].value >= 0 ? '+' : ''}{payload[0].value}R
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Trade #{payload[0].payload.trade}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" actions={
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('journal')}>
          + Log Trade
        </button>
      } />
      <div className="page-content">

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Trades</div>
            <div className="stat-value">{trades.length}</div>
            <div className="stat-sub">{wins.length}W · {losses.length}L</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Win Rate</div>
            <div className={`stat-value ${winRate >= 50 ? 'positive' : 'negative'}`}>
              {winRate.toFixed(1)}%
            </div>
            <div className="stat-sub">{withR.length} trades with R</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total R</div>
            <div className={`stat-value ${totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : ''}`}>
              {totalR > 0 ? '+' : ''}{totalR.toFixed(2)}R
            </div>
            <div className="stat-sub">Avg {formatR(avgR)} per trade</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Profit Factor</div>
            <div className={`stat-value ${pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative'}`}>
              {isFinite(pf) ? pf.toFixed(2) : '∞'}
            </div>
            <div className="stat-sub">Win/loss R ratio</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Win</div>
            <div className="stat-value positive">
              {wins.length ? '+' + (winR / wins.length).toFixed(2) + 'R' : '—'}
            </div>
            <div className="stat-sub">
              Avg loss: {losses.length ? (lossR / losses.length).toFixed(2) + 'R' : '—'}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="dashboard-grid">
          {/* Equity curve */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Equity Curve (R)</div>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              {equityData.length < 2 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  Log at least 2 trades to see your equity curve
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="trade" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
                    <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)', fontFamily: 'var(--mono)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone" dataKey="r" stroke="var(--accent)"
                      strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent trades */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Trades</div>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('journal')}>
                See all →
              </button>
            </div>
            <div style={{ overflow: 'hidden' }}>
              {recent.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  No trades logged yet.<br />
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('journal')}>
                    Log your first trade
                  </button>
                </div>
              ) : (
                recent.map(t => (
                  <div key={t.id} style={{
                    padding: '10px 18px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'background 0.1s'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--text)' }}>{t.symbol || '—'}</strong>
                        {t.direction && <span className={`badge badge-${t.direction}`}>{t.direction}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.date} · {t.strategy || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                      {t.outcome && <span className={`badge badge-${t.outcome}`}>{t.outcome}</span>}
                      <span className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'} style={{ fontSize: 13 }}>
                        {formatR(t.result)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
