import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

const DEFAULT_STRATEGIES = [
  { key: 'unicorn', name: 'ICT Unicorn Model', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: 'Ingen red folder news inom 2h?', blocker: true, stop: 'Red folder news → NO TRADE', journal: false },
      { id: 'p2', label: 'Dag i veckan', sub: 'Fredag? → Halvrisken eller skippa', blocker: false, stop: '', journal: false },
      { id: 'p3', label: 'Klockan 9:30–13:00 ET', sub: 'Handelsfönstret är öppet', blocker: true, stop: 'Utanför window → NO TRADE', journal: false },
    ]},
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Draw on Liquidity (DOL) identifierad', sub: 'Tydliga relativa equal highs (EQH) eller equal lows (EQL)?', blocker: true, stop: 'Inga EQH/EQL → hoppa', journal: true },
      { id: 's2', label: 'Handelsriktning bestämd', sub: 'DOL ovan pris = Long. DOL under pris = Short.', blocker: false, stop: '', journal: false },
      { id: 's3', label: 'Manipulation Leg sedd', sub: 'Impulsiv rörelse bort från DOL (1–3 candles)', blocker: true, stop: 'Utdragen/choppy = lägre sannolikhet', journal: false },
      { id: 's4', label: 'Breaker identifierad', sub: 'Bullish: sista gröna BEFORE lower low. Bearish: sista röda BEFORE higher high.', blocker: true, stop: 'Ej tydlig Breaker → inget setup', journal: true },
      { id: 's5', label: 'Fair Value Gap (FVG) identifierad', sub: '3-candle, icke-överlappande wicks', blocker: true, stop: 'Ingen FVG → inget setup', journal: true },
      { id: 's6', label: '⚑ OVERLAP: Breaker + FVG överlappar', sub: 'Det överlappande området är entry-zonen. KRITISK.', blocker: true, stop: 'INGET overlap = INGET Unicorn → STOP', journal: true },
      { id: 's7', label: 'TP beräknad ≥ 2R', sub: 'Fib på manipulation leg. 2 STDV = primär TP.', blocker: true, stop: 'RR < 2R → NO TRADE', journal: false },
    ]},
    { id: 'entry', title: 'Entry & Execution', color: '#059669', items: [
      { id: 'e1', label: 'TP ej redan träffad', sub: 'Om priset kört till TP utan retest → cancel', blocker: true, stop: 'TP träffad = cancel order', journal: false },
      { id: 'e2', label: 'Limit order satt', sub: 'Entry vid topp av overlap-zon (long) / botten (short)', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'Stop Loss satt', sub: 'Body high/low av manipulation leg', blocker: false, stop: '', journal: false },
      { id: 'e4', label: 'Take Profit satt', sub: '2 STDV (primär) eller DOL (sekundär)', blocker: false, stop: '', journal: false },
    ]},
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Låt traden spela ut', sub: 'Inga manuella justeringar', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Invaliderings-check', sub: 'Stänger priset IGENOM hela zonen utan rekyl → cancel', blocker: false, stop: '', journal: false },
      { id: 'm3', label: 'Journalföring klar', sub: 'Datum, riktning, entry/SL/TP, utfall, R, grade', blocker: false, stop: '', journal: false },
    ]},
  ]},
  { key: 'globex', name: "Bernd's Globex Strategy", phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'Red folder → NO TRADE', journal: false },
      { id: 'p2', label: 'NY session öppen (9:30+)', sub: '', blocker: true, stop: 'Ej NY session → vänta', journal: false },
    ]},
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Globex High & Low markerade', sub: 'H/L från ETH 18:00–09:30 ET', blocker: true, stop: 'Ej markerade = ej valid', journal: false },
      { id: 's2', label: 'Globex H eller L sweepat', sub: '', blocker: true, stop: 'Inget sweep = inget setup', journal: true },
      { id: 's3', label: 'Fresh Supply/Demand-zon finns', sub: 'Skapad 8:00–11:00 ET, <6 candles', blocker: true, stop: 'Ingen fresh S/D → hoppa', journal: true },
      { id: 's4', label: 'RR beräknat ≥ 2', sub: '', blocker: true, stop: 'RR < 2R → hoppa', journal: false },
    ]},
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'Limit order vid zon', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'SL = -0.33 bortom zon', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'TP satt (2R eller 4R)', sub: '', blocker: false, stop: '', journal: false },
    ]},
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'B/E satt vid halvvägs', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring klar', sub: '', blocker: false, stop: '', journal: false },
    ]},
  ]},
  { key: 'venom', name: 'ICT Venom Model', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'News = NO TRADE', journal: false },
      { id: 'p2', label: '8:00–11:00 ET-window öppet', sub: '', blocker: true, stop: 'Klockan >11:00 ET → STOP', journal: false },
      { id: 'p3', label: '8–9:30 range markerat', sub: '', blocker: true, stop: 'Ej markerat = ej valid', journal: false },
    ]},
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'Sweep av 8–9:30 H eller L', sub: '', blocker: true, stop: 'Inget sweep = inget setup', journal: true },
      { id: 's2', label: 'Initial FVG skapad', sub: '', blocker: true, stop: 'Ingen FVG → inget setup', journal: true },
      { id: 's3', label: 'Trigger 1 (BPR) eller Trigger 2 (Breakout)', sub: '', blocker: false, stop: '', journal: true },
      { id: 's4', label: '2R möjligt', sub: '', blocker: true, stop: 'RR < 2R → hoppa', journal: false },
    ]},
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'Order satt', sub: '', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'TP ej träffad pre-retest', sub: '', blocker: true, stop: 'TP träffad = cancel', journal: false },
    ]},
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Max 2 försök per dag', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring', sub: '', blocker: false, stop: '', journal: false },
    ]},
  ]},
  { key: 'turtle', name: 'ICT Turtle Soup', phases: [
    { id: 'prep', title: 'Förberedelse', color: '#6366f1', items: [
      { id: 'p1', label: 'Economic calendar kollad', sub: '', blocker: true, stop: 'Red folder → NO TRADE', journal: false },
      { id: 'p2', label: 'NY AM session (efter 9:30)', sub: '', blocker: true, stop: 'Utanför session → vänta', journal: false },
      { id: 'p3', label: 'Bias identifierad', sub: '', blocker: false, stop: '', journal: false },
    ]},
    { id: 'setup', title: 'Identifiera Setup', color: '#0891b2', items: [
      { id: 's1', label: 'TBL-sweep sedd', sub: '', blocker: true, stop: 'Inget TBL-sweep → vänta', journal: true },
      { id: 's2', label: 'T1 (reversal): CISD efter sweep', sub: '', blocker: false, stop: '', journal: true },
      { id: 's3', label: 'T2 (continuation): FVG i riktningen', sub: '', blocker: false, stop: '', journal: true },
      { id: 's4', label: 'Inte för nära nästa TBL', sub: '', blocker: false, stop: '', journal: false },
    ]},
    { id: 'entry', title: 'Entry', color: '#059669', items: [
      { id: 'e1', label: 'T1: Limit på CISD-retest', sub: 'SL = recent H/L. TP ~1.5R.', blocker: false, stop: '', journal: false },
      { id: 'e2', label: 'T2: Limit på FVG-retest', sub: 'SL = H/L av FVG-candeln. TP 2R.', blocker: false, stop: '', journal: false },
      { id: 'e3', label: 'Cancel om TP nås pre-fill', sub: '', blocker: true, stop: 'TP träffad = cancel', journal: false },
    ]},
    { id: 'mgmt', title: 'Trade Management', color: '#d97706', items: [
      { id: 'm1', label: 'Max 2 försök / en vinst = klar', sub: '', blocker: false, stop: '', journal: false },
      { id: 'm2', label: 'Journalföring', sub: '', blocker: false, stop: '', journal: false },
    ]},
  ]},
]

