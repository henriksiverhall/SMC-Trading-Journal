import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR } from '../lib/constants'
import { normalizeTrades } from '../lib/tradeUtils'
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

function useNextSession() {
  const [info, setInfo] = useState({ label: '', countdown: '' })
  useEffect(() => {
    function calc() {
      const now = new Date()
      const utcH = now.getUTCHours(), utcM = now.getUTCMinutes(), utcD = now.getUTCDay()
      const isWeekend = utcD === 0 || utcD === 6
      const sessions = [{ label: 'London', utcHour: 8, utcMin: 0 }, { label: 'New York', utcHour: 13, utcMin: 30 }]
      const nowMins = utcH * 60 + utcM
      let nextSession = null, minsUntil = Infinity
      for (const s of sessions) {
        const sMins = s.utcHour * 60 + s.utcMin
        let diff = sMins - nowMins
        if (diff < 0) diff += 24 * 60
        if (diff < minsUntil) { minsUntil = diff; nextSession = s }
      }
      if (isWeekend) {
        const daysUntilMon = utcD === 6 ? 2 : 1
        return { label: 'London måndag', countdown: `${daysUntilMon}d ${8 - utcH}h` }
      }
      const h = Math.floor(minsUntil / 60), m = minsUntil % 60
      const isOpen = sessions.some(s => {
        const sMins = s.utcHour * 60 + s.utcMin
        const eMins = sMins + (s.label === 'London' ? 210 : 180)
        return nowMins >= sMins && nowMins < eMins
      })
      return {
        label: isOpen ? (nowMins < 13 * 60 + 30 ? 'London öppen' : 'New York öppen') : `${nextSession?.label} öppnar om`,
        countdown: isOpen ? '' : `${h}h ${m}m`,
        isOpen,
      }
    }
    setInfo(calc())
    const t = setInterval(() => setInfo(calc()), 60000)
    return () => clearInterval(t)
  }, [])
  return info
}

