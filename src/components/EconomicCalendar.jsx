import { useEffect, useState, useCallback } from 'react'
import { WORKER_URL } from '../lib/constants'

const ALL_CURRENCIES = ['USD','EUR','GBP','JPY','CAD','AUD','NZD','CHF']
const DEFAULT_CURRENCIES = ['USD','EUR','GBP']
const IMPACT_ORDER = { High: 0, Medium: 1, Low: 2, Holiday: 3 }

const IMPACT_STYLE = {
  High:    { color: '#ef4444', label: '🔴', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  Medium:  { color: '#f59e0b', label: '🟠', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  Low:     { color: '#6b7280', label: '🟡', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
  Holiday: { color: 'var(--text4)', label: '📅', bg: 'transparent', border: 'transparent' },
}

function impactDot(impact) {
  const s = IMPACT_STYLE[impact] || IMPACT_STYLE.Low
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, marginRight: 4 }} />
}

function fmtDayHeader(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtTime(dateStr) {
  if (!dateStr) return 'Hela dagen'
  return new Date(dateStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(events) {
  const map = {}
  for (const e of events) {
    const day = e.date.split('T')[0]
    if (!map[day]) map[day] = []
    map[day].push(e)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

export default function EconomicCalendar() {
  const [events, setEvents]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [impacts, setImpacts]       = useState(['High', 'Medium'])
  const [currencies, setCurrencies] = useState(DEFAULT_CURRENCIES)
  const [showOnlyToday, setShowOnlyToday] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${WORKER_URL}/calendar?week=thisweek`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEvents(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().split('T')[0]
  const filtered = events.filter(e => {
    const day = e.date?.split('T')[0]
    if (showOnlyToday && day !== today) return false
    if (!impacts.includes(e.impact)) return false
    if (!currencies.includes(e.country)) return false
    return true
  })

  const grouped = groupByDay(filtered)

  function toggleImpact(imp) {
    setImpacts(prev => prev.includes(imp) ? prev.filter(x => x !== imp) : [...prev, imp])
  }
  function toggleCurrency(cur) {
    setCurrencies(prev => prev.includes(cur) ? prev.filter(x => x !== cur) : [...prev, cur])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Filterrad */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 0 12px', borderBottom: '1px solid var(--border)' }}>

        {/* Idag / Hela veckan */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowOnlyToday(false)} className={`btn btn-sm ${!showOnlyToday ? 'btn-primary' : 'btn-ghost'}`}>Denna vecka</button>
          <button onClick={() => setShowOnlyToday(true)}  className={`btn btn-sm ${showOnlyToday  ? 'btn-primary' : 'btn-ghost'}`}>Idag</button>
          <button onClick={load} className="btn btn-sm btn-ghost" title="Ladda om">↻</button>
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Impact */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Impact:</span>
          {['High', 'Medium', 'Low'].map(imp => {
            const s = IMPACT_STYLE[imp]
            const active = impacts.includes(imp)
            return (
              <button key={imp} onClick={() => toggleImpact(imp)} style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, cursor: 'pointer',
                background: active ? s.bg : 'transparent',
                color: active ? s.color : 'var(--text4)',
                border: `1px solid ${active ? s.border : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}>{s.label} {imp}</button>
            )
          })}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        {/* Valuta */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Valuta:</span>
          {ALL_CURRENCIES.map(cur => {
            const active = currencies.includes(cur)
            return (
              <button key={cur} onClick={() => toggleCurrency(cur)} style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text4)',
                border: `1px solid ${active ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}>{cur}</button>
            )
          })}
        </div>
      </div>

      {/* Innehåll */}
      {loading && <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar kalender…</div>}
      {error   && <div style={{ padding: '16px 0', color: 'var(--red)', fontSize: 13 }}>⚠️ {error}</div>}
      {!loading && !error && grouped.length === 0 && <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>Inga händelser matchar filtret.</div>}

      {!loading && !error && grouped.map(([day, dayEvents]) => {
        const isToday = day === today
        const sorted = [...dayEvents].sort((a, b) => {
          const ia = IMPACT_ORDER[a.impact] ?? 9
          const ib = IMPACT_ORDER[b.impact] ?? 9
          if (ia !== ib) return ia - ib
          return (a.date || '').localeCompare(b.date || '')
        })
        return (
          <div key={day}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 6px', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--text2)', textTransform: 'capitalize', letterSpacing: 0.3 }}>{fmtDayHeader(day)}</span>
              {isToday && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'rgba(0,212,170,0.15)', color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.3)', letterSpacing: 0.5 }}>IDAG</span>}
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 10, color: 'var(--text4)' }}>{sorted.length} händelser</span>
            </div>
            {sorted.map((ev, i) => {
              const imp = IMPACT_STYLE[ev.impact] || IMPACT_STYLE.Low
              const hasActual   = ev.actual   && ev.actual   !== ''
              const hasForecast = ev.forecast && ev.forecast !== ''
              const hasPrev     = ev.previous && ev.previous !== ''
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 40px 1fr auto', gap: '0 10px', alignItems: 'center', padding: '7px 8px', marginBottom: 2, borderRadius: 6, background: hasActual ? imp.bg : 'transparent', border: hasActual ? `1px solid ${imp.border}` : '1px solid transparent', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!hasActual) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseLeave={e => { if (!hasActual) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtTime(ev.date)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>{impactDot(ev.impact)}<span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)' }}>{ev.country}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: ev.impact === 'High' ? 600 : 400, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{ev.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {hasActual   && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: imp.color, minWidth: 48, textAlign: 'right' }}>{ev.actual}</span>}
                    {hasForecast && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', minWidth: 40, textAlign: 'right' }}>↗ {ev.forecast}</span>}
                    {hasPrev     && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text4)', minWidth: 40, textAlign: 'right' }}>prev {ev.previous}</span>}
                    {!hasActual && !hasForecast && !hasPrev && <span style={{ fontSize: 10, color: 'var(--text4)', minWidth: 100 }}>—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
