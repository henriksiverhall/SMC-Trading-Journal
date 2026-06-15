import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, gradeColor } from '../lib/constants'
import Topbar from '../components/Topbar'
import DragGrid from '../components/DragGrid'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function CustomTooltip({ active, payload }) {
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
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
      </div>
    </div>
  )

  const withR   = trades.filter(t => t.result != null)
  const wins    = withR.filter(t => t.outcome === 'W')
  const losses  = withR.filter(t => t.outcome === 'L')
  const totalR  = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? (wins.length / withR.length * 100) : 0
  const winR    = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR   = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf      = lossR > 0 ? winR / lossR : winR > 0 ? Infinity : 0
  const avgR    = withR.length ? totalR / withR.length : 0

  let cumR = 0
  const equityData = withR.map((t, i) => {
    cumR += t.result || 0
    return { trade: i + 1, r: parseFloat(cumR.toFixed(2)) }
  })

  const recent = [...trades].reverse().slice(0, 5)

  // ── Widget definitions ────────────────────────────────────────────────────
  const widgets = [
    {
      id: 'stats',
      title: 'Statistik',
      span: 2,
      content: (
        <div className="stats-grid">
          {[
            { label: 'Trades',        value: trades.length,                                            sub: `${wins.length}V · ${losses.length}F` },
            { label: 'Win Rate',      value: winRate.toFixed(1) + '%',                                 cls: winRate >= 50 ? 'positive' : 'negative' },
            { label: 'Total R',       value: (totalR > 0 ? '+' : '') + totalR.toFixed(2) + 'R',       cls: totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : '' },
            { label: 'Profit Factor', value: isFinite(pf) ? pf.toFixed(2) : '∞',                     cls: pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative', sub: 'Win/loss R ratio' },
            { label: 'Avg Vinst',     value: wins.length ? '+' + (winR / wins.length).toFixed(2) + 'R' : '—', cls: 'positive', sub: losses.length ? 'Avg förlust: ' + (lossR/losses.length).toFixed(2) + 'R' : '' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.cls || ''}`}>{s.value}</div>
              {s.sub && <div className="stat-sub">{s.sub}</div>}
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'equity',
      title: 'Equity Curve',
      span: 2,
      content: (
        <div className="card">
          <div className="card-header"><div className="card-title">Equity Curve (R)</div></div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {equityData.length < 2 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
                Logga minst 2 trades för att se equity curve
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="trade" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
                  <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)', fontFamily: 'var(--mono)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="r" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'recent',
      title: 'Senaste trades',
      content: (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Senaste trades</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('journal')}>Se alla →</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Inga trades loggade ännu.<br />
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNavigate('journal')}>
                Logga din första trade
              </button>
            </div>
          ) : recent.map(t => (
            <div key={t.id} style={{
              padding: '10px 18px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', transition: 'background 0.1s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--text)' }}>{t.symbol || '—'}</strong>
                  {t.direction && <span className={`badge badge-${t.direction}`}>{t.direction}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.date} · {t.strategy || '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.outcome && <span className={`badge badge-${t.outcome}`}>{t.outcome}</span>}
                <span className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'} style={{ fontSize: 13 }}>
                  {formatR(t.result)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'streak',
      title: 'Streak & form',
      newIn: 'v2.0.4',
      content: (() => {
        // Calculate current streak
        const sorted = [...trades].filter(t => t.outcome).sort((a, b) => b.date > a.date ? 1 : -1)
        let streak = 0, streakType = null
        for (const t of sorted) {
          if (streakType === null) { streakType = t.outcome; streak = 1 }
          else if (t.outcome === streakType) streak++
          else break
        }
        // Last 10 trades form
        const last10 = sorted.slice(0, 10).reverse()
        return (
          <div className="card">
            <div className="card-header"><div className="card-title">Streak & Form</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                <div>
                  <div className="stat-label" style={{ marginBottom: 4 }}>Nuvarande streak</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: streakType === 'W' ? 'var(--green)' : streakType === 'L' ? 'var(--red)' : 'var(--text3)' }}>
                    {streak > 0 ? `${streak} ${streakType === 'W' ? 'vinster' : streakType === 'L' ? 'förluster' : ''}` : '—'}
                  </div>
                </div>
              </div>
              <div className="stat-label" style={{ marginBottom: 6 }}>Senaste 10 trades</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {last10.length === 0 ? <span style={{ color: 'var(--text4)', fontSize: 12 }}>Inga trades än</span>
                  : last10.map((t, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: t.outcome === 'W' ? 'var(--green-dim)' : t.outcome === 'L' ? 'var(--red-dim)' : 'var(--bg4)',
                      color: t.outcome === 'W' ? 'var(--green)' : t.outcome === 'L' ? 'var(--red)' : 'var(--text3)',
                    }}>{t.outcome}</div>
                  ))
                }
              </div>
            </div>
          </div>
        )
      })()
    },
  ]

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" actions={
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('journal')}>+ Log Trade</button>
      } />
      <div className="page-content">
        <DragGrid pageKey="dashboard" widgets={widgets} columns={1} />
      </div>
    </div>
  )
}
