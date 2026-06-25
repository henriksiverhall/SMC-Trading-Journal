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

// ── Sessionsdefinitioner (lokal tid per stad) ──────────────────────────────────
const MARKET_SESSIONS = [
  { id: 'london', label: 'London',   flag: '🇬🇧', tz: 'Europe/London',    openH: 8,  openM: 0,  closeH: 16, closeM: 30 },
  { id: 'ny',     label: 'New York', flag: '🇺🇸', tz: 'America/New_York', openH: 9,  openM: 30, closeH: 16, closeM: 0  },
  { id: 'tokyo',  label: 'Tokyo',    flag: '🇯🇵', tz: 'Asia/Tokyo',       openH: 9,  openM: 0,  closeH: 15, closeM: 30 },
]

// Hämtar H, M, S i given tidszon – DST-korrekt via Intl
function getHMS(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date)
  return {
    h: parseInt(parts.find(p => p.type === 'hour').value),
    m: parseInt(parts.find(p => p.type === 'minute').value),
    s: parseInt(parts.find(p => p.type === 'second').value),
  }
}

// Beräknar ÖPPEN/STÄNGD och nedräkning baserat på stadens lokala tid
function sessionStatus(session, now) {
  const { h, m } = getHMS(now, session.tz)
  const cur   = h * 60 + m
  const open  = session.openH  * 60 + session.openM
  const close = session.closeH * 60 + session.closeM
  const isOpen = cur >= open && cur < close
  let minsTo = isOpen ? close - cur : (cur < open ? open - cur : 24 * 60 - cur + open)
  const hh = Math.floor(minsTo / 60), mm = minsTo % 60
  return { isOpen, countdown: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` }
}

// ── SVG-urtavla (återanvänds av alla klockor) ──────────────────────────────────
function ClockFace({ h, m, s, rimColor, arcOpenM12, arcCloseM12, isOpen }) {
  const SIZE = 110
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 5

  function angle12(mins) { return (mins / (12 * 60)) * 360 - 90 }
  function pt(deg, rad) {
    const a = (deg * Math.PI) / 180
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) }
  }
  function arc(m1, m2, rad) {
    const p1 = pt(angle12(m1), rad), p2 = pt(angle12(m2), rad)
    let span = m2 - m1; if (span <= 0) span += 12 * 60
    return `M ${p1.x} ${p1.y} A ${rad} ${rad} 0 ${span > 6 * 60 ? 1 : 0} 1 ${p2.x} ${p2.y}`
  }

  const sDeg = s * 6
  const mDeg = m * 6 + s * 0.1
  const hDeg = (h % 12) * 30 + m * 0.5

  function tip(deg, len) {
    const a = ((deg - 90) * Math.PI) / 180
    return { x: cx + len * Math.cos(a), y: cy + len * Math.sin(a) }
  }

  const sessionColor = isOpen !== undefined ? (isOpen ? '#10b981' : '#ef4444') : rimColor
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * Math.PI / 180
    const inner = r * (i % 3 === 0 ? 0.74 : 0.83)
    return {
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + r * 0.93 * Math.cos(a), y2: cy + r * 0.93 * Math.sin(a),
      major: i % 3 === 0,
    }
  })

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ filter: (isOpen === true) ? `drop-shadow(0 0 8px ${sessionColor}44)` : 'none' }}>
      <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.5)" stroke={rimColor} strokeWidth={2} />
      {/* Sessionsbåge – endast på marknadsklockor */}
      {arcOpenM12 !== undefined && (
        <path d={arc(arcOpenM12, arcCloseM12, r - 3.5)} fill="none"
          stroke={sessionColor} strokeWidth={7} strokeLinecap="round"
          opacity={isOpen ? 0.9 : 0.22} />
      )}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.major ? 'var(--text3)' : 'var(--text4)'}
          strokeWidth={t.major ? 2.2 : 1.1} />
      ))}
      <line x1={cx} y1={cy} x2={tip(hDeg, r * 0.48).x} y2={tip(hDeg, r * 0.48).y}
        stroke="var(--text)" strokeWidth={4} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={tip(mDeg, r * 0.65).x} y2={tip(mDeg, r * 0.65).y}
        stroke="var(--text2)" strokeWidth={2.8} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={tip(sDeg, r * 0.76).x} y2={tip(sDeg, r * 0.76).y}
        stroke={rimColor} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={rimColor} />
    </svg>
  )
}

// ── Klocka 1: Din lokala tid ───────────────────────────────────────────────────
function LocalClock({ now, localTz }) {
  const { h, m, s } = getHMS(now, localTz)
  const pad = n => String(n).padStart(2, '0')
  const cityName = localTz.split('/').pop().replace(/_/g, ' ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <ClockFace h={h} m={m} s={s} rimColor="var(--accent)" />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.3 }}>
        🕐 Din tid
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700, letterSpacing: 1 }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text4)' }}>{cityName}</div>
    </div>
  )
}

// ── Klocka 2–4: Marknadsklocka ────────────────────────────────────────────────
// Analog visar sessionens stads lokala tid.
// Digital visar stadens tid HH:MM:SS.
// Under: nedräkning till open/close, tydlig storlek.
// Badge: ÖPPEN / STÄNGD.
function MarketClock({ session, now }) {
  // Stadens lokala tid – används för visare OCH digital display
  const { h, m, s } = getHMS(now, session.tz)
  const status = sessionStatus(session, now)
  const pad = n => String(n).padStart(2, '0')

  // Sessionsbåge i 12h-koordinater (stadens lokala öppettider)
  const arcOpenM12  = (session.openH  % 12) * 60 + session.openM
  const arcCloseM12 = (session.closeH % 12) * 60 + session.closeM

  const statusColor = status.isOpen ? '#10b981' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <ClockFace
        h={h} m={m} s={s}
        rimColor={statusColor}
        arcOpenM12={arcOpenM12}
        arcCloseM12={arcCloseM12}
        isOpen={status.isOpen}
      />

      {/* Stadsnamn */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: 0.3 }}>
        {session.flag} {session.label}
      </div>

      {/* Stadens lokala tid HH:MM:SS */}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700, letterSpacing: 1 }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>

      {/* Nedräkning – tydlig storlek */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800,
        color: statusColor, letterSpacing: 0.5,
        background: status.isOpen ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
        padding: '2px 8px', borderRadius: 6,
      }}>
        {status.isOpen ? `stänger ${status.countdown}` : `öppnar ${status.countdown}`}
      </div>

      {/* Status-badge */}
      <div style={{
        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
        background: status.isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
        color: statusColor, letterSpacing: 0.7,
        border: `1px solid ${status.isOpen ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.25)'}`,
      }}>
        {status.isOpen ? '● ÖPPEN' : '○ STÄNGD'}
      </div>
    </div>
  )
}

