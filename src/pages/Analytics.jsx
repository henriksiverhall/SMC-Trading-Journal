import { useEffect, useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatR, gradeColor, WORKER_URL, getYahooSymbol, getFuturesSpec } from '../lib/constants'
import { normalizeTrades, calcTradeSize } from '../lib/tradeUtils'
import Topbar from '../components/Topbar'
import DragGrid from '../components/DragGrid'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from 'recharts'

// ── Session-bound MFE/MAE ──────────────────────────────────────────────────────
// MFE/MAE values are pre-computed and read in two ways:
// 1) Already cached on the trade itself (trades.custom_data._mfe/_mae) – the
//    common case once a trade has been processed once.
// 2) On-demand from the Worker's /market-data endpoint, which serves daily-synced
//    5-min bars from Supabase (filled nightly by a Cron Trigger – see
//    tradelog-claude-api-dev). The frontend NEVER calls a market data provider
//    directly; the Worker is the only thing that does, once per day per symbol.
// All excursion math is strictly bounded to entry-time → 16:00 ET the same day,
// so a session's MFE/MAE can never bleed into overnight or next-day movement.

const _barsCache = {}

async function fetchSessionBars(symbol, dateStr) {
  const key = symbol + '_' + dateStr
  if (_barsCache[key]) return _barsCache[key]
  try {
    const url = `${WORKER_URL}/market-data?symbol=${encodeURIComponent(symbol)}&from=${dateStr}&to=${dateStr}`
    const res = await fetch(url)
    const data = await res.json()
    const bars = data?.days?.[0]?.bars || null
    _barsCache[key] = bars
    return bars
  } catch (e) {
    console.warn('Market data fetch failed:', e)
    return null
  }
}