export default function Dashboard({ onNavigate }) {
  const { user, userSettings, impersonating, unreadBroadcast, openThreads } = useAuth()
  const effectiveUserId = impersonating?.id ?? user?.id
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const session = useNextSession()
  const effectiveDisplayName = impersonating?.email?.split('@')[0] || userSettings?.displayName || user?.email?.split('@')[0] || 'Trader'

  useEffect(() => {
    if (!effectiveUserId) return
    setTrades([]); setLoading(true)
    sb.from('trades').select('*').eq('user_id', effectiveUserId).order('date', { ascending: true })
      .then(({ data }) => { setTrades(normalizeTrades(data || [])); setLoading(false) })
  }, [effectiveUserId])

  if (loading) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" subtitle={impersonating ? `👁 Visar: ${impersonating.email}` : undefined} />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
      </div>
    </div>
  )

  const withR = trades.filter(t => t.result != null)
  const wins = withR.filter(t => t.outcome === 'W')
  const losses = withR.filter(t => t.outcome === 'L')
  const totalR = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? wins.length / withR.length : 0
  const winR = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf = lossR > 0 ? winR / lossR : winR > 0 ? Infinity : 0
  const avgWin = wins.length ? winR / wins.length : 0
  const avgLoss = losses.length ? lossR / losses.length : 0
  const expectancy = wins.length && losses.length ? parseFloat((winRate * avgWin - (1 - winRate) * avgLoss).toFixed(3)) : null

  let equity = 0, peak = 0, maxDD = 0
  for (const t of withR) {
    equity += t.result || 0
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDD) maxDD = dd
  }
  const recoveryFactor = maxDD > 0 ? parseFloat((totalR / maxDD).toFixed(2)) : null

  const today = new Date().toISOString().split('T')[0]
  const todayTrades = trades.filter(t => t.date === today)
  const todayR = todayTrades.filter(t => t.result != null).reduce((a, t) => a + (t.result || 0), 0)

  const sorted = [...trades].filter(t => t.outcome).sort((a, b) => b.date > a.date ? 1 : -1)
  let streak = 0, streakType = null, longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0
  for (const t of [...withR].sort((a, b) => a.date > b.date ? 1 : -1)) {
    if (t.outcome === 'W') { curWin++; curLoss = 0 } else { curLoss++; curWin = 0 }
    if (curWin > longestWin) longestWin = curWin
    if (curLoss > longestLoss) longestLoss = curLoss
  }
  for (const t of sorted) {
    if (streakType === null) { streakType = t.outcome; streak = 1 }
    else if (t.outcome === streakType) { streak++ }
    else { break }
  }
  const last10 = sorted.slice(0, 10).reverse()

  let cumR = 0
  const equityData = withR.map((t, i) => { cumR += t.result || 0; return { trade: i + 1, r: parseFloat(cumR.toFixed(2)) } })
  const recent = [...trades].reverse().slice(0, 5)
  const dateStr = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  const widgets = [
    {
      id: 'welcome', title: 'Välkommen', span: 2,
      content: (
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg2) 0%, var(--accent-dim) 100%)', border: '1px solid rgba(0,212,170,0.15)' }}>
          <div className="card-body" style={{ paddingTop: 20, paddingBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4 }}>Hej, {effectiveDisplayName}! 👋</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', textTransform: 'capitalize' }}>{dateStr}</div>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Total R</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: totalR >= 0 ? 'var(--green)' : 'var(--red)' }}>{totalR >= 0 ? '+' : ''}{totalR.toFixed(2)}R</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Win Rate</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: winRate >= 0.5 ? 'var(--green)' : 'var(--red)' }}>{(winRate * 100).toFixed(1)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Trades</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{trades.length}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{session.isOpen ? '🟢 Session' : '⏱ Session'}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: session.isOpen ? 'var(--green)' : 'var(--accent)', marginTop: 3 }}>
                    {session.label}{session.countdown ? <span style={{ fontSize: 11, fontWeight: 400 }}><br />{session.countdown}</span> : ''}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('journal')}>+ Logga trade</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checklist')}>✅ Checklist</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('analytics')}>📊 Analytics</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('journal')}>📓 Journal</button>
              {unreadBroadcast > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('profile')}
                  style={{ borderColor: 'rgba(0,212,170,0.4)', color: 'var(--accent)' }}>
                  ✉️ {unreadBroadcast} nytt meddelande{unreadBroadcast > 1 ? 'n' : ''}
                </button>
              )}
              {openThreads > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('profile')}
                  style={{ borderColor: 'rgba(99,102,241,0.4)', color: '#818cf8' }}>
                  🎫 {openThreads} öppet ärende{openThreads > 1 ? 'n' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'today', title: 'Idag',
      content: (
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header"><div className="card-title">📅 Idag</div></div>
          <div className="card-body">
            {todayTrades.length === 0 ? (
              <div style={{ color: 'var(--text4)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Inga trades idag än</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                  <div><div className="stat-label">Trades idag</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{todayTrades.length}</div></div>
                  <div><div className="stat-label">P&amp;L idag</div><div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: todayR >= 0 ? 'var(--green)' : 'var(--red)' }}>{todayR >= 0 ? '+' : ''}{todayR.toFixed(2)}R</div></div>
                </div>
                {todayTrades.slice(-3).reverse().map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>{t.symbol || '—'} · {t.time || ''}</span>
                    <span className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'}>{formatR(t.result)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'stats', title: 'Statistik', span: 2,
      content: (
        <div className="card">
          <div className="card-header"><div className="card-title">Statistik</div></div>
          <div className="card-body">
            <div className="stats-grid">
              {[
                { label: 'Trades', value: trades.length, sub: `${wins.length}V · ${losses.length}F` },
                { label: 'Win Rate', value: (winRate * 100).toFixed(1) + '%', cls: winRate >= 0.5 ? 'positive' : 'negative' },
                { label: 'Total R', value: (totalR > 0 ? '+' : '') + totalR.toFixed(2) + 'R', cls: totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : '' },
                { label: 'Profit Factor', value: isFinite(pf) ? pf.toFixed(2) : '∞', cls: pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative' },
                { label: 'Expectancy', value: expectancy != null ? (expectancy > 0 ? '+' : '') + expectancy + 'R' : '—', cls: expectancy > 0 ? 'positive' : expectancy < 0 ? 'negative' : '', sub: 'per trade' },
                { label: 'Max DD', value: maxDD > 0 ? '-' + maxDD.toFixed(2) + 'R' : '0.00R', cls: maxDD > 0 ? 'negative' : '' },
                { label: 'Recovery Factor', value: recoveryFactor != null ? recoveryFactor : '—', cls: recoveryFactor >= 2 ? 'positive' : recoveryFactor < 1 ? 'negative' : '', sub: 'netto/max DD' },
                { label: 'Längsta svit', value: longestWin > 0 ? `${longestWin}V / ${longestLoss}F` : '—', sub: 'vinst / förlust' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className={`stat-value ${s.cls || ''}`}>{s.value}</div>
                  {s.sub && <div className="stat-sub">{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'equity', title: 'Equity Curve', span: 2,
      content: (
        <div className="card">
          <div className="card-header"><div className="card-title">Equity Curve (R)</div></div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {equityData.length < 2 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Logga minst 2 trades för att se equity curve</div>
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
      id: 'recent', title: 'Senaste trades',
      content: (
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header">
            <div className="card-title">Senaste trades</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('journal')}>Se alla →</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga trades loggade ännu.</div>
          ) : recent.map(t => (
            <div key={t.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.1s' }}
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
                <span className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'} style={{ fontSize: 13 }}>{formatR(t.result)}</span>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'streak', title: 'Streak & form',
      content: (
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header"><div className="card-title">🔥 Streak & Form</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              <div>
                <div className="stat-label" style={{ marginBottom: 4 }}>Nuvarande streak</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: streakType === 'W' ? 'var(--green)' : streakType === 'L' ? 'var(--red)' : 'var(--text3)' }}>
                  {streak > 0 ? `${streak} ${streakType === 'W' ? 'vinster' : 'förluster'}` : '—'}
                </div>
              </div>
              <div>
                <div className="stat-label" style={{ marginBottom: 4 }}>Längsta</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--green)' }}>{longestWin}V</span> / <span style={{ color: 'var(--red)' }}>{longestLoss}F</span>
                </div>
              </div>
            </div>
            <div className="stat-label" style={{ marginBottom: 6 }}>Senaste 10 trades</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {last10.length === 0 ? <span style={{ color: 'var(--text4)', fontSize: 12 }}>Inga trades än</span>
                : last10.map((t, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: t.outcome === 'W' ? 'var(--green-dim)' : t.outcome === 'L' ? 'var(--red-dim)' : 'var(--bg4)', color: t.outcome === 'W' ? 'var(--green)' : t.outcome === 'L' ? 'var(--red)' : 'var(--text3)' }}>{t.outcome}</div>
                ))}
            </div>
          </div>
        </div>
      )
    },
  ]

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" subtitle={impersonating ? `👁 Visar: ${impersonating.email}` : undefined} actions={
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('journal')}>+ Log Trade</button>
      } />
      <div className="page-content">
        <DragGrid pageKey="dashboard" widgets={widgets} columns={2} />
      </div>
    </div>
  )
}
