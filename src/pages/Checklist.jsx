import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

// Same default content as prod's DEFAULT_STRATEGIES, used only as a fallback
// seed if a user somehow has no checklist rows yet (the existing dev users
// already have these seeded in the `checklists` table).
const DEFAULT_STRATEGIES = [
  { key: 'unicorn', name: 'ICT Unicorn Model', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: 'Ingen red folder news inom 2h?', blocker: true, stop: 'Red folder news → NO TRADE', journal: false },
      { id: 'p2', label: 'Dag i veckan', sub: 'Fredag? → Halvrisken eller skippa', blocker: false, stop: '', journal: false },
      { id: 'p3', label: 'Klockan 9:30–13:00 ET', sub: 'Handelsfönstret är öppet', blocker: true, stop: 'Utanför window → NO TRADE', journal: false },
    ] },
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Draw on Liquidity (DOL) identifierad', sub: 'Tydliga relativa equal highs (EQH) eller equal lows (EQL)?', blocker: true, stop: 'Inga EQH/EQL → hoppa', journal: true },
      { id: 's2', label: 'Handelsriktning bestämd', sub: 'DOL ovan pris = Long. DOL under pris = Short.', blocker: false, stop: '', journal: false },
      { id: 's3', label: 'Manipulation Leg sedd', sub: 'Impulsiv rörelse bort från DOL (1–3 candles)', blocker: true, stop: 'Utdragen/choppy = lägre sannolikhet', journal: false },
      { id: 's4', label: 'Breaker identifierad', sub: 'Bullish: sista gröna BEFORE lower low. Bearish: sista röda BEFORE higher high.', blocker: true, stop: 'Ej tydlig Breaker → inget setup', journal: true },
      { id: 's5', label: 'Fair Value Gap (FVG) identifierad', sub: '3-candle, icke-överlappande wicks', blocker: true, stop: 'Ingen FVG → inget setup', journal: true },
      { id: 's6', label: '⚑ OVERLAP: Breaker + FVG överlappar', sub: 'Det överlappande området är entry-zonen. KRITISK.', blocker: true, stop: 'INGET overlap = INGET Unicorn → STOP', journal: true },
      { id: 's7', label: 'TP beräknad ≥ 2R', sub: 'Fib på manipulation leg. 2 STDV = primär TP.', blocker: true, stop: 'RR < 2R → NO TRADE', journal: false },
    ] },
    { id: 'entry', title: 'Entry & Execution', color: '#059669', items: [
      { id: 'e1', label: 'TP ej redan träffad', sub: 'Om priset kört till TP utan retest → cancel', blocker: true, stop: 'TP träffad = cancel order', journal: false },
      { id: 'e2', label: 'Limit order satt', sub: 'Entry vid topp av overlap-zon (long) / botten (short)', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'Stop Loss satt', sub: 'Body high/low av manipulation leg', blocker: false, stop: '', journal: false },
      { id: 'e4', label: 'Take Profit satt', sub: '2 STDV (primär) eller DOL (sekundär)', blocker: false, stop: '', journal: false },
    ] },
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Låt traden spela ut', sub: 'Inga manuella justeringar', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Invaliderings-check', sub: 'Stänger priset IGENOM hela zonen utan rekyl → cancel', blocker: false, stop: '', journal: false },
      { id: 'm3', label: 'Journalföring klar', sub: 'Datum, riktning, entry/SL/TP, utfall, R, grade', blocker: false, stop: '', journal: false },
    ] },
  ] },
  { key: 'globex', name: "Bernd's Globex Strategy", phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'Red folder → NO TRADE', journal: false },
      { id: 'p2', label: 'NY session öppen (9:30+)', sub: '', blocker: true, stop: 'Ej NY session → vänta', journal: false },
    ] },
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Globex High & Low markerade', sub: 'H/L från ETH 18:00–09:30 ET', blocker: true, stop: 'Ej markerade = ej valid', journal: false },
      { id: 's2', label: 'Globex H eller L sweepat', sub: '', blocker: true, stop: 'Inget sweep = inget setup', journal: true },
      { id: 's3', label: 'Fresh Supply/Demand-zon finns', sub: 'Skapad 8:00–11:00 ET, <6 candles', blocker: true, stop: 'Ingen fresh S/D → hoppa', journal: true },
      { id: 's4', label: 'RR beräknat ≥ 2', sub: '', blocker: true, stop: 'RR < 2R → hoppa', journal: false },
    ] },
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'Limit order vid zon', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'SL = -0.33 bortom zon', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'TP satt (2R eller 4R)', sub: '', blocker: false, stop: '', journal: false },
    ] },
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'B/E satt vid halvvägs', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring klar', sub: '', blocker: false, stop: '', journal: false },
    ] },
  ] },
  { key: 'venom', name: 'ICT Venom Model', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'News = NO TRADE', journal: false },
      { id: 'p2', label: '8:00–11:00 ET-window öppet', sub: '', blocker: true, stop: 'Klockan >11:00 ET → STOP', journal: false },
      { id: 'p3', label: '8–9:30 range markerat', sub: '', blocker: true, stop: 'Ej markerat = ej valid', journal: false },
    ] },
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Sweep av 8–9:30 H eller L', sub: '', blocker: true, stop: 'Inget sweep = inget setup', journal: true },
      { id: 's2', label: 'Initial FVG skapad', sub: '', blocker: true, stop: 'Ingen FVG → inget setup', journal: true },
      { id: 's3', label: 'Trigger 1 (BPR) eller Trigger 2 (Breakout)', sub: '', blocker: false, stop: '', journal: true },
      { id: 's4', label: '2R möjligt', sub: '', blocker: true, stop: 'RR < 2R → hoppa', journal: false },
    ] },
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'Order satt', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'TP ej träffad pre-retest', sub: '', blocker: true, stop: 'TP träffad = cancel', journal: false },
    ] },
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Max 2 försök per dag', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring', sub: '', blocker: false, stop: '', journal: false },
    ] },
  ] },
  { key: 'turtle', name: 'ICT Turtle Soup', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'Red folder → NO TRADE', journal: false },
      { id: 'p2', label: 'NY AM session (efter 9:30)', sub: '', blocker: true, stop: 'Utanför session → vänta', journal: false },
      { id: 'p3', label: 'Bias identifierad', sub: '', blocker: false, stop: '', journal: false },
    ] },
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'TBL-sweep sedd', sub: '', blocker: true, stop: 'Inget TBL-sweep → vänta', journal: true },
      { id: 's2', label: 'T1 (reversal): CISD efter sweep', sub: '', blocker: false, stop: '', journal: true },
      { id: 's3', label: 'T2 (continuation): FVG i riktningen', sub: '', blocker: false, stop: '', journal: true },
      { id: 's4', label: 'Inte för nära nästa TBL', sub: '', blocker: false, stop: '', journal: false },
    ] },
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'T1: Limit på CISD-retest', sub: 'SL = recent H/L. TP ~1.5R.', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'T2: Limit på FVG-retest', sub: 'SL = H/L av FVG-candeln. TP 2R.', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'Cancel om TP nås pre-fill', sub: '', blocker: true, stop: 'TP träffad = cancel', journal: false },
    ] },
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Max 2 försök / en vinst = klar', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring', sub: '', blocker: false, stop: '', journal: false },
    ] },
  ] },
]

