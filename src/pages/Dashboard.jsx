import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, WORKER_URL } from '../lib/constants'
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

const MARKET_SESSIONS = [
  { id: 'london', label: 'London',   flag: '🇬🇧', tz: 'Europe/London',    openH: 8,  openM: 0,  closeH: 16, closeM: 30 },
  { id: 'ny',     label: 'New York', flag: '🇺🇸', tz: 'America/New_York', openH: 9,  openM: 30, closeH: 16, closeM: 0  },
  { id: 'tokyo',  label: 'Tokyo',    flag: '🇯🇵', tz: 'Asia/Tokyo',       openH: 9,  openM: 0,  closeH: 15, closeM: 30 },
]

const INSTRUMENTS = [
  { id: 'xau', label: 'Guld',     icon: '🥇', tz: 'America/New_York', openH: 8,  openM: 20, closeH: 13, closeM: 30 },
  { id: 'cl',  label: 'Olja',     icon: '🛢️', tz: 'America/New_York', openH: 9,  openM: 0,  closeH: 14, closeM: 30 },
  { id: 'es',  label: 'ES/NQ/YM', icon: '📈', tz: 'America/New_York', openH: 9,  openM: 30, closeH: 16, closeM: 15 },
]

const IMPACT_STYLE = {
  High:   { color: '#ef4444' },
  Medium: { color: '#f59e0b' },
  Low:    { color: '#6b7280' },
}

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

function sessionStatus(session, now) {
  const { h, m, s } = getHMS(now, session.tz)
  const curSecs  = h * 3600 + m * 60 + s
  const openSecs = session.openH * 3600 + session.openM * 60
  const clsSecs  = session.closeH * 3600 + session.closeM * 60
  const isOpen   = curSecs >= openSecs && curSecs < clsSecs
  let secsTo = isOpen ? clsSecs - curSecs : curSecs < openSecs ? openSecs - curSecs : 24 * 3600 - curSecs + openSecs
  const hh = Math.floor(secsTo / 3600), mm = Math.floor((secsTo % 3600) / 60), ss = secsTo % 60
  const pad = n => String(n).padStart(2, '0')
  return { isOpen, countdown: `${pad(hh)}:${pad(mm)}:${pad(ss)}` }
}

// ── HUD-remsa (ersätter analoga klockor, v2.0.58/59/60) ────────────────────────
// Kompakta digitala kort med linjär progress-bar istället för klockvisare.
// Wrappas i .welcome-clocks-wrap på anropsstället – befintlig mobil-döljning
// (≤768px) fortsätter fungera oförändrat, ingen CSS-ändring krävdes där.
function HudCard({ label, time, isOpen, sub, progress }) {
  return (
    <div className={`hud-card ${isOpen ? 'hud-open' : 'hud-closed'}`}>
      <div className="hud-label"><span className={`hud-dot ${isOpen ? 'on' : 'off'}`} />{label}</div>
      <div className="hud-time">{time}</div>
      <div className="hud-bar-track"><div className={`hud-bar-fill ${isOpen ? 'on' : 'off'}`} style={{ width: `${progress}%` }} /></div>
      <div className="hud-sub">{sub}</div>
    </div>
  )
}

function sessionProgressPct(cfg, now) {
  const { h, m, s } = getHMS(now, cfg.tz)
  const curSecs = h * 3600 + m * 60 + s
  const openSecs = cfg.openH * 3600 + cfg.openM * 60
  const closeSecs = cfg.closeH * 3600 + cfg.closeM * 60
  const status = sessionStatus(cfg, now)
  if (!status.isOpen) return 12
  const len = closeSecs - openSecs
  return Math.min(100, Math.max(0, ((curSecs - openSecs) / len) * 100))
}

// v2.0.60: Operatör-kortet ligger kvar till vänster, resten av HUD-korten
// högerställs (justify-content: flex-end i egen flex-container) så de inte
// klumpar ihop sig direkt intill hälsningen på breda skärmar.
function HudStrip({ displayName }) {
  const [now, setNow] = useState(new Date())
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const { h: lh, m: lm, s: ls } = getHMS(now, localTz)
  const pad = n => String(n).padStart(2, '0')
  const dayProgress = ((lh * 3600 + lm * 60 + ls) / 86400) * 100
  const dateStr = now.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, width: '100%', flexWrap: 'wrap' }}>
      <HudCard label="Operatör" time={displayName.toUpperCase()} isOpen sub={dateStr} progress={100} />
      <div className="hud-strip" style={{ justifyContent: 'flex-end', flex: 1 }}>
        <HudCard label="Din tid" time={`${pad(lh)}:${pad(lm)}:${pad(ls)}`} isOpen sub={localTz.split('/').pop().replace(/_/g, ' ')} progress={dayProgress} />
        {MARKET_SESSIONS.map(sess => {
          const { h, m, s } = getHMS(now, sess.tz)
          const status = sessionStatus(sess, now)
          return (
            <HudCard key={sess.id} label={`${sess.flag} ${sess.label}`} time={`${pad(h)}:${pad(m)}:${pad(s)}`} isOpen={status.isOpen}
              sub={status.isOpen ? `stänger om ${status.countdown}` : `öppnar om ${status.countdown}`} progress={sessionProgressPct(sess, now)} />
          )
        })}
        {INSTRUMENTS.map(inst => {
          const { h, m, s } = getHMS(now, inst.tz)
          const status = sessionStatus(inst, now)
          return (
            <HudCard key={inst.id} label={`${inst.icon} ${inst.label}`} time={`${pad(h)}:${pad(m)}:${pad(s)}`} isOpen={status.isOpen}
              sub={status.isOpen ? `stänger om ${status.countdown}` : `öppnar om ${status.countdown}`} progress={sessionProgressPct(inst, now)} />
          )
        })}
      </div>
    </div>
  )
}