const PHASE_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#e11d48','#7c3aed','#0284c7','#b45309']
function uid() { return crypto.randomUUID().slice(0,8) }
function emptyItem() { return { id: uid(), label: '', sub: '', blocker: false, stop: '', journal: false } }
function emptyPhase() { return { id: uid(), title: 'Ny fas', color: '#6366f1', items: [emptyItem()] } }

// ── Editor component ──────────────────────────────────────────────────────────
function Editor({ checklist, onSave, onClose, onDelete }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(checklist)))
  const [saving, setSaving] = useState(false)

  function setName(v) { setDraft(d => ({ ...d, name: v })) }

  function setPhaseField(pi, field, val) {
    setDraft(d => {
      const phases = d.phases.map((p, i) => i === pi ? { ...p, [field]: val } : p)
      return { ...d, phases }
    })
  }

  function setItemField(pi, ii, field, val) {
    setDraft(d => {
      const phases = d.phases.map((p, phI) => {
        if (phI !== pi) return p
        const items = p.items.map((it, itI) => itI === ii ? { ...it, [field]: val } : it)
        return { ...p, items }
      })
      return { ...d, phases }
    })
  }

  function addPhase() { setDraft(d => ({ ...d, phases: [...d.phases, emptyPhase()] })) }
  function removePhase(pi) { setDraft(d => ({ ...d, phases: d.phases.filter((_, i) => i !== pi) })) }
  function movePhase(pi, dir) {
    setDraft(d => {
      const p = [...d.phases]
      const ni = pi + dir
      if (ni < 0 || ni >= p.length) return d
      ;[p[pi], p[ni]] = [p[ni], p[pi]]
      return { ...d, phases: p }
    })
  }
  function addItem(pi) {
    setDraft(d => {
      const phases = d.phases.map((p, i) => i === pi ? { ...p, items: [...p.items, emptyItem()] } : p)
      return { ...d, phases }
    })
  }
  function removeItem(pi, ii) {
    setDraft(d => {
      const phases = d.phases.map((p, i) => i === pi ? { ...p, items: p.items.filter((_, j) => j !== ii) } : p)
      return { ...d, phases }
    })
  }
  function moveItem(pi, ii, dir) {
    setDraft(d => {
      const phases = d.phases.map((p, phI) => {
        if (phI !== pi) return p
        const items = [...p.items]
        const ni = ii + dir
        if (ni < 0 || ni >= items.length) return p
        ;[items[ii], items[ni]] = [items[ni], items[ii]]
        return { ...p, items }
      })
      return { ...d, phases }
    })
  }

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
  }

  const btnSm = { background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '2px 7px', lineHeight: 1.4 }
  const inputStyle = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '6px 10px', fontSize: 13, width: '100%', fontFamily: 'var(--font)' }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r2)', background: 'var(--bg2)', marginTop: 16 }}>
      {/* Editor header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>✏️ Redigerar</span>
        <input value={draft.name} onChange={e => setName(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontWeight: 700, fontSize: 15 }} placeholder="Strateginamn" />
        <button onClick={onClose} style={{ ...btnSm, marginLeft: 4 }}>Stäng</button>
        <button onClick={handleSave} disabled={saving}
          style={{ ...btnSm, background: 'var(--accent)', border: 'none', color: 'var(--bg)', fontWeight: 700, padding: '4px 14px' }}>
          {saving ? 'Sparar…' : '💾 Spara'}
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {draft.phases.map((phase, pi) => (
          <div key={phase.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 12, overflow: 'hidden' }}>
            {/* Phase header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <input type="color" value={phase.color} onChange={e => setPhaseField(pi, 'color', e.target.value)}
                style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }} />
              <input value={phase.title} onChange={e => setPhaseField(pi, 'title', e.target.value)}
                style={{ ...inputStyle, flex: 1, fontWeight: 600 }} placeholder="Fasnamn" />
              <button onClick={() => movePhase(pi, -1)} style={btnSm} title="Flytta upp">↑</button>
              <button onClick={() => movePhase(pi, 1)} style={btnSm} title="Flytta ner">↓</button>
              <button onClick={() => removePhase(pi)} style={{ ...btnSm, color: 'var(--red)', borderColor: 'var(--red)' }} title="Ta bort fas">✕</button>
            </div>

            {/* Items */}
            <div style={{ padding: '8px 12px' }}>
              {phase.items.map((item, ii) => (
                <div key={item.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input value={item.label} onChange={e => setItemField(pi, ii, 'label', e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontWeight: 600 }} placeholder="Steg-rubrik (obligatorisk)" />
                    <button onClick={() => moveItem(pi, ii, -1)} style={btnSm}>↑</button>
                    <button onClick={() => moveItem(pi, ii, 1)} style={btnSm}>↓</button>
                    <button onClick={() => removeItem(pi, ii)} style={{ ...btnSm, color: 'var(--red)', borderColor: 'var(--red)' }}>✕</button>
                  </div>
                  <input value={item.sub} onChange={e => setItemField(pi, ii, 'sub', e.target.value)}
                    style={{ ...inputStyle, fontSize: 12, marginBottom: 8 }} placeholder="Beskrivning (valfri)" />
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>
                      <input type="checkbox" checked={item.blocker} onChange={e => setItemField(pi, ii, 'blocker', e.target.checked)}
                        style={{ accentColor: 'var(--red)', width: 14, height: 14 }} />
                      ⛔ Blockerande
                    </label>
                    {item.blocker && (
                      <input value={item.stop} onChange={e => setItemField(pi, ii, 'stop', e.target.value)}
                        style={{ ...inputStyle, flex: 1, fontSize: 12 }} placeholder="Stop-text (visas om ej ikryssad)" />
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--text3)', marginLeft: 'auto' }}>
                      <input type="checkbox" checked={item.journal} onChange={e => setItemField(pi, ii, 'journal', e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                      📋 Journalmärkt
                    </label>
                  </div>
                </div>
              ))}
              <button onClick={() => addItem(pi)}
                style={{ ...btnSm, width: '100%', padding: '5px', color: 'var(--text3)', marginTop: 2 }}>+ Lägg till steg</button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={addPhase} style={{ ...btnSm, flex: 1, padding: '7px' }}>+ Lägg till fas</button>
          {onDelete && (
            <button onClick={onDelete} style={{ ...btnSm, color: 'var(--red)', borderColor: 'var(--red)', padding: '7px 14px' }}>
              🗑 Ta bort strategi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Phase card (for the 2-col checklist view) ─────────────────────────────────
function PhaseCard({ phase, checked, onToggleItem, onTogglePhase, isOpen }) {
  const items = phase.items || []
  const phaseDone = items.filter(it => checked[it.id]).length
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', height: 'fit-content' }}>
      <div onClick={() => onTogglePhase(phase.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg3)', cursor: 'pointer' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{phase.title}</span>
        <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)' }}>{phaseDone}/{items.length}</span>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>{isOpen ? '▾' : '▸'}</span>
      </div>
      {isOpen && items.map(item => {
        const isChecked = !!checked[item.id]
        return (
          <div key={item.id} onClick={() => onToggleItem(item.id)}
            style={{
              display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer',
              borderTop: '1px solid var(--border)', background: isChecked ? 'rgba(0,212,170,0.05)' : 'transparent',
            }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: `1.5px solid ${isChecked ? 'var(--accent)' : 'var(--border2)'}`,
              background: isChecked ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--bg)', fontSize: 12, fontWeight: 700, transition: 'background 0.12s',
            }}>
              {isChecked && '✓'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isChecked ? 'var(--text3)' : 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: isChecked ? 'line-through' : 'none' }}>
                {item.label}
                {item.journal && <span title="Markerad för journalföring" style={{ fontSize: 11, textDecoration: 'none' }}>📋</span>}
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
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Checklist() {
  const { user } = useAuth()
  const [checklists, setChecklists] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [checked, setChecked] = useState({})
  const [openPhases, setOpenPhases] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState(null) // null = no editor open

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await sb.from('checklists').select('*').eq('user_id', user.id).order('created_at')
    let rows = data || []
    const existingKeys = rows.map(r => r.strategy_key)
    const missing = DEFAULT_STRATEGIES.filter(s => !existingKeys.includes(s.key))
    if (missing.length) {
      const toInsert = missing.map(s => ({ user_id: user.id, strategy_key: s.key, name: s.name, phases: s.phases }))
      const { data: inserted } = await sb.from('checklists').insert(toInsert).select()
      if (inserted) rows = [...rows, ...inserted]
    }
    setChecklists(rows)
    if (rows.length && !activeKey) {
      setActiveKey(rows[0].strategy_key)
      setOpenPhases(Object.fromEntries((rows[0].phases || []).map(p => [p.id, true])))
    }
    setLoading(false)
  }

  function selectStrategy(key) {
    setActiveKey(key)
    setChecked({})
    setEditingKey(null)
    const strat = checklists.find(c => c.strategy_key === key)
    setOpenPhases(Object.fromEntries((strat?.phases || []).map(p => [p.id, true])))
  }

  function toggleItem(id) { setChecked(c => ({ ...c, [id]: !c[id] })) }
  function togglePhase(id) { setOpenPhases(o => ({ ...o, [id]: !o[id] })) }
  function resetChecklist() { setChecked({}) }

  async function handleSave(draft) {
    const existing = checklists.find(c => c.strategy_key === draft.strategy_key)
    if (existing) {
      await sb.from('checklists').update({ name: draft.name, phases: draft.phases, updated_at: new Date().toISOString() }).eq('id', existing.id)
    }
    await load()
    setEditingKey(null)
  }

  async function handleNewStrategy() {
    const name = window.prompt('Namn på ny strategi:')
    if (!name?.trim()) return
    const key = 'custom_' + Date.now()
    const newCl = { user_id: user.id, strategy_key: key, name: name.trim(), phases: [emptyPhase()] }
    const { data } = await sb.from('checklists').insert([newCl]).select()
    if (data?.[0]) {
      setChecklists(c => [...c, data[0]])
      setActiveKey(key)
      setEditingKey(key)
      setChecked({})
      setOpenPhases({})
    }
  }

  async function handleDelete(key) {
    if (!window.confirm('Ta bort denna strategi? Går inte att ångra.')) return
    const cl = checklists.find(c => c.strategy_key === key)
    if (cl) await sb.from('checklists').delete().eq('id', cl.id)
    const remaining = checklists.filter(c => c.strategy_key !== key)
    setChecklists(remaining)
    if (remaining.length) {
      setActiveKey(remaining[0].strategy_key)
      setOpenPhases(Object.fromEntries((remaining[0].phases || []).map(p => [p.id, true])))
    } else {
      setActiveKey(null)
    }
    setEditingKey(null)
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

  // Split phases into two columns
  const mid = Math.ceil(phases.length / 2)
  const col1 = phases.slice(0, mid)
  const col2 = phases.slice(mid)

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Checklist" />
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              <select className="form-control" style={{ maxWidth: 280 }} value={activeKey || ''} onChange={e => selectStrategy(e.target.value)}>
                {checklists.map(c => <option key={c.strategy_key} value={c.strategy_key}>{c.name}</option>)}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetChecklist}>↺ Återställ</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {activeKey && (
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setEditingKey(editingKey === activeKey ? null : activeKey)}
                  style={editingKey === activeKey ? { background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.4)', color: 'var(--accent)' } : undefined}>
                  ✏️ Redigera
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleNewStrategy}>+ Ny strategi</button>
            </div>
          </div>

          <div className="card-body">
            {/* Progress */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
                <span>{doneCount} / {totalCount} steg klara</span>
                <span style={{ fontWeight: 600, color: pct === 100 ? 'var(--green)' : 'var(--text3)' }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.2s' }} />
              </div>
            </div>

            {/* Status banner */}
            {pct === 100 && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--green)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                ✅ Alla steg klara – A+ setup!
              </div>
            )}
            {pct < 100 && doneCount > 0 && firstBlocker && (
              <div style={{ background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                ⚠ Blockerande: "{firstBlocker.label}"
              </div>
            )}

            {/* 2-column phase grid - collapses to 1 col when narrow */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col1.map(phase => (
                  <PhaseCard key={phase.id} phase={phase} checked={checked}
                    onToggleItem={toggleItem} onTogglePhase={togglePhase} isOpen={!!openPhases[phase.id]} />
                ))}
              </div>
              {col2.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col2.map(phase => (
                    <PhaseCard key={phase.id} phase={phase} checked={checked}
                      onToggleItem={toggleItem} onTogglePhase={togglePhase} isOpen={!!openPhases[phase.id]} />
                  ))}
                </div>
              )}
            </div>

            {/* Inline editor */}
            {editingKey && active && (
              <Editor
                checklist={active}
                onSave={handleSave}
                onClose={() => setEditingKey(null)}
                onDelete={() => handleDelete(activeKey)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
