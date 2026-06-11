import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, gradeColor } from '../lib/constants'
import Topbar from '../components/Topbar'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

export default function Analytics() {
  const { user, aiEnabled } = useAuth()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ outcome: '', direction: '', strategy: '' })

  useEffect(() => {
    if (!user) return
    sb.from('trades').select('*').eq('user_id', user.id).order('date', { ascending: false })
      .then(({ data }) => { setTrades(data || []); setLoading(false) })
  }, [user])

  const filtered = trades.filter(t => {
    if (filter.outcome && t.outcome !== filter.outcome) return false
    if (filter.direction && t.direction !== filter.direction) return false
    if (filter.strategy && t.strategy !== filter.strategy) return false
    return true
  })

  const withR = filtered.filter(t => t.result != null)
  const wins = withR.filter(t => t.outcome === 'W')
  const losses = withR.filter(t => t.outcome === 'L')
  const totalR = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? (wins.length / withR.length * 100) : 0
  const winR = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf = lossR > 0 ? winR / lossR : 0

  // Grade breakdown
  const gradeMap = {}
  withR.forEach(t => {
    const g = t.grade || 'No grade'
    if (!gradeMap[g]) gradeMap[g] = { wins: 0, total: 0, r: 0 }
    gradeMap[g].total++
    gradeMap[g].r += t.result || 0
    if (t.outcome === 'W') gradeMap[g].wins++
  })
  const gradeData = Object.entries(gradeMap)
    .sort((a, b) => ['A+','A','B','C','No grade'].indexOf(a[0]) - ['A+','A','B','C','No grade'].indexOf(b[0]))
    .map(([g, d]) => ({ grade: g, wr: d.total ? parseFloat((d.wins / d.total * 100).toFixed(1)) : 0, trades: d.total, r: parseFloat(d.r.toFixed(2)) }))

  // Emotion breakdown
  const emotionMap = {}
  withR.forEach(t => {
    if (!t.emotion) return
    if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { wins: 0, total: 0 }
    emotionMap[t.emotion].total++
    if (t.outcome === 'W') emotionMap[t.emotion].wins++
  })
  const emotionData = Object.entries(emotionMap)
    .map(([e, d]) => ({ emotion: e, wr: parseFloat((d.wins / d.total * 100).toFixed(1)), trades: d.total }))
    .sort((a, b) => b.wr - a.wr)

  // Strategy breakdown
  const stratMap = {}
  withR.forEach(t => {
    const s = t.strategy || 'No strategy'
    if (!stratMap[s]) stratMap[s] = { wins: 0, total: 0, r: 0 }
    stratMap[s].total++
    stratMap[s].r += t.result || 0
    if (t.outcome === 'W') stratMap[s].wins++
  })
  const stratData = Object.entries(stratMap)
    .map(([s, d]) => ({ strategy: s, wr: parseFloat((d.wins / d.total * 100).toFixed(1)), trades: d.total, r: parseFloat(d.r.toFixed(2)) }))
    .sort((a, b) => b.r - a.r)

  const strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text)', marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}{p.name === 'Win Rate' ? '%' : p.name === 'Total R' ? 'R' : ''}</div>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Analytics" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Analytics" />
      <div className="page-content">

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
            value={filter.outcome} onChange={e => setFilter(f => ({ ...f, outcome: e.target.value }))}>
            <option value="">All outcomes</option>
            <option value="W">Wins</option>
            <option value="L">Losses</option>
            <option value="BE">Break Even</option>
          </select>
          <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
            value={filter.direction} onChange={e => setFilter(f => ({ ...f, direction: e.target.value }))}>
            <option value="">All directions</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
          {strategies.length > 0 && (
            <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
              value={filter.strategy} onChange={e => setFilter(f => ({ ...f, strategy: e.target.value }))}>
              <option value="">All strategies</option>
              {strategies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {(filter.outcome || filter.direction || filter.strategy) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ outcome: '', direction: '', strategy: '' })}>
              ✕ Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
            {filtered.length} trades
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Trades', value: filtered.length, sub: `${wins.length}W · ${losses.length}L` },
            { label: 'Win Rate', value: winRate.toFixed(1) + '%', cls: winRate >= 50 ? 'positive' : 'negative' },
            { label: 'Total R', value: (totalR > 0 ? '+' : '') + totalR.toFixed(2) + 'R', cls: totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : '' },
            { label: 'Profit Factor', value: pf.toFixed(2), cls: pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative' },
            { label: 'Avg Win', value: wins.length ? '+' + (winR / wins.length).toFixed(2) + 'R' : '—', cls: 'positive' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.cls || ''}`}>{s.value}</div>
              {s.sub && <div className="stat-sub">{s.sub}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Grade breakdown */}
          {gradeData.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">Win Rate by Grade</div></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gradeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="grade" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
                    <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="wr" name="Win Rate" radius={[4, 4, 0, 0]}>
                      {gradeData.map((entry) => (
                        <Cell key={entry.grade} fill={gradeColor(entry.grade)} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Emotion breakdown */}
          {emotionData.length > 0 && (
            <div className="card">
              <div className="card-header"><div className="card-title">Win Rate by Emotion</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {emotionData.map(e => (
                    <div key={e.emotion} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 100, fontSize: 12, color: 'var(--text2)' }}>{e.emotion}</div>
                      <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: e.wr + '%',
                          background: e.wr >= 60 ? 'var(--green)' : e.wr >= 40 ? 'var(--amber)' : 'var(--red)',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                      <div style={{ width: 55, fontSize: 12, fontFamily: 'var(--mono)', color: e.wr >= 60 ? 'var(--green)' : e.wr >= 40 ? 'var(--amber)' : 'var(--red)', textAlign: 'right' }}>
                        {e.wr}% <span style={{ color: 'var(--text4)' }}>({e.trades})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Strategy breakdown */}
        {stratData.length > 1 && (
          <div className="card">
            <div className="card-header"><div className="card-title">Strategy Breakdown</div></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>Strategy</th><th>Trades</th><th>Win Rate</th><th>Total R</th>
                  </tr>
                </thead>
                <tbody>
                  {stratData.map(s => (
                    <tr key={s.strategy}>
                      <td style={{ color: 'var(--text)' }}>{s.strategy}</td>
                      <td className="mono">{s.trades}</td>
                      <td className="mono" style={{ color: s.wr >= 50 ? 'var(--green)' : 'var(--red)' }}>{s.wr}%</td>
                      <td className="mono" style={{ color: s.r > 0 ? 'var(--green)' : s.r < 0 ? 'var(--red)' : 'var(--text3)' }}>
                        {s.r > 0 ? '+' : ''}{s.r}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {withR.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>
            No data to analyze yet. Log some trades first.
          </div>
        )}

      </div>
    </div>
  )
}
