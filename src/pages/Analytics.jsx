import { useEffect, useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, gradeColor, WORKER_URL, TWELVE_KEY, getTwelveSymbol } from '../lib/constants'
import Topbar from '../components/Topbar'
import DragGrid from '../components/DragGrid'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from 'recharts'

// ── TwelveData helpers ────────────────────────────────────────────────────────
const _mdCache = {}

async function fetchOHLC(symbol, datetime) {
  const key = symbol + '_' + datetime
  if (_mdCache[key]) return _mdCache[key]
  try {
    const startDt = datetime.replace('T', ' ').substring(0, 16)
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=5min&start_date=${encodeURIComponent(startDt)}&outputsize=120&apikey=${TWELVE_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'error' || !data.values) return null
    _mdCache[key] = data.values
    return data.values
  } catch { return null }
}

async function calcMFE_MAE(trade) {
  if (!trade.entry || !trade.sl || !trade.date || !trade.direction) return null
  const sym = getTwelveSymbol(trade.symbol)
  if (!sym) return null
  const dt = trade.date + 'T' + (trade.time || '09:30') + ':00'
  const bars = await fetchOHLC(sym, dt)
  if (!bars?.length) return null

  const entryTime = new Date(dt).getTime()
  const afterEntry = bars
    .filter(b => new Date(b.datetime).getTime() >= entryTime)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  if (!afterEntry.length) return null

  const isLong = trade.direction === 'Long'
  const risk = Math.abs(trade.entry - trade.sl)
  if (risk === 0) return null

  let mfe = 0, mae = 0
  afterEntry.forEach(b => {
    const high = parseFloat(b.high), low = parseFloat(b.low)
    if (isLong) {
      mfe = Math.max(mfe, (high - trade.entry) / risk)
      mae = Math.min(mae, (low - trade.entry) / risk)
    } else {
      mfe = Math.max(mfe, (trade.entry - low) / risk)
      mae = Math.min(mae, (trade.entry - high) / risk)
    }
  })
  return { mfe: parseFloat(mfe.toFixed(2)), mae: parseFloat(mae.toFixed(2)) }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, cls }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls || ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}{p.name === 'Win Rate' ? '%' : p.name?.includes('R') ? 'R' : ''}</div>
      ))}
    </div>
  )
}