export default function Checklist() {
  const { user } = useAuth()
  const [checklists, setChecklists] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [checked, setChecked] = useState({})
  const [openPhases, setOpenPhases] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await sb.from('checklists').select('*').eq('user_id', user.id).order('created_at')
    let rows = data || []

    // Defensive seed - the dev account already has these, but a brand new
    // user wouldn't, so this keeps the page usable for everyone.
    const existingKeys = rows.map(r => r.strategy_key)
    const missing = DEFAULT_STRATEGIES.filter(s => !existingKeys.includes(s.key))
    if (missing.length) {
      const toInsert = missing.map(s => ({ user_id: user.id, strategy_key: s.key, name: s.name, phases: s.phases }))
      const { data: inserted } = await sb.from('checklists').insert(toInsert).select()
      if (inserted) rows = [...rows, ...inserted]
    }

    setChecklists(rows)
    if (rows.length) {
      setActiveKey(rows[0].strategy_key)
      setOpenPhases(Object.fromEntries((rows[0].phases || []).map(p => [p.id, true])))
    }
    setLoading(false)
  }

  function selectStrategy(key) {
    setActiveKey(key)
    setChecked({})
    const strat = checklists.find(c => c.strategy_key === key)
    setOpenPhases(Object.fromEntries((strat?.phases || []).map(p => [p.id, true])))
  }

  function toggleItem(id) {
    setChecked(c => ({ ...c, [id]: !c[id] }))
  }

  function togglePhase(id) {
    setOpenPhases(o => ({ ...o, [id]: !o[id] }))
  }

  function resetChecklist() {
    setChecked({})
  }

  const active = checklists.find(c => c.strategy_key === activeKey)
  const phases = active?.phases || []
  const allItems = phases.flatMap(p => p.items || [])
  const totalCount = allItems.length
  const doneCount = allItems.filter(it => checked[it.id]).length
  const pct = totalCount ? Math.round(doneCount / totalCount * 100) : 0
  const firstBlocker = allItems.find(it => it.blocker && !checked[it.id])

  if (loading) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Checklist" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Checklist" />
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <select className="form-control" style={{ maxWidth: 320 }} value={activeKey || ''} onChange={e => selectStrategy(e.target.value)}>
              {checklists.map(c => <option key={c.strategy_key} value={c.strategy_key}>{c.name}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetChecklist}>↺ Återställ</button>
          </div>

          <div className="card-body">
            {/* Progress */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                <span>{doneCount} / {totalCount} steg klara</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.2s' }} />
              </div>
            </div>

            {/* Status banner */}
            {pct === 100 && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--green)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
                ✅ Alla steg klara – A+ setup!
              </div>
            )}
            {pct < 100 && doneCount > 0 && firstBlocker && (
              <div style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
                ⚠ Blockerande: "{firstBlocker.label}"
              </div>
            )}

            {/* Phases */}
            {phases.map(phase => {
              const items = phase.items || []
              const phaseDone = items.filter(it => checked[it.id]).length
              const isOpen = openPhases[phase.id]
              return (
                <div key={phase.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 10, overflow: 'hidden' }}>
                  <div onClick={() => togglePhase(phase.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg3)', cursor: 'pointer' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{phase.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{phaseDone}/{items.length}</span>
                    <span style={{ fontSize: 11, color: 'var(--text4)' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                  {isOpen && (
                    <div>
                      {items.map(item => {
                        const isChecked = !!checked[item.id]
                        return (
                          <div key={item.id} onClick={() => toggleItem(item.id)}
                            style={{
                              display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer',
                              borderTop: '1px solid var(--border)', background: isChecked ? 'rgba(0,212,170,0.05)' : 'transparent',
                            }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                              border: `1.5px solid ${isChecked ? 'var(--accent)' : 'var(--border2)'}`,
                              background: isChecked ? 'var(--accent)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--bg)', fontSize: 12, fontWeight: 700,
                            }}>
                              {isChecked && '✓'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {item.label}
                                {item.journal && <span title="Markerad för journalföring" style={{ fontSize: 11 }}>📋</span>}
                              </div>
                              {item.sub && <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 2 }}>{item.sub}</div>}
                              {item.stop && !isChecked && (
                                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>⛔ {item.stop}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