// ── SessionClocks – 4 klockor ──────────────────────────────────────────────────
function SessionClocks() {
  const [now, setNow] = useState(new Date())
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <LocalClock now={now} localTz={localTz} />
      <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', margin: '0 2px' }} />
      {MARKET_SESSIONS.map(s => (
        <MarketClock key={s.id} session={s} now={now} />
      ))}
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const { user, userSettings, impersonating, unreadBroadcast, openThreads } = useAuth()
  const effectiveUserId = impersonating?.id ?? user?.id
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
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
  const sep = <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

  const widgets = [
    {
      id: 'welcome', title: 'Välkommen', span: 2,
      content: (
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg2) 0%, var(--accent-dim) 100%)', border: '1px solid rgba(0,212,170,0.15)' }}>
          <div className="card-body" style={{ paddingTop: 18, paddingBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 2 }}>
                  Hej, {effectiveDisplayName}! 👋
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'capitalize' }}>{dateStr}</div>
              </div>
              {sep}
              <div style={{ display: 'flex', gap: 20, flex: 1, justifyContent: 'flex-end' }}>
                {[
                  { label: 'Total R', value: (totalR >= 0 ? '+' : '') + totalR.toFixed(2) + 'R', color: totalR >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Win Rate', value: (winRate * 100).toFixed(1) + '%', color: winRate >= 0.5 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Trades', value: trades.length, color: 'var(--text)' },
                  { label: 'Profit Factor', value: isFinite(pf) ? pf.toFixed(2) : '∞', color: pf >= 1.5 ? 'var(--accent)' : pf >= 1 ? 'var(--green)' : 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {sep}
              <div style={{ flexShrink: 0 }}>
                <SessionClocks />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
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