// ── Equity Curve ──────────────────────────────────────────────────────────────
function EquityCurve({ trades }) {
  const sorted = [...trades].filter(t => t.result != null).sort((a, b) => a.date > b.date ? 1 : -1)
  let cum = 0
  const data = sorted.map(t => { cum += t.result || 0; return { date: t.date, R: parseFloat(cum.toFixed(2)) } })
  if (!data.length) return null
  const isPositive = data[data.length - 1]?.R >= 0
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">Equity Curve (kumulativt R)</div></div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text4)" tick={{ fontSize: 10, fill: 'var(--text4)' }} tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
            <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="R" name="Kumulativt R" stroke={isPositive ? 'var(--green)' : 'var(--red)'}
              dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── MFE/MAE Section ───────────────────────────────────────────────────────────
function MFESection({ trades }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [results, setResults] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)

  const candidates = trades.filter(t => t.entry && t.sl && t.date && t.direction && getTwelveSymbol(t.symbol))

  useEffect(() => {
    // Load from cache on mount
    const cached = candidates.filter(t => t.custom_data?._mfe != null)
      .map(t => ({ ...t, _mfe: t.custom_data._mfe, _mae: t.custom_data._mae }))
    if (cached.length > 0) {
      setResults(cached)
      setFetchedAt(cached[0]?.custom_data?._mfe_fetched_at)
      setStatus('done')
    }
  }, [trades.length])

  async function fetchData() {
    if (!candidates.length) return
    setStatus('loading')
    const now = new Date().toISOString()
    const out = []
    for (const t of candidates.slice(0, 20)) {
      const md = await calcMFE_MAE(t)
      if (md) {
        const updated = { ...(t.custom_data || {}), _mfe: md.mfe, _mae: md.mae, _mfe_fetched_at: now }
        await sb.from('trades').update({ custom_data: updated }).eq('id', t.id)
        out.push({ ...t, _mfe: md.mfe, _mae: md.mae })
      }
    }
    if (out.length) { setResults(out); setFetchedAt(now); setStatus('done') }
    else setStatus('error')
  }

  const avgMFE = results.length ? (results.reduce((a, t) => a + (t._mfe || 0), 0) / results.length).toFixed(2) : null
  const avgMAE = results.length ? Math.abs(results.reduce((a, t) => a + (t._mae || 0), 0) / results.length).toFixed(2) : null
  const avgR   = results.filter(t => t.result != null).length
    ? (results.filter(t => t.result != null).reduce((a, t) => a + t.result, 0) / results.filter(t => t.result != null).length).toFixed(2)
    : null
  const leftOnTable = avgMFE != null && avgR != null ? (parseFloat(avgMFE) - parseFloat(avgR)).toFixed(2) : null

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">📐 MFE / MAE – Execution-analys</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fetchedAt && <span style={{ fontSize: 11, color: 'var(--text4)' }}>Hämtad {new Date(fetchedAt).toLocaleDateString('sv-SE')}</span>}
          <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={status === 'loading' || !candidates.length}>
            {status === 'loading' ? 'Hämtar…' : status === 'done' ? '↺ Uppdatera' : '▶ Hämta data'}
          </button>
        </div>
      </div>
      <div className="card-body">
        {status === 'idle' && !results.length && (
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            Klicka "Hämta data" för att beräkna MFE/MAE för dina senaste trades via TwelveData.<br />
            <strong>MFE</strong> = hur långt priset gick i din riktning · <strong>MAE</strong> = hur långt priset gick mot dig · <strong>Lämnat på bordet</strong> = MFE − utfall
          </p>
        )}
        {status === 'loading' && <p style={{ fontSize: 13, color: 'var(--text3)' }}>Hämtar marknadsdata – kan ta några sekunder…</p>}
        {status === 'error' && <p style={{ fontSize: 13, color: 'var(--amber)' }}>⚠ Ingen data. Kontrollera instrument och tid för trades.</p>}
        {results.length > 0 && (
          <>
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              {[
                { label: 'Avg MFE', value: avgMFE != null ? '+' + avgMFE + 'R' : '—', cls: 'positive' },
                { label: 'Avg MAE', value: avgMAE != null ? '-' + avgMAE + 'R' : '—', cls: 'negative' },
                { label: 'Avg Utfall', value: avgR != null ? (parseFloat(avgR) >= 0 ? '+' : '') + avgR + 'R' : '—', cls: parseFloat(avgR) >= 0 ? 'positive' : 'negative' },
                { label: 'Lämnat på bordet', value: leftOnTable != null ? '+' + leftOnTable + 'R' : '—', cls: 'accent' },
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="journal-table">
                <thead><tr>
                  <th>Datum</th><th>Symbol</th><th>Dir</th><th>Utfall</th>
                  <th style={{ color: 'var(--green)' }}>MFE</th>
                  <th style={{ color: 'var(--red)' }}>MAE</th>
                  <th style={{ color: 'var(--amber)' }}>På bordet</th>
                </tr></thead>
                <tbody>
                  {results.map(t => {
                    const left = t._mfe != null && t.result != null ? (t._mfe - t.result).toFixed(2) : null
                    return (
                      <tr key={t.id}>
                        <td className="mono">{t.date}</td>
                        <td><strong>{t.symbol}</strong></td>
                        <td>{t.direction ? <span className={`badge badge-${t.direction}`}>{t.direction}</span> : '—'}</td>
                        <td className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'}>{formatR(t.result)}</td>
                        <td style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{t._mfe != null ? '+' + t._mfe + 'R' : '—'}</td>
                        <td style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{t._mae != null ? t._mae + 'R' : '—'}</td>
                        <td style={{ color: 'var(--amber)', fontFamily: 'var(--mono)' }}>{left != null && parseFloat(left) > 0 ? '+' + left + 'R' : left != null ? left + 'R' : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── RR Optimizer ──────────────────────────────────────────────────────────────
function RROptimizer({ trades }) {
  const withMFE = trades.filter(t => t.custom_data?._mfe != null && t.result != null && t.entry && t.sl)
  if (!withMFE.length) return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">📊 RR-optimerare</div></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Kräver MFE-data. Hämta MFE/MAE-data ovan först.</p>
      </div>
    </div>
  )

  const rrLevels = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
  const currentAvgRR = parseFloat((withMFE.filter(t => t.result > 0).reduce((a, t) => a + t.result, 0) / Math.max(withMFE.filter(t => t.result > 0).length, 1)).toFixed(2))

  const simData = rrLevels.map(rr => {
    const wins = withMFE.filter(t => (t.custom_data._mfe || 0) >= rr)
    const wr = wins.length / withMFE.length
    const expectancy = parseFloat((wr * rr - (1 - wr) * 1).toFixed(3))
    return {
      rr: rr + 'R',
      rrVal: rr,
      'Win Rate': parseFloat((wr * 100).toFixed(1)),
      Expectancy: expectancy,
      wins: wins.length,
      total: withMFE.length,
    }
  })

  const best = simData.reduce((a, b) => b.Expectancy > a.Expectancy ? b : a)
  const current = simData.reduce((a, b) => Math.abs(b.rrVal - currentAvgRR) < Math.abs(a.rrVal - currentAvgRR) ? b : a)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">📊 RR-optimerare</div></div>
      <div className="card-body">
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r)', lineHeight: 1.6 }}>
          Baserat på {withMFE.length} trades med MFE-data: optimalt RR är <strong style={{ color: 'var(--accent)' }}>{best.rr}</strong> (expectancy {best.Expectancy > 0 ? '+' : ''}{best.Expectancy}R per trade).
          {best.rrVal !== current.rrVal && (
            <> Ditt nuvarande snitt-RR är ~{currentAvgRR}R – {best.Expectancy > current.Expectancy ? `öka till ${best.rr} för bättre expectancy` : 'du är nära optimalt'}.</>
          )}
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={simData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="rr" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
            <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--border2)" />
            <Bar dataKey="Expectancy" name="Expectancy" radius={[4, 4, 0, 0]}>
              {simData.map(d => (
                <Cell key={d.rr} fill={d.rr === best.rr ? 'var(--accent)' : d.Expectancy > 0 ? 'var(--green)' : 'var(--red)'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="journal-table">
            <thead><tr>
              <th>RR</th><th>Wins</th><th>Win Rate</th><th>Expectancy/trade</th><th></th>
            </tr></thead>
            <tbody>
              {simData.map(d => (
                <tr key={d.rr} style={{ background: d.rr === best.rr ? 'rgba(0,212,170,0.05)' : undefined }}>
                  <td className="mono" style={{ fontWeight: d.rr === best.rr ? 700 : 400 }}>{d.rr}</td>
                  <td className="mono">{d.wins}/{d.total}</td>
                  <td className="mono" style={{ color: d['Win Rate'] >= 50 ? 'var(--green)' : 'var(--red)' }}>{d['Win Rate']}%</td>
                  <td className="mono" style={{ color: d.Expectancy > 0 ? 'var(--green)' : 'var(--red)' }}>{d.Expectancy > 0 ? '+' : ''}{d.Expectancy}R</td>
                  <td>{d.rr === best.rr && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>OPTIMALT</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── AI Analysis ───────────────────────────────────────────────────────────────
function AIAnalysis({ trades, aiEnabled }) {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  if (!aiEnabled) return null

  const withR = trades.filter(t => t.result != null)
  const wins = withR.filter(t => t.outcome === 'W')
  const wr = withR.length ? (wins.length / withR.length * 100).toFixed(1) : 0
  const totalR = withR.reduce((a, t) => a + (t.result || 0), 0).toFixed(2)
  const pf = (() => {
    const winR = wins.reduce((a, t) => a + t.result, 0)
    const lossR = Math.abs(withR.filter(t => t.outcome === 'L').reduce((a, t) => a + t.result, 0))
    return lossR > 0 ? (winR / lossR).toFixed(2) : '∞'
  })()

  async function analyze() {
    setLoading(true)
    const prompt = `Du är en erfaren trading coach. Analysera dessa tradingstatistik och ge konkreta råd på svenska:

Antal trades: ${withR.length} (${wins.length} vinster, ${withR.filter(t => t.outcome === 'L').length} förluster)
Win Rate: ${wr}%
Total R: ${totalR}R
Profit Factor: ${pf}
Strategier: ${[...new Set(trades.map(t => t.strategy).filter(Boolean))].join(', ') || 'ej angivet'}
Senaste 5 trades: ${withR.slice(0, 5).map(t => `${t.date} ${t.outcome} ${t.result?.toFixed(2)}R`).join(', ')}

Ge 3 konkreta förbättringsråd baserat på dessa siffror. Var specifik och direkt.`

    try {
      const res = await fetch(`${WORKER_URL}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || 'Inget svar.'
      setResponse(text)
      setHistory(h => [{ date: new Date().toLocaleDateString('sv-SE'), text }, ...h.slice(0, 4)])
    } catch {
      setResponse('Kunde inte ansluta till AI-tjänsten.')
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">🤖 AI-analys</div>
        <button className="btn btn-ghost btn-sm" onClick={analyze} disabled={loading || !withR.length}>
          {loading ? 'Analyserar…' : '✨ Analysera'}
        </button>
      </div>
      <div className="card-body">
        {!response && !loading && (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Klicka "Analysera" för att få AI-baserade råd om din trading baserat på aktuell statistik.</p>
        )}
        {loading && <p style={{ fontSize: 13, color: 'var(--text3)' }}>Analyserar dina trades…</p>}
        {response && (
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
            {response}
          </div>
        )}
        {history.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Historik</div>
            {history.slice(1).map((h, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>{h.date}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{h.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Analytics ────────────────────────────────────────────────────────────
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

  const withR   = filtered.filter(t => t.result != null)
  const wins    = withR.filter(t => t.outcome === 'W')
  const losses  = withR.filter(t => t.outcome === 'L')
  const totalR  = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? (wins.length / withR.length * 100) : 0
  const winR    = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR   = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf      = lossR > 0 ? winR / lossR : 0

  const gradeMap = {}
  withR.forEach(t => {
    const g = t.grade || 'No grade'
    if (!gradeMap[g]) gradeMap[g] = { wins: 0, total: 0, r: 0 }
    gradeMap[g].total++; gradeMap[g].r += t.result || 0
    if (t.outcome === 'W') gradeMap[g].wins++
  })
  const gradeData = Object.entries(gradeMap)
    .sort((a, b) => ['A+','A','B','C','No grade'].indexOf(a[0]) - ['A+','A','B','C','No grade'].indexOf(b[0]))
    .map(([g, d]) => ({ grade: g, wr: d.total ? parseFloat((d.wins / d.total * 100).toFixed(1)) : 0, trades: d.total, r: parseFloat(d.r.toFixed(2)) }))

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

  const stratMap = {}
  withR.forEach(t => {
    const s = t.strategy || 'No strategy'
    if (!stratMap[s]) stratMap[s] = { wins: 0, total: 0, r: 0 }
    stratMap[s].total++; stratMap[s].r += t.result || 0
    if (t.outcome === 'W') stratMap[s].wins++
  })
  const stratData = Object.entries(stratMap)
    .map(([s, d]) => ({ strategy: s, wr: parseFloat((d.wins / d.total * 100).toFixed(1)), trades: d.total, r: parseFloat(d.r.toFixed(2)) }))
    .sort((a, b) => b.r - a.r)

  const strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))]

  if (loading) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Analytics" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
      </div>
    </div>
  )

  const widgets = [
    {
      id: 'stats',
      title: 'Statistik',
      span: 2,
      content: (
        <div className="stats-grid">
          <StatCard label="Trades"        value={filtered.length}                                      sub={`${wins.length}V · ${losses.length}F`} />
          <StatCard label="Win Rate"      value={winRate.toFixed(1) + '%'}                             cls={winRate >= 50 ? 'positive' : 'negative'} />
          <StatCard label="Total R"       value={(totalR > 0 ? '+' : '') + totalR.toFixed(2) + 'R'}   cls={totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : ''} />
          <StatCard label="Profit Factor" value={pf.toFixed(2)}                                        cls={pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative'} />
          <StatCard label="Avg Vinst"     value={wins.length ? '+' + (winR / wins.length).toFixed(2) + 'R' : '—'} cls="positive" />
        </div>
      )
    },
    {
      id: 'equity',
      title: 'Equity Curve',
      span: 2,
      content: <EquityCurve trades={filtered} />
    },
    {
      id: 'grade_emotion',
      title: 'Grade & Emotion',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Win Rate per Grade</div></div>
            <div className="card-body">
              {gradeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gradeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="grade" stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
                    <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="wr" name="Win Rate" radius={[4, 4, 0, 0]}>
                      {gradeData.map(e => <Cell key={e.grade} fill={gradeColor(e.grade)} fillOpacity={0.8} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Inga grade-data ännu.</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Win Rate per Emotion</div></div>
            <div className="card-body">
              {emotionData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {emotionData.map(e => (
                    <div key={e.emotion} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 110, fontSize: 12, color: 'var(--text2)' }}>{e.emotion}</div>
                      <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: e.wr + '%', background: e.wr >= 60 ? 'var(--green)' : e.wr >= 40 ? 'var(--amber)' : 'var(--red)', transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ width: 60, fontSize: 12, fontFamily: 'var(--mono)', color: e.wr >= 60 ? 'var(--green)' : e.wr >= 40 ? 'var(--amber)' : 'var(--red)', textAlign: 'right' }}>
                        {e.wr}% <span style={{ color: 'var(--text4)' }}>({e.trades})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>Inga emotion-data ännu.</div>}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'strategy',
      title: 'Strategi-breakdown',
      span: 2,
      content: (
        <div className="card">
          <div className="card-header"><div className="card-title">Strategi-breakdown</div></div>
          {stratData.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="journal-table">
                <thead><tr><th>Strategi</th><th>Trades</th><th>Win Rate</th><th>Total R</th></tr></thead>
                <tbody>
                  {stratData.map(s => (
                    <tr key={s.strategy}>
                      <td style={{ color: 'var(--text)' }}>{s.strategy}</td>
                      <td className="mono">{s.trades}</td>
                      <td className="mono" style={{ color: s.wr >= 50 ? 'var(--green)' : 'var(--red)' }}>{s.wr}%</td>
                      <td className="mono" style={{ color: s.r > 0 ? 'var(--green)' : s.r < 0 ? 'var(--red)' : 'var(--text3)' }}>{s.r > 0 ? '+' : ''}{s.r}R</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="card-body" style={{ color: 'var(--text3)', fontSize: 13 }}>Inga strategi-data ännu.</div>}
        </div>
      )
    },
    {
      id: 'mfe',
      title: 'MFE / MAE',
      span: 2,
      content: <MFESection trades={filtered} />
    },
    {
      id: 'rr',
      title: 'RR-optimerare',
      span: 2,
      content: <RROptimizer trades={filtered} />
    },
    {
      id: 'ai',
      title: 'AI-analys',
      span: 2,
      content: <AIAnalysis trades={filtered} aiEnabled={aiEnabled} />
    },
  ]

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Analytics" />
      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
            value={filter.outcome} onChange={e => setFilter(f => ({ ...f, outcome: e.target.value }))}>
            <option value="">Alla utfall</option>
            <option value="W">Vinster</option>
            <option value="L">Förluster</option>
            <option value="BE">Break Even</option>
          </select>
          <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
            value={filter.direction} onChange={e => setFilter(f => ({ ...f, direction: e.target.value }))}>
            <option value="">Alla riktningar</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
          {strategies.length > 0 && (
            <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
              value={filter.strategy} onChange={e => setFilter(f => ({ ...f, strategy: e.target.value }))}>
              <option value="">Alla strategier</option>
              {strategies.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {(filter.outcome || filter.direction || filter.strategy) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ outcome: '', direction: '', strategy: '' })}>✕ Rensa</button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>{filtered.length} trades</div>
        </div>

        <DragGrid pageKey="analytics" widgets={widgets} />

        {withR.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>
            Inga trades att analysera ännu.
          </div>
        )}
      </div>
    </div>
  )
}