// ── Kalender-widget ────────────────────────────────────────────────────────────
function CalendarWidget({ onNavigate }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showToday, setShowToday] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch(`${WORKER_URL}/calendar?week=thisweek`)
      .then(r => r.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const highMedium = events.filter(e => e.impact === 'High' || e.impact === 'Medium')
  const todayEvents   = highMedium.filter(e => e.date?.split('T')[0] === today)
  const upcomingEvents = highMedium.filter(e => e.date?.split('T')[0] > today).slice(0, 10)
  const displayed = showToday ? todayEvents : upcomingEvents

  function fmtTime(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  }
  function fmtDay(dateStr) {
    return new Date(dateStr.split('T')[0] + 'T12:00:00Z')
      .toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <div className="card-title">📅 Ekonomisk kalender</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setShowToday(true)}  className={`btn btn-sm ${showToday  ? 'btn-primary' : 'btn-ghost'}`}>Idag</button>
          <button onClick={() => setShowToday(false)} className={`btn btn-sm ${!showToday ? 'btn-primary' : 'btn-ghost'}`}>Kommande</button>
          <button onClick={() => onNavigate('calendar')} className="btn btn-ghost btn-sm" style={{ marginLeft: 4 }}>Alla →</button>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading && <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>Laddar…</div>}
        {!loading && displayed.length === 0 && (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
            {showToday ? 'Inga high/medium-impact nyheter idag.' : 'Inga kommande nyheter i cachen — refresha via Admin → System.'}
          </div>
        )}
        {!loading && displayed.map((ev, i) => {
          const imp = IMPACT_STYLE[ev.impact] || IMPACT_STYLE.Low
          const isToday = ev.date?.split('T')[0] === today
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: imp.color, flexShrink: 0, display: 'inline-block' }} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text4)', flexShrink: 0, width: isToday ? 38 : 76 }}>
                {isToday ? fmtTime(ev.date) : fmtDay(ev.date)}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', flexShrink: 0, width: 28 }}>{ev.country}</span>
              <span style={{ fontSize: 12, color: ev.impact === 'High' ? 'var(--text)' : 'var(--text2)', fontWeight: ev.impact === 'High' ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
              {ev.forecast && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text4)', flexShrink: 0 }}>{ev.forecast}</span>}
            </div>
          )
        })}
      </div>
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

  const widgets = [
    {
      id: 'welcome', title: 'Välkommen', span: 2,
      content: (
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg2) 0%, var(--accent-dim) 60%, var(--violet-dim) 100%)', border: '1px solid rgba(0,212,170,0.15)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-glow), var(--violet-glow), transparent)' }} />
          <div className="card-body" style={{ paddingTop: 18, paddingBottom: 18 }}>
            <div className="welcome-clocks-wrap">
              <HudStrip displayName={effectiveDisplayName} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('journal')}>+ Logga trade</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('checklist')}>✅ Checklist</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('analytics')}>📊 Analytics</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('journal')}>📓 Journal</button>
              {unreadBroadcast > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('profile')} style={{ borderColor: 'rgba(0,212,170,0.4)', color: 'var(--accent)' }}>✉️ {unreadBroadcast} nytt meddelande{unreadBroadcast > 1 ? 'n' : ''}</button>
              )}
              {openThreads > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('profile')} style={{ borderColor: 'rgba(124,92,255,0.4)', color: 'var(--violet)' }}>🎫 {openThreads} öppet ärende{openThreads > 1 ? 'n' : ''}</button>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'calendar', title: 'Ekonomisk kalender',
      content: <CalendarWidget onNavigate={onNavigate} />
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
      id: 'stats', title: 'Statistik',
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
                <div key={s.label} className={`stat-card ${s.cls === 'negative' ? 'neg' : ''}`}>
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
      id: 'equity', title: 'Equity Curve',
      content: (
        <div className="card">
          <div className="card-header"><div className="card-title">Equity Curve (R)</div></div>
          <div className="card-body equity-glow" style={{ paddingTop: 12 }}>
            {equityData.length < 2 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Logga minst 2 trades för att se equity curve</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="trade" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
                  <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)', fontFamily: 'var(--mono)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="r" stroke="var(--accent)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }} />
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
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: t.outcome === 'W' ? 'var(--green-dim)' : t.outcome === 'L' ? 'var(--red-dim)' : 'var(--bg4)',
                    color: t.outcome === 'W' ? 'var(--green)' : t.outcome === 'L' ? 'var(--red)' : 'var(--text3)',
                    boxShadow: t.outcome === 'W' ? '0 0 8px rgba(34,197,94,0.35)' : t.outcome === 'L' ? '0 0 8px rgba(239,68,68,0.3)' : 'none',
                  }}>{t.outcome}</div>
                ))}
            </div>
          </div>
        </div>
      )
    },
  ]

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Dashboard" subtitle={impersonating ? `👁 Visar: ${impersonating.email}` : undefined} />
      <div className="page-content">
        <DragGrid pageKey="dashboard" widgets={widgets} columns={1} />
      </div>
    </div>
  )
}