// Session-bound: only bars from entry time through 16:00 the SAME day are used.
async function calcMFE_MAE(trade) {
  if (!trade.entry || !trade.sl || !trade.date || !trade.direction) return null
  const sym = getYahooSymbol(trade.symbol)
  if (!sym) return null

  const bars = await fetchSessionBars(sym, trade.date)
  if (!bars?.length) return null

  const entryTime = trade.time || '09:30'
  const sessionBars = bars.filter(b => b.time >= entryTime && b.time <= '16:00')
  if (!sessionBars.length) return null

  const isLong = trade.direction === 'Long'
  const risk = Math.abs(trade.entry - trade.sl)
  if (risk === 0) return null

  let mfe = 0, mae = 0
  sessionBars.forEach(b => {
    const high = b.high, low = b.low
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
function MFESection({ trades, onFetched }) {
  const [status, setStatus] = useState('idle')
  const [results, setResults] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const candidates = trades.filter(t => t.entry && t.sl && t.date && t.direction)

  useEffect(() => {
    // Always show ALL candidates, using cached MFE where available
    const enriched = candidates.map(t => ({
      ...t,
      _mfe: t.custom_data?._mfe ?? null,
      _mae: t.custom_data?._mae ?? null,
    }))
    setResults(enriched)
    const anyFetched = enriched.filter(t => t._mfe != null)
    if (anyFetched.length > 0) {
      setFetchedAt(anyFetched[0]?.custom_data?._mfe_fetched_at)
      setStatus('partial')
      onFetched?.(enriched)
    }
  }, [trades.length])

  // Manual fallback for trades that don't yet have pre-computed MFE/MAE.
  // Reads from the Worker's cached daily bars (Supabase), not a live provider call,
  // so no rate-limit delay is needed here – only missing if the cron sync hasn't
  // run yet for that symbol/date.
  async function fetchData() {
    const missing = candidates.filter(t => t.custom_data?._mfe == null)
    if (!missing.length) return
    setStatus('loading')
    const now = new Date().toISOString()
    const enriched = [...results]

    for (const t of missing) {
      const sym = getYahooSymbol(t.symbol)
      if (sym) {
        const md = await calcMFE_MAE(t)
        if (md) {
          const updated = { ...(t.custom_data || {}), _mfe: md.mfe, _mae: md.mae, _mfe_fetched_at: now }
          await sb.from('trades').update({ custom_data: updated }).eq('id', t.id)
          const idx = enriched.findIndex(e => e.id === t.id)
          if (idx >= 0) enriched[idx] = { ...t, _mfe: md.mfe, _mae: md.mae, custom_data: updated }
        }
      }
    }

    setResults(enriched)
    setFetchedAt(now)
    setStatus('done')
    onFetched?.(enriched)
  }

  const sortedResults = [...results].sort((a, b) => new Date(b.date) - new Date(a.date))
  const visibleResults = showAll ? sortedResults : sortedResults.slice(0, 10)

  const avgMFE = results.length ? (results.reduce((a, t) => a + (t._mfe || 0), 0) / results.length).toFixed(2) : null
  const avgMAE = results.length ? Math.abs(results.reduce((a, t) => a + (t._mae || 0), 0) / results.length).toFixed(2) : null
  const avgR   = results.filter(t => t.result != null).length
    ? (results.filter(t => t.result != null).reduce((a, t) => a + t.result, 0) / results.filter(t => t.result != null).length).toFixed(2)
    : null
  const leftOnTable = avgMFE != null && avgR != null ? (parseFloat(avgMFE) - parseFloat(avgR)).toFixed(2) : null

  // Capture rate: av den rörelse som faktiskt fanns (MFE), hur stor andel fångade du
  // i resultatet? Ett mått på exit-disciplin snarare än om strategin har edge.
  const captureable = results.filter(t => t._mfe != null && t._mfe > 0 && t.result != null)
  const avgCaptureRate = captureable.length
    ? (captureable.reduce((a, t) => a + Math.min(t.result / t._mfe, 1.5), 0) / captureable.length * 100).toFixed(0)
    : null

  // Bästa missade trade: den med mest R kvar på bordet (störst gap mellan MFE och utfall).
  const bestMissed = results
    .filter(t => t._mfe != null && t.result != null)
    .reduce((best, t) => {
      const gap = t._mfe - t.result
      return (!best || gap > best.gap) ? { ...t, gap } : best
    }, null)

  const missingCount = candidates.filter(t => t.custom_data?._mfe == null).length

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">📐 MFE / MAE – Execution-analys (samma session)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {missingCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={status === 'loading'}>
              {status === 'loading' ? 'Hämtar…' : `▶ Hämta ${missingCount} saknade`}
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: 'var(--text4)', lineHeight: 1.6, marginBottom: 14 }}>
          <strong>MFE</strong> = max gynnsam rörelse i R inom samma handelssession (entry → 16:00) ·{' '}
          <strong>MAE</strong> = max ogynnsam rörelse ·{' '}
          <strong>På bordet</strong> = MFE − faktiskt utfall. Övernattsrörelser räknas aldrig in.
        </p>
        {status === 'loading' && <p style={{ fontSize: 13, color: 'var(--text3)' }}>Hämtar marknadsdata…</p>}
        {status === 'error' && <p style={{ fontSize: 13, color: 'var(--amber)' }}>⚠ Ingen data cachad för detta instrument/datum ännu. Kontrollera att symbolen finns i Workerns instrumentlista och att daglig synk har körts.</p>}
        {results.length > 0 && (
          <>
            <div className="stats-grid" style={{ marginBottom: 8 }}>
              {[
                { label: 'Avg MFE', value: avgMFE != null ? '+' + avgMFE + 'R' : '—', cls: 'positive' },
                { label: 'Avg MAE', value: avgMAE != null ? '-' + avgMAE + 'R' : '—', cls: 'negative' },
                { label: 'Avg Utfall', value: avgR != null ? (parseFloat(avgR) >= 0 ? '+' : '') + avgR + 'R' : '—', cls: parseFloat(avgR) >= 0 ? 'positive' : 'negative' },
                { label: 'Lämnat på bordet', value: leftOnTable != null ? '+' + leftOnTable + 'R' : '—', cls: 'accent' },
                { label: 'Fångad andel', value: avgCaptureRate != null ? avgCaptureRate + '%' : '—', cls: avgCaptureRate >= 50 ? 'positive' : 'negative' },
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text4)', lineHeight: 1.6, marginBottom: 16 }}>
              Du fångar i snitt <strong>{avgCaptureRate}%</strong> av den rörelse som fanns tillgänglig samma session.
              {leftOnTable != null && parseFloat(leftOnTable) > 0 && (
                <> Du lämnar i snitt <strong>{leftOnTable}R</strong> per trade på bordet – {parseFloat(leftOnTable) > parseFloat(avgR || 0) ? 'mer än ditt faktiska snittutfall, vilket pekar på att TP/exit ofta sätts för nära entry snarare än att strategin saknar edge' : 'en del av detta är naturligt eftersom du inte kan tajma exakt topp/botten'}.</>
              )}
              {bestMissed && parseFloat(bestMissed.gap) > 0 && (
                <> Största enskilda missen: <strong>{bestMissed.date}</strong> ({bestMissed.symbol}) där {bestMissed.gap.toFixed(2)}R lämnades på bordet.</>
              )}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="journal-table">
                <thead><tr>
                  <th>Datum</th><th>Symbol</th><th>Dir</th><th>Utfall</th>
                  <th style={{ color: 'var(--green)' }}>MFE</th>
                  <th style={{ color: 'var(--red)' }}>MAE</th>
                  <th style={{ color: 'var(--amber)' }}>På bordet</th>
                </tr></thead>
                <tbody>
                  {visibleResults.map(t => {
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
            {sortedResults.length > 10 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? '▲ Visa färre' : `▼ Visa alla ${sortedResults.length} trades`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── SL Optimizer ──────────────────────────────────────────────────────────────
// Answers: "If I had placed my SL X pts wider, how many losing trades would
// have been saved (MAE was less than the wider SL)? What happens to WR and
// net R when we compensate by adjusting TP to keep the same RR?"
function SLOptimizer({ mfeResults, trades }) {
  const maeMap = {}
  for (const t of (mfeResults || [])) {
    if (t._mae != null) maeMap[t.id] = t._mae   // already in R units (negative)
  }

  // Only trades with MAE data and a known risk (entry + sl)
  const base = trades.filter(t =>
    t.result != null && t.entry != null && t.sl != null && maeMap[t.id] != null
  ).map(t => ({
    ...t,
    _mae: maeMap[t.id],   // R (negative)
    _risk: Math.abs(t.entry - t.sl),   // pts
  })).filter(t => t._risk > 0)

  if (!base.length) return (
    <div className="card">
      <div className="card-header"><div className="card-title">🎯 SL-optimering</div></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          Hämta MAE-data i MFE/MAE-sektionen för att aktivera SL-analysen.
        </p>
      </div>
    </div>
  )

  const losers = base.filter(t => t.outcome === 'L')
  const winners = base.filter(t => t.outcome === 'W')
  const currentWR = base.length ? (winners.length / base.length * 100) : 0
  const currentNetR = base.reduce((a, t) => a + (t.result || 0), 0)

  // Simulate widening SL by X% of current risk (5% → 150% in steps of 5%)
  // A losing trade is "saved" if abs(MAE in R) < (1 + widening) i.e. price never
  // went more than the new wider SL against us. When SL widens, TP must scale
  // proportionally to keep identical RR ratio – so the winner's result grows too.
  const steps = Array.from({ length: 30 }, (_, i) => parseFloat(((i + 1) * 5).toFixed(0)))

  const simRows = steps.map(pct => {
    const factor = 1 + pct / 100   // e.g. 1.20 for +20%
    let savedTrades = 0, newWins = 0, newR = 0
    for (const t of base) {
      const maeAbs = Math.abs(t._mae)   // how far it went against us in R
      if (t.outcome === 'L') {
        if (maeAbs < factor) {
          // Would have been saved – now wins with result = (original TP in R scaled)
          // We don't know original TP in R, so we use the RR target: if original
          // risk = 1R, wider risk = factor*1R, same RR means TP in pts is factor*TP
          // → result is factor * |result_if_win| ≈ factor * avgWinR (conservative).
          // Better: use MFE if available, else proxy with 1R * factor.
          const mfe = mfeResults?.find(m => m.id === t.id)?._mfe ?? null
          const winR = mfe != null ? Math.min(mfe, factor * 2) : factor   // cap at 2× new risk
          newR += winR
          newWins++
          savedTrades++
        } else {
          newR += t.result || 0   // still a loss, but SL is wider so risk is factor
          // result in R stays –1 (we lost 1R regardless of SL width since normalised)
        }
      } else {
        // Winners: TP scaled proportionally with SL → result * factor
        newR += (t.result || 0) * factor
        newWins++
      }
    }
    const newWR = base.length ? (newWins / base.length * 100) : 0
    const netRDelta = newR - currentNetR
    return {
      pct,
      pctLabel: `+${pct}%`,
      saved: savedTrades,
      newWR: parseFloat(newWR.toFixed(1)),
      wrDelta: parseFloat((newWR - currentWR).toFixed(1)),
      newNetR: parseFloat(newR.toFixed(2)),
      netRDelta: parseFloat(netRDelta.toFixed(2)),
    }
  })

  // Best SL widening = largest net R gain
  const best = simRows.reduce((a, b) => b.netRDelta > a.netRDelta ? b : a)
  const breakEven = simRows.find(r => r.netRDelta >= 0)

  // Table: show rows where something improves, cap at 15 rows
  const meaningful = simRows.filter(r => r.saved > 0).slice(0, 15)

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">🎯 SL-optimering – bredda SL = fler vinster?</div></div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: 'var(--text4)', lineHeight: 1.6, marginBottom: 14 }}>
          Simulerar vad som händer om du breddar SL med X% av din nuvarande risk. Förlorade trades
          vars lägsta punkt (MAE) var inom den bredare SL räknas som räddade. TP skalas proportionellt
          så RR-förhållandet behålls. {base.length} trades med MAE-data analyseras.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 16px', border: '1px solid var(--border)' }}>
            <div className="stat-label">Nuvarande WR</div>
            <div className="stat-value" style={{ color: currentWR >= 50 ? 'var(--green)' : 'var(--red)' }}>{currentWR.toFixed(1)}%</div>
            <div className="stat-sub">{winners.length}V / {losers.length}F</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '12px 16px', border: '1px solid var(--border)' }}>
            <div className="stat-label">Nuvarande netto R</div>
            <div className="stat-value" style={{ color: currentNetR >= 0 ? 'var(--green)' : 'var(--red)' }}>{currentNetR > 0 ? '+' : ''}{currentNetR.toFixed(2)}R</div>
          </div>
          <div style={{ background: 'rgba(0,212,170,0.06)', borderRadius: 'var(--r)', padding: '12px 16px', border: '1px solid rgba(0,212,170,0.2)' }}>
            <div className="stat-label">Optimalt SL (netto R)</div>
            <div className="stat-value accent">{best.pctLabel}</div>
            <div className="stat-sub">+{best.netRDelta}R netto · {best.saved} trades räddas</div>
          </div>
        </div>

        {breakEven && breakEven.pct !== simRows[0].pct && (
          <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 14 }}>
            💡 Break-even uppnås vid <strong style={{ color: 'var(--accent)' }}>{breakEven.pctLabel}</strong> bredare SL
            ({breakEven.saved} trades räddas, WR {breakEven.newWR}%).
            {best.pctLabel !== breakEven.pctLabel && <> Optimalt är <strong style={{ color: 'var(--accent)' }}>{best.pctLabel}</strong> med +{best.netRDelta}R netto.</>}
          </div>
        )}

        {meaningful.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Inga förlorade trades inom simuleringsintervallet gick att rädda med bredare SL.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="journal-table">
              <thead><tr>
                <th>SL bredare</th>
                <th>Räddade trades</th>
                <th>Ny WR</th>
                <th>WR-förändring</th>
                <th>Netto R</th>
                <th>R-förändring</th>
              </tr></thead>
              <tbody>
                {meaningful.map(r => (
                  <tr key={r.pct} style={{ background: r.pct === best.pct ? 'rgba(0,212,170,0.05)' : undefined }}>
                    <td className="mono" style={{ fontWeight: r.pct === best.pct ? 700 : 400 }}>{r.pctLabel}</td>
                    <td className="mono">{r.saved}</td>
                    <td className="mono" style={{ color: r.newWR >= 50 ? 'var(--green)' : 'var(--red)' }}>{r.newWR}%</td>
                    <td className="mono" style={{ color: r.wrDelta > 0 ? 'var(--green)' : 'var(--text3)' }}>+{r.wrDelta}%</td>
                    <td className="mono" style={{ color: r.newNetR >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.newNetR > 0 ? '+' : ''}{r.newNetR}R</td>
                    <td className="mono" style={{ color: r.netRDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {r.netRDelta > 0 ? '+' : ''}{r.netRDelta}R
                      {r.pct === best.pct && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓ OPTIMALT</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Psykologisk widget ─────────────────────────────────────────────────────────
// Identifies behavioral patterns from trade data: loss streaks, revenge trading,
// session performance, overtrading, and discipline score.
function PsychWidget({ trades }) {
  const withR = trades.filter(t => t.result != null && t.outcome)
  if (withR.length < 5) return (
    <div className="card">
      <div className="card-header"><div className="card-title">🧠 Psykologisk analys</div></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Logga minst 5 trades för att se psykologisk analys.</p>
      </div>
    </div>
  )

  const chrono = [...withR].sort((a, b) => `${a.date}T${a.time||'00:00'}` < `${b.date}T${b.time||'00:00'}` ? -1 : 1)

  // ── Förlustsvit-analys ──────────────────────────────────────────────────────
  let curLoss = 0, maxLoss = 0
  let streakGroups = []   // { start, end, len, tradesAfter }
  let streakStart = null
  for (let i = 0; i < chrono.length; i++) {
    const t = chrono[i]
    if (t.outcome === 'L') {
      if (curLoss === 0) streakStart = i
      curLoss++
      if (curLoss > maxLoss) maxLoss = curLoss
    } else {
      if (curLoss >= 2) {
        // Check next 3 trades after streak
        const after = chrono.slice(i, i + 3)
        streakGroups.push({ len: curLoss, tradesAfter: after })
      }
      curLoss = 0; streakStart = null
    }
  }
  // ongoing streak
  if (curLoss >= 2) streakGroups.push({ len: curLoss, tradesAfter: [] })

  const avgTradesAfterStreak = streakGroups.length
    ? streakGroups.reduce((a, g) => a + g.tradesAfter.length, 0) / streakGroups.length
    : 0

  // WR i trades direkt efter en förlustsvit (revenge-indikator)
  const tradesAfterStreak = streakGroups.flatMap(g => g.tradesAfter)
  const wrAfterStreak = tradesAfterStreak.length
    ? (tradesAfterStreak.filter(t => t.outcome === 'W').length / tradesAfterStreak.length * 100).toFixed(1)
    : null

  // ── Session-analys ──────────────────────────────────────────────────────────
  const sessionBuckets = { london: { w: 0, t: 0 }, ny: { w: 0, t: 0 }, other: { w: 0, t: 0 } }
  for (const t of withR) {
    if (!t.time) continue
    const [h, m] = t.time.split(':').map(Number)
    const mins = h * 60 + m
    // London: 08:00–13:30 UTC, NY: 13:30–20:00 UTC
    const bucket = mins >= 8*60 && mins < 13*60+30 ? 'london'
      : mins >= 13*60+30 && mins < 20*60 ? 'ny'
      : 'other'
    sessionBuckets[bucket].t++
    if (t.outcome === 'W') sessionBuckets[bucket].w++
  }
  const sessionStats = [
    { label: 'London (08–13:30)', ...sessionBuckets.london },
    { label: 'New York (13:30–20)', ...sessionBuckets.ny },
    { label: 'Övrig tid', ...sessionBuckets.other },
  ].filter(s => s.t > 0).map(s => ({ ...s, wr: parseFloat((s.w / s.t * 100).toFixed(1)) }))

  // ── Emotion-mönster ─────────────────────────────────────────────────────────
  const emotionMap = {}
  for (const t of withR) {
    if (!t.emotion) continue
    if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { w: 0, t: 0 }
    emotionMap[t.emotion].t++
    if (t.outcome === 'W') emotionMap[t.emotion].w++
  }
  const emotionStats = Object.entries(emotionMap)
    .map(([e, d]) => ({ emotion: e, wr: parseFloat((d.w / d.t * 100).toFixed(1)), count: d.t }))
    .sort((a, b) => b.wr - a.wr)

  const badEmotions = emotionStats.filter(e => ['FOMO','Revenge','Overconfident'].includes(e.emotion))
  const disciplinedEmotion = emotionStats.find(e => e.emotion === 'Disciplined')

  // ── Övertradinganalys ───────────────────────────────────────────────────────
  const byDate = {}
  for (const t of withR) {
    if (!t.date) continue
    if (!byDate[t.date]) byDate[t.date] = []
    byDate[t.date].push(t)
  }
  const tradeCounts = Object.values(byDate).map(ts => ts.length)
  const avgPerDay = tradeCounts.length ? (tradeCounts.reduce((a,b)=>a+b,0) / tradeCounts.length).toFixed(1) : 0
  const highDays = Object.entries(byDate).filter(([, ts]) => ts.length >= 4)
  const highDayWR = highDays.length
    ? (highDays.flatMap(([, ts]) => ts).filter(t => t.outcome === 'W').length /
       highDays.flatMap(([, ts]) => ts).length * 100).toFixed(1)
    : null

  // ── Disciplinpoäng (0–100) ──────────────────────────────────────────────────
  let score = 70   // baseline
  if (maxLoss >= 4) score -= 15
  else if (maxLoss >= 3) score -= 8
  if (wrAfterStreak !== null && parseFloat(wrAfterStreak) < 40) score -= 10
  if (disciplinedEmotion && disciplinedEmotion.wr >= 60) score += 10
  if (badEmotions.some(e => e.wr < 40 && e.count >= 3)) score -= 10
  if (highDayWR !== null && parseFloat(highDayWR) < 40) score -= 8
  if (sessionStats.length >= 2) {
    const best = Math.max(...sessionStats.map(s => s.wr))
    const worst = Math.min(...sessionStats.map(s => s.wr))
    if (best - worst > 30) score -= 5
  }
  score = Math.max(0, Math.min(100, score))
  const scoreColor = score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

  // ── Insikter ─────────────────────────────────────────────────────────────────
  const insights = []
  if (maxLoss >= 3) insights.push({
    type: 'warning',
    text: `Längsta förlustsvit: ${maxLoss} i rad. ${maxLoss >= 5 ? 'Det är en signal att pausa och återgå till checklistan.' : 'Håll koll på revengekänslor efter 2+ förluster.'}`
  })
  if (wrAfterStreak !== null && parseFloat(wrAfterStreak) < 45 && streakGroups.length >= 2) insights.push({
    type: 'warning',
    text: `WR direkt efter förlustsvitar: ${wrAfterStreak}%. Lägre än normalt – möjlig revenge-trading. Överväg att ta en paus efter 2 förluster i rad.`
  })
  if (sessionStats.length >= 2) {
    const best = [...sessionStats].sort((a,b) => b.wr - a.wr)[0]
    const worst = [...sessionStats].sort((a,b) => a.wr - b.wr)[0]
    if (best.wr - worst.wr >= 20) insights.push({
      type: 'insight',
      text: `Du handlar markant bättre under ${best.label} (${best.wr}% WR) än ${worst.label} (${worst.wr}% WR). Fokusera på din starka session.`
    })
    if (sessionBuckets.other.t >= 3 && sessionBuckets.other.t > 0) {
      const otherWR = (sessionBuckets.other.w / sessionBuckets.other.t * 100).toFixed(1)
      if (parseFloat(otherWR) < 40) insights.push({
        type: 'warning',
        text: `${sessionBuckets.other.t} trades utanför London/NY-session med ${otherWR}% WR. Handel utanför prime-session verkar inte lönsamt.`
      })
    }
  }
  if (disciplinedEmotion && disciplinedEmotion.wr >= 60 && disciplinedEmotion.count >= 3) insights.push({
    type: 'positive',
    text: `Disciplined-trades: ${disciplinedEmotion.wr}% WR (${disciplinedEmotion.count} trades). Ditt bästa tillstånd – identifiera vad som skapar det och återskapa det.`
  })
  badEmotions.forEach(e => {
    if (e.wr < 45 && e.count >= 2) insights.push({
      type: 'warning',
      text: `${e.emotion}-trades: ${e.wr}% WR (${e.count} trades). Dessa trades kostar dig edge – överväg att skippa dem.`
    })
  })
  if (highDayWR !== null && parseFloat(highDayWR) < 45 && highDays.length >= 2) insights.push({
    type: 'warning',
    text: `${highDays.length} dagar med 4+ trades – WR dessa dagar: ${highDayWR}%. Övertradingmönster möjligt. Snitt ${avgPerDay} trades/dag.`
  })
  if (insights.length === 0) insights.push({
    type: 'positive',
    text: 'Inga tydliga varningssignaler hittades. Fortsätt logga trades för djupare analys.'
  })

  const insightColor = { warning: 'var(--amber)', insight: 'var(--accent)', positive: 'var(--green)' }
  const insightBg = { warning: 'rgba(245,158,11,0.08)', insight: 'rgba(0,212,170,0.06)', positive: 'rgba(34,197,94,0.08)' }
  const insightIcon = { warning: '⚠', insight: '💡', positive: '✓' }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">🧠 Psykologisk analys</div></div>
      <div className="card-body">

        {/* Disciplinpoäng */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, padding: '14px 18px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <div>
            <div className="stat-label" style={{ marginBottom: 4 }}>Disciplinpoäng</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>av 100</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: score + '%', background: scoreColor, borderRadius: 4, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {score >= 70 ? 'Bra disciplin. Håll kvar vid planen.' : score >= 50 ? 'Godkänd nivå men förbättringspotential finns.' : 'Varningsnivå – genomgå mönstren nedan noggrant.'}
            </div>
          </div>
        </div>

        {/* Insikter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 'var(--r)',
              background: insightBg[ins.type],
              border: `1px solid ${insightColor[ins.type]}33`,
              display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <span style={{ color: insightColor[ins.type], fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{insightIcon[ins.type]}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{ins.text}</span>
            </div>
          ))}
        </div>

        {/* Session-breakdown */}
        {sessionStats.length >= 2 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>WR per session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessionStats.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 160, fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
                  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: s.wr + '%', background: s.wr >= 50 ? 'var(--green)' : s.wr >= 40 ? 'var(--amber)' : 'var(--red)', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 80, fontSize: 12, fontFamily: 'var(--mono)', textAlign: 'right', color: s.wr >= 50 ? 'var(--green)' : s.wr >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                    {s.wr}% <span style={{ color: 'var(--text4)' }}>({s.t})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streak-info */}
        {streakGroups.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            {streakGroups.length} förlustsvit{streakGroups.length > 1 ? 'ar' : ''} (≥2 i rad) · Längst: {maxLoss}
            {wrAfterStreak !== null && <> · WR direkt efter svit: <span style={{ color: parseFloat(wrAfterStreak) < 45 ? 'var(--amber)' : 'var(--text)' }}>{wrAfterStreak}%</span></>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── RR Optimizer ──────────────────────────────────────────────────────────────
// Answers: "Given how far price actually moved (MFE) within the same session
// on every logged trade, what take-profit distance (in R) would have produced
// the best expectancy?" This is a target-placement question, separate from
// whether the entries/strategy itself has edge.
function RROptimizer({ mfeResults, trades }) {
  const buildDataset = () => {
    const mfeMap = {}
    for (const t of (mfeResults || [])) {
      if (t._mfe != null) mfeMap[t.id] = t._mfe
    }
    const base = trades.filter(t => t.result != null && t.entry && t.sl)
    return base.map(t => {
      if (mfeMap[t.id] != null) return { ...t, _mfe: mfeMap[t.id], _src: 'real' }
      // Fallback only for trades genuinely missing session MFE data:
      // a win proves price reached at least result R (honest lower bound).
      if (t.outcome === 'W' && t.result > 0) return { ...t, _mfe: t.result, _src: 'proxy_win' }
      return { ...t, _mfe: null, _src: 'unknown' }
    })
  }

  const dataset = buildDataset()
  const valid = dataset.filter(t => t._mfe != null)
  const missingMfeCount = dataset.length - valid.length

  if (!valid.length) return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">📊 RR-optimerare</div></div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>Logga trades med entry, SL och utfall för att se RR-analys.</p>
      </div>
    </div>
  )

  const hasAnyProxy = dataset.some(t => t._src === 'proxy_win')
  // 0.1R-steg från 0.5 till 6.0 – finare granularitet för psykologisk optimering
  const rrLevels = Array.from({ length: 56 }, (_, i) => parseFloat((0.5 + i * 0.1).toFixed(1)))

  const winningTrades = valid.filter(t => t.outcome === 'W')
  const currentAvgRR = winningTrades.length
    ? parseFloat((winningTrades.reduce((a, t) => a + (t.result || 0), 0) / winningTrades.length).toFixed(2))
    : 0

  // For each candidate TP level, simulate: would this trade have won (MFE >= rr)
  // or lost (stopped out before reaching rr)? Expectancy uses a fixed 1R stop,
  // matching how every trade in the journal is risk-normalized.
  const simData = rrLevels.map(rr => {
    const wins = valid.filter(t => t._mfe >= rr)
    const wr = wins.length / valid.length
    const expectancy = parseFloat((wr * rr - (1 - wr) * 1).toFixed(3))
    return {
      rr: rr + 'R',
      rrVal: rr,
      'Win Rate': parseFloat((wr * 100).toFixed(1)),
      Expectancy: expectancy,
      wins: wins.length,
      total: valid.length,
    }
  })

  const best    = simData.reduce((a, b) => b.Expectancy > a.Expectancy ? b : a)
  const current = simData.reduce((a, b) =>
    Math.abs(b.rrVal - currentAvgRR) < Math.abs(a.rrVal - currentAvgRR) ? b : a
  )
  const actualWR = valid.length ? (winningTrades.length / valid.length * 100).toFixed(1) : 0

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">📊 RR-optimerare</div></div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: 'var(--text4)', lineHeight: 1.6, marginBottom: 14 }}>
          Simulerar vad som hänt om du tagit ett annat TP-mål på alla {valid.length} trades, baserat på hur
          långt priset faktiskt rörde sig i din favör (MFE) samma session. Visar om dagens {currentAvgRR > 0 ? currentAvgRR + 'R-mål' : 'mål'} är
          för aggressivt, för konservativt, eller redan nära optimalt.
        </p>
        {hasAnyProxy && (
          <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            ⚠ {missingMfeCount > 0 ? `${missingMfeCount} trades saknar MFE-data och exkluderas. ` : ''}
            Vissa vinster saknar exakt MFE och räknas konservativt som "nådde precis sitt resultat" – hämta data i sektionen ovan för exakthet.
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, padding: '10px 14px', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r)', lineHeight: 1.6 }}>
          Optimalt TP är <strong style={{ color: 'var(--accent)' }}>{best.rr}</strong>{' '}
          (expectancy {best.Expectancy > 0 ? '+' : ''}{best.Expectancy}R/trade vid simulerad WR {best['Win Rate']}%).
          Ditt nuvarande snittmål: ~{currentAvgRR}R (faktisk WR {actualWR}%).
          {best.rrVal !== current.rrVal && (
            <> {best.rrVal > currentAvgRR
              ? ` Historiskt fanns ofta mer rörelse kvar – pröva att flytta TP till ${best.rr}.`
              : ` Du tar ofta ut mer risk än nödvändigt – ${best.rr} hade gett bättre expectancy med högre träffsäkerhet.`}</>
          )}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={simData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="rr" stroke="var(--text4)" tick={{ fontSize: 10, fill: 'var(--text4)' }} />
            <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--border2)" />
            <Bar dataKey="Expectancy" name="Expectancy" radius={[4, 4, 0, 0]}>
              {simData.map(d => (
                <Cell key={d.rr}
                  fill={d.rr === best.rr ? 'var(--accent)' : d.Expectancy > 0 ? 'var(--green)' : 'var(--red)'}
                  fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="journal-table">
            <thead><tr>
              <th>TP-nivå</th><th>Trades som nådde dit</th><th>Simulerad WR</th><th>Expectancy/trade</th><th></th>
            </tr></thead>
            <tbody>
              {simData.map(d => (
                <tr key={d.rr} style={{ background: d.rr === best.rr ? 'rgba(0,212,170,0.05)' : undefined }}>
                  <td className="mono" style={{ fontWeight: d.rr === best.rr ? 700 : 400 }}>{d.rr}</td>
                  <td className="mono">{d.wins}/{d.total}</td>
                  <td className="mono" style={{ color: d['Win Rate'] >= 50 ? 'var(--green)' : 'var(--red)' }}>{d['Win Rate']}%</td>
                  <td className="mono" style={{ color: d.Expectancy > 0 ? 'var(--green)' : 'var(--red)' }}>
                    {d.Expectancy > 0 ? '+' : ''}{d.Expectancy}R
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {d.rr === best.rr && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✓ OPTIMALT</span>}
                    {d.rrVal === currentAvgRR && d.rr !== best.rr && <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 600 }}>← nuvarande mål</span>}
                  </td>
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
  const { userSettings, saveSettings } = useAuth()
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [generatedAt, setGeneratedAt] = useState(null)
  const [expandedHistory, setExpandedHistory] = useState(new Set())
  const loadedRef = useRef(false)

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

  // Fingerprint of the data the analysis is actually based on. Changes if a trade
  // is added/removed, or if an existing trade's outcome/result is edited.
  const fingerprint = withR.map(t => `${t.id}:${t.result}`).sort().join('|')

  // Hydrate from userSettings once, on first load - don't keep re-syncing after
  // that so we don't clobber a result the user just generated this session.
  useEffect(() => {
    if (loadedRef.current) return
    const saved = userSettings?.aiAnalysis
    if (saved?.text) {
      setResponse(saved.text)
      setHistory(saved.history || [])
      setGeneratedAt(saved.generatedAt || null)
    }
    if (userSettings !== undefined) loadedRef.current = true
  }, [userSettings])

  const isCurrent = !!response && userSettings?.aiAnalysis?.fingerprint === fingerprint

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
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        })
      })
      const rawText = await res.text()
      if (!res.ok) {
        setResponse(`Kunde inte ansluta till AI-tjänsten (HTTP ${res.status}): ${rawText.slice(0, 200)}`)
        setLoading(false)
        return
      }
      const data = JSON.parse(rawText)
      if (data.error) {
        setResponse(`AI-tjänsten svarade med fel: ${data.error.message || JSON.stringify(data.error)}`)
        setLoading(false)
        return
      }
      const text = data.content?.find(c => c.type === 'text')?.text || 'Inget svar.'
      const now = new Date().toISOString()
      const newHistory = [{ date: new Date().toLocaleDateString('sv-SE'), text }, ...history.slice(0, 4)]
      setResponse(text)
      setHistory(newHistory)
      setGeneratedAt(now)
      saveSettings({ aiAnalysis: { text, history: newHistory, fingerprint, generatedAt: now } })
    } catch (err) {
      setResponse(`Kunde inte ansluta till AI-tjänsten: ${err.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div className="card-title">🤖 AI-analys</div>
        <button className="btn btn-ghost btn-sm" onClick={analyze} disabled={loading || !withR.length || isCurrent}>
          {loading ? 'Analyserar…' : isCurrent ? '✓ Aktuell' : response ? '✨ Uppdatera analys' : '✨ Analysera'}
        </button>
      </div>
      <div className="card-body">
        {!response && !loading && (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Klicka "Analysera" för att få AI-baserade råd om din trading baserat på aktuell statistik.</p>
        )}
        {loading && <p style={{ fontSize: 13, color: 'var(--text3)' }}>Analyserar dina trades…</p>}
        {response && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              {response}
            </div>
            {generatedAt && (
              <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 8 }}>
                Senast analyserad: {new Date(generatedAt).toLocaleString('sv-SE')}
                {!isCurrent && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>Ny data tillgänglig sedan dess</span>}
              </div>
            )}
          </>
        )}
        {history.length > 1 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Historik</div>
            {history.slice(1).map((h, i) => {
              const isOpen = expandedHistory.has(i)
              return (
                <div key={i} style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }}
                  onClick={() => setExpandedHistory(prev => {
                    const next = new Set(prev)
                    next.has(i) ? next.delete(i) : next.add(i)
                    return next
                  })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{h.date}</span>
                    <span style={{ fontSize: 11, color: 'var(--text4)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 8 }}>{h.text}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Analytics ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user, aiEnabled, userSettings } = useAuth()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ outcome: '', direction: '', strategy: '' })
  const [mfeResults, setMfeResults] = useState([])

  // Kontoinställningar – laborterbara live
  const [accountSize, setAccountSize] = useState(50000)
  const [riskPct, setRiskPct] = useState(1.0)
  const [showDollar, setShowDollar] = useState(false)

  // Hydrate från userSettings om account_size/risk_pct sparats i Journal
  useEffect(() => {
    const t = trades.find(t => t.account_size || t.risk_pct)
    if (!t && userSettings) {
      if (userSettings.account_size) setAccountSize(Number(userSettings.account_size))
      if (userSettings.risk_pct) setRiskPct(Number(userSettings.risk_pct))
    }
  }, [userSettings, trades])

  useEffect(() => {
    if (!user) return
    sb.from('trades').select('*').eq('user_id', user.id).order('date', { ascending: false })
      .then(({ data }) => { setTrades(normalizeTrades(data || [])); setLoading(false) })
  }, [user])

  const filtered = trades.filter(t => {
    if (filter.outcome && t.outcome !== filter.outcome) return false
    if (filter.direction && t.direction !== filter.direction) return false
    if (filter.strategy && t.strategy !== filter.strategy) return false
    return true
  })

  // Dollar-berikade trades – beräknas live från kontoinställningarna
  const filteredWithDollar = filtered.map(t => {
    const sizing = calcTradeSize(t, accountSize, riskPct, getFuturesSpec)
    return { ...t, _sizing: sizing }
  })
  const hasDollarData = filteredWithDollar.some(t => t._sizing != null)
  const totalDollar = filteredWithDollar.reduce((a, t) => a + (t._sizing?.dollarPnl || 0), 0)
  const maxDDDollar = (() => {
    const chrono = [...filteredWithDollar]
      .filter(t => t._sizing?.dollarPnl != null)
      .sort((a, b) => `${a.date}T${a.time||'00:00'}` < `${b.date}T${b.time||'00:00'}` ? -1 : 1)
    let equity = 0, peak = 0, worst = 0
    for (const t of chrono) {
      equity += t._sizing.dollarPnl
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > worst) worst = dd
    }
    return worst
  })()

  const withR   = filtered.filter(t => t.result != null)
  const wins    = withR.filter(t => t.outcome === 'W')
  const losses  = withR.filter(t => t.outcome === 'L')
  const totalR  = withR.reduce((a, t) => a + (t.result || 0), 0)
  const winRate = withR.length ? (wins.length / withR.length * 100) : 0
  const winR    = wins.reduce((a, t) => a + (t.result || 0), 0)
  const lossR   = Math.abs(losses.reduce((a, t) => a + (t.result || 0), 0))
  const pf      = lossR > 0 ? winR / lossR : 0

  // Max Drawdown: largest peak-to-trough fall in cumulative R, regardless of how
  // many trades it takes to claw back to a new equity high. Needs strict
  // chronological order (oldest first) - the trades list itself is fetched
  // newest-first for display, so this re-sorts a copy rather than relying on it.
  const maxDD = (() => {
    const chrono = [...withR].sort((a, b) => {
      const da = `${a.date}T${a.time || '00:00'}`
      const db = `${b.date}T${b.time || '00:00'}`
      return da < db ? -1 : da > db ? 1 : 0
    })
    let equity = 0, peak = 0, worst = 0
    for (const t of chrono) {
      equity += t.result || 0
      if (equity > peak) peak = equity
      const dd = peak - equity
      if (dd > worst) worst = dd
    }
    return worst
  })()

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
        <div>
          <div className="stats-grid">
            <StatCard label="Trades"        value={filtered.length}                                      sub={`${wins.length}V · ${losses.length}F`} />
            <StatCard label="Win Rate"      value={winRate.toFixed(1) + '%'}                             cls={winRate >= 50 ? 'positive' : 'negative'} />
            <StatCard label="Total R"       value={(totalR > 0 ? '+' : '') + totalR.toFixed(2) + 'R'}   cls={totalR > 0 ? 'positive' : totalR < 0 ? 'negative' : ''} />
            <StatCard label="Profit Factor" value={pf.toFixed(2)}                                        cls={pf >= 1.5 ? 'accent' : pf >= 1 ? 'positive' : 'negative'} />
            <StatCard label="Max DD"        value={maxDD > 0 ? '-' + maxDD.toFixed(2) + 'R' : '0.00R'}  cls={maxDD > 0 ? 'negative' : ''} />
            <StatCard label="Avg Vinst"     value={wins.length ? '+' + (winR / wins.length).toFixed(2) + 'R' : '—'} cls="positive" />
            {(() => {
              const avgW = wins.length ? winR / wins.length : 0
              const avgL = losses.length ? Math.abs(lossR) / losses.length : 0
              const exp = wins.length && losses.length ? parseFloat((winRate/100 * avgW - (1 - winRate/100) * avgL).toFixed(3)) : null
              const rf = maxDD > 0 ? parseFloat((totalR / maxDD).toFixed(2)) : null
              const longestWin = (() => { let cur=0,max=0; for(const t of [...withR].sort((a,b)=>a.date>b.date?1:-1)){ if(t.outcome==='W'){cur++;if(cur>max)max=cur}else cur=0} return max })()
              const longestLoss = (() => { let cur=0,max=0; for(const t of [...withR].sort((a,b)=>a.date>b.date?1:-1)){ if(t.outcome==='L'){cur++;if(cur>max)max=cur}else cur=0} return max })()
              return (<>
                <StatCard label="Expectancy" value={exp != null ? (exp>0?'+':'')+exp+'R' : '—'} cls={exp>0?'positive':exp<0?'negative':''} />
                <StatCard label="Recovery Factor" value={rf ?? '—'} cls={rf>=2?'positive':rf<1?'negative':''} />
                <StatCard label="Längsta svit" value={longestWin>0?`${longestWin}V / ${longestLoss}F`:'—'} />
              </>)
            })()}
          </div>
          {showDollar && hasDollarData && (() => {
            const winDollar = filteredWithDollar.filter(t => t.outcome === 'W').reduce((a, t) => a + (t._sizing?.dollarPnl || 0), 0)
            const lossDollar = filteredWithDollar.filter(t => t.outcome === 'L').reduce((a, t) => a + (t._sizing?.dollarPnl || 0), 0)
            const avgContracts = parseFloat((filteredWithDollar.filter(t => t._sizing).reduce((a, t) => a + t._sizing.contracts, 0) / filteredWithDollar.filter(t => t._sizing).length).toFixed(1))
            const fmt = v => (v >= 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('sv-SE', { maximumFractionDigits: 0 })
            return (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 0 8px', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  Dollar ({accountSize.toLocaleString('sv-SE')} USD konto · {riskPct}% risk)
                </div>
                <div className="stats-grid">
                  <StatCard label="Netto $"    value={fmt(totalDollar)}                 cls={totalDollar >= 0 ? 'positive' : 'negative'} />
                  <StatCard label="Vinster $"  value={fmt(winDollar)}                   cls="positive" />
                  <StatCard label="Förluster $" value={fmt(lossDollar)}                 cls="negative" />
                  <StatCard label="Max DD $"   value={maxDDDollar > 0 ? '-$' + maxDDDollar.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) : '$0'} cls={maxDDDollar > 0 ? 'negative' : ''} />
                  <StatCard label="Max DD %"   value={maxDDDollar > 0 ? '-' + (maxDDDollar / accountSize * 100).toFixed(1) + '%' : '0%'} cls={maxDDDollar > 0 ? 'negative' : ''} />
                  <StatCard label="Snitt ktr"  value={isNaN(avgContracts) ? '—' : avgContracts + ' ktr'} />
                </div>
              </div>
            )
          })()}
        </div>
      )
    },
    {
      id: 'equity',
      title: 'Equity Curve',
      span: 2,
      content: (
        <div>
          <EquityCurve trades={filtered} />
          {showDollar && hasDollarData && (() => {
            const chrono = [...filteredWithDollar]
              .filter(t => t._sizing?.dollarPnl != null)
              .sort((a, b) => `${a.date}T${a.time||'00:00'}` < `${b.date}T${b.time||'00:00'}` ? -1 : 1)
            let cumDollar = accountSize
            const dollarData = chrono.map(t => {
              cumDollar += t._sizing.dollarPnl
              return { date: t.date, dollar: parseFloat(cumDollar.toFixed(0)) }
            })
            const isPos = dollarData.length > 0 && dollarData[dollarData.length - 1].dollar >= accountSize
            return (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <div className="card-title">Equity Curve ($) – startar ${accountSize.toLocaleString('sv-SE')}</div>
                </div>
                <div className="card-body" style={{ paddingTop: 8 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dollarData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text4)" tick={{ fontSize: 10, fill: 'var(--text4)' }} tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
                      <YAxis stroke="var(--text4)" tick={{ fontSize: 11, fill: 'var(--text4)' }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                      <Tooltip formatter={(v) => ['$' + v.toLocaleString('sv-SE'), 'Kontobalans']} labelFormatter={l => l} />
                      <ReferenceLine y={accountSize} stroke="var(--border2)" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="dollar" name="Balans" stroke={isPos ? 'var(--green)' : 'var(--red)'} dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })()}
        </div>
      )
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
      content: <MFESection trades={filtered} onFetched={setMfeResults} />
    },
    {
      id: 'sl_opt',
      title: 'SL-optimering',
      span: 2,
      content: <SLOptimizer mfeResults={mfeResults} trades={filtered} />
    },
    {
      id: 'psych',
      title: 'Psykologisk analys',
      span: 2,
      content: <PsychWidget trades={filtered} />
    },
    {
      id: 'weekday',
      title: 'Win Rate per veckodag',
      span: 2,
      content: (() => {
        const DAYS = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag']
        const byDay = {}
        for (const t of filtered) {
          if (!t.date || !t.outcome) continue
          const d = new Date(t.date + 'T12:00:00').getDay()
          if (!byDay[d]) byDay[d] = { wins: 0, total: 0 }
          if (['W','L','BE'].includes(t.outcome)) {
            byDay[d].total++
            if (t.outcome === 'W') byDay[d].wins++
          }
        }
        const dayData = [1,2,3,4,5].map(d => ({
          day: DAYS[d].slice(0,3),
          fullDay: DAYS[d],
          wr: byDay[d]?.total ? parseFloat((byDay[d].wins / byDay[d].total * 100).toFixed(1)) : null,
          trades: byDay[d]?.total || 0,
          wins: byDay[d]?.wins || 0,
        }))
        const hasData = dayData.some(d => d.trades > 0)
        const maxWR = Math.max(...dayData.map(d => d.wr || 0))
        const minWR = Math.min(...dayData.filter(d => d.wr !== null).map(d => d.wr))
        return (
          <div className="card">
            <div className="card-header"><div className="card-title">📅 Win Rate per veckodag</div></div>
            <div className="card-body">
              {!hasData ? (
                <div style={{ color: 'var(--text4)', fontSize: 13 }}>Inga trades med datum att analysera ännu.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
                    {dayData.map(d => {
                      const isBest = d.wr === maxWR && d.wr !== null && maxWR > 0
                      const isWorst = d.wr === minWR && d.wr !== null && dayData.filter(x => x.wr !== null).length > 1
                      const color = d.wr >= 50 ? 'var(--green)' : d.wr !== null ? 'var(--red)' : 'var(--text4)'
                      return (
                        <div key={d.day} style={{
                          textAlign: 'center', padding: '14px 8px',
                          background: isBest ? 'rgba(16,185,129,0.1)' : isWorst ? 'rgba(239,68,68,0.08)' : 'var(--bg3)',
                          borderRadius: 'var(--r)', border: `1px solid ${isBest ? 'rgba(16,185,129,0.25)' : isWorst ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6, fontWeight: 600 }}>{d.fullDay}</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color }}>
                            {d.wr !== null ? d.wr + '%' : '—'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                            {d.wins}V / {d.trades - d.wins}F · {d.trades}st
                          </div>
                          {isBest && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4 }}>✓ Bäst</div>}
                          {isWorst && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>↓ Sämst</div>}
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const best = dayData.filter(d => d.wr !== null).sort((a,b) => b.wr - a.wr)[0]
                    const worst = dayData.filter(d => d.wr !== null).sort((a,b) => a.wr - b.wr)[0]
                    if (!best || best === worst) return null
                    return (
                      <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
                        💡 Du handlar bäst på <strong style={{ color: 'var(--green)' }}>{best.fullDay}</strong> ({best.wr}% WR) och sämst på <strong style={{ color: 'var(--red)' }}>{worst.fullDay}</strong> ({worst.wr}% WR). {worst.wr < 40 ? `Överväg att undvika ${worst.fullDay}.` : ''}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        )
      })()
    },
    {
      id: 'rr',
      title: 'RR-optimerare',
      span: 2,
      content: <RROptimizer mfeResults={mfeResults} trades={filtered} />
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
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

        {/* Kontoinstillningar – laborterbara live */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap',
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>💰 Kontosimulator</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Konto</label>
            <input type="number" step="1000" min="1000"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '4px 8px', fontSize: 12, width: 100, fontFamily: 'var(--font)' }}
              value={accountSize} onChange={e => setAccountSize(Number(e.target.value))} />
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>USD</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)' }}>Risk/trade</label>
            <input type="number" step="0.1" min="0.1" max="5"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '4px 8px', fontSize: 12, width: 60, fontFamily: 'var(--font)' }}
              value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} />
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>%</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text4)' }}>= ${(accountSize * riskPct / 100).toFixed(0)}/trade</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Visa i $</span>
            <button onClick={() => setShowDollar(d => !d)}
              style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                background: showDollar ? 'var(--accent)' : 'var(--border2)', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: showDollar ? 18 : 2, width: 16, height: 16,
                borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
            </button>
          </div>
          {!hasDollarData && showDollar && (
            <span style={{ fontSize: 11, color: 'var(--red)' }}>Trades saknar entry/sl/symbol – kan ej beräkna kontrakt</span>
          )}
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
