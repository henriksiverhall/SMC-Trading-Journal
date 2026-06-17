import { useEffect, useState, useRef, useCallback } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EMOTIONS, GRADES, getFuturesSpec, gradeColor, formatR } from '../lib/constants'
import Topbar from '../components/Topbar'

// ── Field layout: rows of 1-2 field ids. Solo = full width, pair = 50/50 split.
// Persisted in userSettings.widgets.journal_fields.rows (syncs across devices),
// not localStorage.
const DEFAULT_FIELD_ROWS = [
  ['strategy'],
  ['date', 'time'],
  ['symbol', 'direction'],
  ['entry', 'contracts'],
  ['sl', 'tp'],
  ['actual_exit'],
  ['outcome'],
  ['r_display'],
  ['risk_pct', 'account_size'],
  ['grade'],
  ['emotion'],
  ['chart'],
  ['notes'],
  ['custom'],
]
// All field ids that must exist somewhere in the row layout. Used to repair
// saved layouts if a field is ever added/removed from the app in the future.
const ALL_FIELD_IDS = DEFAULT_FIELD_ROWS.flat()

// Fields that can be marked "obligatorisk" (required). Excludes r_display
// (computed, not an input) and custom (multiple sub-fields, ambiguous as one toggle).
const REQUIRABLE_FIELD_IDS = ALL_FIELD_IDS.filter(id => id !== 'r_display' && id !== 'custom')
const DEFAULT_REQUIRED_FIELDS = ['outcome'] // preserves pre-existing hardcoded behavior
// Maps a field id to its key in the `form` state, where it differs from the id itself.
const FIELD_FORM_KEY = { chart: 'chart_link' }
const FIELD_LABELS = {
  strategy: 'Strategi', date: 'Datum', time: 'Tid', symbol: 'Instrument', direction: 'Riktning',
  entry: 'Entry', contracts: 'Kontrakt', sl: 'Stop Loss', tp: 'Take Profit', actual_exit: 'Faktisk exit',
  outcome: 'Utfall', risk_pct: 'Risk %', account_size: 'Kontostorlek', grade: 'Grade',
  emotion: 'Känsla', chart: 'Chart/Skärmbild', notes: 'Noteringar',
}

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_FIELD_ROWS
  const seen = new Set()
  const cleaned = []
  for (const row of rows) {
    const r = (Array.isArray(row) ? row : [row]).filter(id => ALL_FIELD_IDS.includes(id) && !seen.has(id))
    r.forEach(id => seen.add(id))
    if (r.length) cleaned.push(r)
  }
  // Any field id missing from the saved layout (e.g. newly added field) gets its own row at the end
  const missing = ALL_FIELD_IDS.filter(id => !seen.has(id))
  missing.forEach(id => cleaned.push([id]))
  return cleaned
}

function getCustomFields() {
  try { return JSON.parse(localStorage.getItem('tl_custom_fields')) || [] }
  catch { return [] }
}
function setCustomFields(fields) { localStorage.setItem('tl_custom_fields', JSON.stringify(fields)) }

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  time: '',
  symbol: '',
  direction: '',
  entry: '',
  sl: '',
  tp: '',
  actual_exit: '',
  outcome: '',
  grade: '',
  emotion: '',
  notes: '',
  strategy: '',
  contracts: '1',
  risk_pct: '',
  account_size: '',
}
const EMPTY_SCALE   = () => ({ id: crypto.randomUUID(), price: '', contracts: '1' })
const EMPTY_TARGET  = () => ({ id: crypto.randomUUID(), price: '', contracts: '' })

// ── R computation ─────────────────────────────────────────────────────────────
function computeRValues(f, scales, targets) {
  const entry = getWeightedEntry(f, scales)
  const sl    = parseFloat(f.sl)
  const spec  = getFuturesSpec(f.symbol)
  const totalContracts = scales.length > 0 ? getTotalContracts(f, scales) : (parseFloat(f.contracts) || 1)

  if (!entry || !sl || isNaN(entry) || isNaN(sl)) return { r: null, usd: null }
  const risk = Math.abs(entry - sl)
  if (risk === 0) return { r: null, usd: null }

  let r = null
  if (f.outcome === 'BE') {
    r = 0
  } else if (f.outcome === 'L') {
    r = -1
  } else if (f.outcome === 'W') {
    // Prioritize actual_exit if set
    const actualExit = parseFloat(f.actual_exit)
    if (actualExit && !isNaN(actualExit)) {
      r = parseFloat((Math.abs(actualExit - entry) / risk).toFixed(2))
    } else if (targets.length > 0) {
      const valid = targets.filter(t => t.price && t.contracts)
      if (valid.length > 0) {
        let totalR = 0, totalQty = 0
        for (const t of valid) {
          const qty = parseFloat(t.contracts) || 0
          const price = parseFloat(t.price)
          if (!price || !qty) continue
          totalR += (Math.abs(price - entry) / risk) * qty
          totalQty += qty
        }
        r = totalQty > 0 ? parseFloat((totalR / totalQty).toFixed(2)) : null
      }
    } else {
      const tp = parseFloat(f.tp)
      if (tp && !isNaN(tp)) r = parseFloat((Math.abs(tp - entry) / risk).toFixed(2))
    }
  }

  let usd = null
  if (spec && r !== null) {
    const riskUSD = risk * spec.pointValue * totalContracts
    usd = parseFloat((r * riskUSD).toFixed(2))
  }
  return { r, usd }
}

function getWeightedEntry(f, scales) {
  const base = parseFloat(f.entry)
  if (!base || isNaN(base)) return null
  if (!scales.length) return base
  const all = [{ price: base, contracts: parseFloat(f.contracts) || 1 }]
  for (const s of scales) {
    const p = parseFloat(s.price), c = parseFloat(s.contracts) || 1
    if (p && !isNaN(p)) all.push({ price: p, contracts: c })
  }
  if (all.length === 1) return base
  const totalC = all.reduce((a, e) => a + e.contracts, 0)
  return parseFloat((all.reduce((a, e) => a + e.price * e.contracts, 0) / totalC).toFixed(4))
}
function getTotalContracts(f, scales) {
  return (parseFloat(f.contracts) || 1) + scales.reduce((a, s) => a + (parseFloat(s.contracts) || 1), 0)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Journal() {
  const { user, userSettings, saveSettings } = useAuth()
  const [trades, setTrades] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calcR, setCalcR] = useState(null)
  const [calcUSD, setCalcUSD] = useState(null)
  const [selectedModal, setSelectedModal] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [scaleIns, setScaleIns] = useState([])
  const [targets, setTargets] = useState([])
  const [fieldRows, setFieldRowsState] = useState(DEFAULT_FIELD_ROWS)
  const [requiredFields, setRequiredFieldsState] = useState(DEFAULT_REQUIRED_FIELDS)
  const [customFields, setCustomFieldsState] = useState(getCustomFields)
  const [customValues, setCustomValues] = useState({})
  const [showFieldMgr, setShowFieldMgr] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [draggingField, setDraggingField] = useState(null)
  const [dropHint, setDropHint] = useState(null) // { id, mode: 'before'|'after'|'pair'|'swap' }
  const formRef = useRef(null)

  // Load field layout from userSettings (synced across devices)
  useEffect(() => {
    setFieldRowsState(normalizeRows(userSettings?.widgets?.journal_fields?.rows))
    const saved = userSettings?.widgets?.journal_fields?.requiredFields
    setRequiredFieldsState(Array.isArray(saved) ? saved.filter(id => REQUIRABLE_FIELD_IDS.includes(id)) : DEFAULT_REQUIRED_FIELDS)
  }, [userSettings?.widgets?.journal_fields?.rows, userSettings?.widgets?.journal_fields?.requiredFields])

  function persistFieldRows(rows) {
    setFieldRowsState(rows)
    const current = userSettings?.widgets || {}
    saveSettings({ widgets: { ...current, journal_fields: { ...(current.journal_fields || {}), rows } } })
  }

  function persistRequiredFields(fields) {
    setRequiredFieldsState(fields)
    const current = userSettings?.widgets || {}
    saveSettings({ widgets: { ...current, journal_fields: { ...(current.journal_fields || {}), requiredFields: fields } } })
  }

  function toggleRequired(id) {
    const next = requiredFields.includes(id) ? requiredFields.filter(f => f !== id) : [...requiredFields, id]
    persistRequiredFields(next)
  }

  function isFieldFilled(id) {
    const key = FIELD_FORM_KEY[id] || id
    const v = form[key]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }

  // Load account/risk settings from userSettings
  useEffect(() => {
    if (!user) return
    loadTrades()
    setForm(f => ({
      ...f,
      strategy: userSettings?.lastJournalStrategy || f.strategy,
      risk_pct: userSettings?.riskPct ? String(userSettings.riskPct) : f.risk_pct,
      account_size: userSettings?.accountSize ? String(userSettings.accountSize) : f.account_size,
    }))
  }, [user])

  async function loadTrades() {
    const { data } = await sb.from('trades').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  function updateForm(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value }
      const { r, usd } = computeRValues(next, scaleIns, targets)
      setCalcR(r); setCalcUSD(usd)
      return next
    })
  }

  function recalc(f, sc, tg) {
    const { r, usd } = computeRValues(f, sc, tg)
    setCalcR(r); setCalcUSD(usd)
  }

  // Scale-in
  function addScaleIn() { setScaleIns(s => [...s, EMPTY_SCALE()]) }
  function removeScaleIn(id) { const n = scaleIns.filter(s => s.id !== id); setScaleIns(n); recalc(form, n, targets) }
  function updateScaleIn(id, field, val) { const n = scaleIns.map(s => s.id === id ? { ...s, [field]: val } : s); setScaleIns(n); recalc(form, n, targets) }

  // Targets
  function addTarget() { setTargets(t => [...t, EMPTY_TARGET()]) }
  function removeTarget(id) { const n = targets.filter(t => t.id !== id); setTargets(n); recalc(form, scaleIns, n) }
  function updateTarget(id, field, val) { const n = targets.map(t => t.id === id ? { ...t, [field]: val } : t); setTargets(n); recalc(form, scaleIns, n) }

  // ── Drag & drop for field layout ──────────────────────────────────────────
  // Rules: drop on a solo field -> pair into a 2-col row. Drop on a field that
  // already shares a row -> swap positions. Drop near the top/bottom edge of
  // any field -> insert as a new full-width row before/after it.
  function findFieldPos(rows, id) {
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].indexOf(id)
      if (c !== -1) return [r, c]
    }
    return null
  }

  function onFieldDragStart(e, id) {
    setDraggingField(id)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  function onFieldDragOver(e, id) {
    e.preventDefault()
    if (id === draggingField) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = (e.clientY - rect.top) / rect.height
    const [r] = findFieldPos(fieldRows, id) ?? [null]
    const rowLen = r != null ? fieldRows[r].length : 1
    let mode
    if (relY < 0.25) mode = 'before'
    else if (relY > 0.75) mode = 'after'
    else mode = rowLen === 1 ? 'pair' : 'swap'
    setDropHint({ id, mode })
  }

  function onFieldDragEnd() {
    if (draggingField && dropHint && dropHint.id !== draggingField) {
      const fromId = draggingField, toId = dropHint.id, mode = dropHint.mode
      let rows = fieldRows.map(r => [...r])

      if (mode === 'swap') {
        const fromPos = findFieldPos(rows, fromId)
        const toPos = findFieldPos(rows, toId)
        if (fromPos && toPos) {
          rows[fromPos[0]][fromPos[1]] = toId
          rows[toPos[0]][toPos[1]] = fromId
        }
      } else {
        // Remove fromId from its current row first (drop empty rows)
        const fromPos = findFieldPos(rows, fromId)
        if (fromPos) {
          rows[fromPos[0]].splice(fromPos[1], 1)
          if (rows[fromPos[0]].length === 0) rows.splice(fromPos[0], 1)
        }
        const toPos = findFieldPos(rows, toId)
        if (toPos) {
          if (mode === 'pair') {
            rows[toPos[0]] = [...rows[toPos[0]], fromId]
          } else {
            const insertAt = mode === 'before' ? toPos[0] : toPos[0] + 1
            rows.splice(insertAt, 0, [fromId])
          }
        }
      }
      persistFieldRows(rows)
    }
    setDraggingField(null)
    setDropHint(null)
  }

  // Custom fields
  function addCustomField() {
    if (!newFieldName.trim()) return
    const nf = { id: crypto.randomUUID(), name: newFieldName.trim(), type: newFieldType }
    const updated = [...customFields, nf]
    setCustomFieldsState(updated); setCustomFields(updated)
    setNewFieldName(''); setNewFieldType('text')
  }
  function removeCustomField(id) {
    const updated = customFields.filter(f => f.id !== id)
    setCustomFieldsState(updated); setCustomFields(updated)
    setCustomValues(v => { const n = { ...v }; delete n[id]; return n })
  }

  // Risk $ calculation
  const spec = getFuturesSpec(form.symbol)
  const weightedEntry = getWeightedEntry(form, scaleIns)
  const riskPct = parseFloat(form.risk_pct)
  const accountSize = parseFloat(form.account_size)
  const riskDollar = (riskPct && accountSize) ? parseFloat((accountSize * riskPct / 100).toFixed(2)) : null
  const missingRequiredFields = requiredFields.filter(id => !isFieldFilled(id))

  // Save
  async function handleSave(e) {
    e.preventDefault()
    if (missingRequiredFields.length > 0) return
    setSaving(true)

    const entry = weightedEntry || parseFloat(form.entry)
    const totalC = scaleIns.length > 0 ? getTotalContracts(form, scaleIns) : (parseFloat(form.contracts) || 1)

    const trade = {
      user_id: user.id,
      date: form.date || new Date().toISOString().split('T')[0],
      time: form.time || null,
      symbol: form.symbol || null,
      direction: form.direction || null,
      entry: entry || null,
      sl: parseFloat(form.sl) || null,
      tp: parseFloat(form.tp) || null,
      outcome: form.outcome,
      result: calcR,
      grade: form.grade || null,
      emotion: form.emotion || null,
      strategy: form.strategy || null,
      notes: form.notes || null,
      checklist_pct: 0,
      risk_amount: riskDollar,
      custom_data: {
        ...(spec ? { _futures: true } : {}),
        ...(form.actual_exit ? { _actual_exit: parseFloat(form.actual_exit) } : {}),
        ...(scaleIns.length > 0 ? { _scaleIns: scaleIns, _totalContracts: totalC, _weightedEntry: entry } : {}),
        ...(targets.length > 0 ? { _targets: targets } : {}),
        ...(riskPct ? { _risk_pct: riskPct } : {}),
        ...(accountSize ? { _account_size: accountSize } : {}),
        ...Object.fromEntries(customFields.map(f => [f.name, customValues[f.id] || null])),
      },
    }

    let error
    if (editingId) {
      ;({ error } = await sb.from('trades').update(trade).eq('id', editingId).eq('user_id', user.id))
    } else {
      ;({ error } = await sb.from('trades').insert(trade))
    }

    if (!error) {
      // Save risk/account to userSettings
      if (riskPct || accountSize) {
        await saveSettings({ riskPct: riskPct || userSettings?.riskPct, accountSize: accountSize || userSettings?.accountSize })
      }
      if (form.strategy) {
        await saveSettings({ lastJournalStrategy: form.strategy })
      }
      resetForm()
      loadTrades()
    }
    setSaving(false)
  }

  function resetForm() {
    setForm(f => ({
      ...DEFAULT_FORM,
      strategy: f.strategy,
      date: f.date,
      risk_pct: f.risk_pct,
      account_size: f.account_size,
    }))
    setCalcR(null); setCalcUSD(null)
    setScaleIns([]); setTargets([])
    setCustomValues({})
    setEditingId(null)
  }

  function startEdit(trade) {
    setSelectedModal(null); setEditingId(trade.id)
    const cd = trade.custom_data || {}
    setScaleIns(cd._scaleIns || [])
    setTargets(cd._targets || [])
    setCustomValues(
      Object.fromEntries(customFields.map(f => [f.id, cd[f.name] || '']))
    )
    setForm({
      date: trade.date || '',
      time: trade.time || '',
      symbol: trade.symbol || '',
      direction: trade.direction || '',
      entry: trade.entry ?? '',
      sl: trade.sl ?? '',
      tp: trade.tp ?? '',
      actual_exit: cd._actual_exit ?? '',
      outcome: trade.outcome || '',
      grade: trade.grade || '',
      emotion: trade.emotion || '',
      notes: trade.notes || '',
      strategy: trade.strategy || '',
      contracts: cd._totalContracts || '1',
      risk_pct: cd._risk_pct ? String(cd._risk_pct) : String(userSettings?.riskPct || ''),
      account_size: cd._account_size ? String(cd._account_size) : String(userSettings?.accountSize || ''),
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
    const { r, usd } = computeRValues({ ...form }, cd._scaleIns || [], cd._targets || [])
    setCalcR(r); setCalcUSD(usd)
  }

  async function deleteTrade(id) {
    if (!window.confirm('Ta bort denna trade?')) return
    await sb.from('trades').delete().eq('id', id).eq('user_id', user.id)
    setSelectedModal(null); loadTrades()
  }

  const rColor = calcR > 0 ? 'var(--green)' : calcR < 0 ? 'var(--red)' : 'var(--text3)'

  // Render each form section
  function renderField(id) {
    switch (id) {
      case 'strategy':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Strategi <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>sparas automatiskt</span></label>
            <input type="text" className="form-control" placeholder="ICT Unicorn, Trend Pullback…"
              value={form.strategy} onChange={e => updateForm('strategy', e.target.value)} />
          </div>
        )
      case 'date':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Datum</label>
            <input type="date" className="form-control" value={form.date} onChange={e => updateForm('date', e.target.value)} />
          </div>
        )
      case 'time':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Tid (ET)</label>
            <input type="time" className="form-control" value={form.time} onChange={e => updateForm('time', e.target.value)} />
          </div>
        )
      case 'symbol':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Instrument</label>
            <input type="text" className="form-control" placeholder="NQ, ES, XAU…"
              value={form.symbol} onChange={e => updateForm('symbol', e.target.value)} />
            {spec && (
              <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                🔷 {spec.name} · ${spec.pointValue}/point · {spec.exchange}
              </div>
            )}
          </div>
        )
      case 'direction':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Riktning</label>
            <select className="form-control" value={form.direction} onChange={e => updateForm('direction', e.target.value)}>
              <option value="">Välj…</option>
              <option value="Long">Long</option>
              <option value="Short">Short</option>
            </select>
          </div>
        )
      case 'entry':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Entry</label>
            <input type="number" step="0.01" className="form-control" placeholder="0.00"
              value={form.entry} onChange={e => updateForm('entry', e.target.value)} />
            {scaleIns.map((s, i) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 8, marginTop: 6 }}>
                <input type="number" step="0.01" className="form-control" placeholder={`Scale-in ${i + 2}`}
                  value={s.price} onChange={e => updateScaleIn(s.id, 'price', e.target.value)} />
                <input type="number" step="1" min="1" className="form-control" placeholder="Ktr"
                  value={s.contracts} onChange={e => updateScaleIn(s.id, 'contracts', e.target.value)} />
                <button type="button" onClick={() => removeScaleIn(s.id)}
                  style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--red)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            {scaleIns.length > 0 && weightedEntry && (
              <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 6 }}>
                Weighted entry: {weightedEntry} · Total: {getTotalContracts(form, scaleIns)} ktr
              </div>
            )}
            <button type="button" onClick={addScaleIn}
              style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '4px 12px', width: '100%', marginTop: 8 }}>
              + Lägg till scale-in entry
            </button>
          </div>
        )
      case 'contracts':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Kontrakt</label>
            <input type="number" step="1" min="1" className="form-control" placeholder="1"
              value={form.contracts} onChange={e => updateForm('contracts', e.target.value)} />
          </div>
        )
      case 'sl':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Stop Loss</label>
            <input type="number" step="0.01" className="form-control" placeholder="0.00"
              value={form.sl} onChange={e => updateForm('sl', e.target.value)} />
          </div>
        )
      case 'tp':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Take Profit 1</label>
            <input type="number" step="0.01" className="form-control" placeholder="0.00"
              value={form.tp} onChange={e => updateForm('tp', e.target.value)} />
            {targets.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {targets.map((t, i) => (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 8, marginBottom: 6 }}>
                    <input type="number" step="0.01" className="form-control" placeholder={`TP ${i + 2}`}
                      value={t.price} onChange={e => updateTarget(t.id, 'price', e.target.value)} />
                    <input type="number" step="1" min="1" className="form-control" placeholder="Ktr"
                      value={t.contracts} onChange={e => updateTarget(t.id, 'contracts', e.target.value)} />
                    <button type="button" onClick={() => removeTarget(t.id)}
                      style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--red)', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={addTarget}
              style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '4px 12px', width: '100%', marginTop: 8 }}>
              + Fler targets
            </button>
          </div>
        )
      case 'actual_exit':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Faktisk exit <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
            <input type="number" step="0.01" className="form-control" placeholder="Om ej exakt TP/SL"
              value={form.actual_exit} onChange={e => updateForm('actual_exit', e.target.value)} />
          </div>
        )
      case 'outcome':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Utfall</label>
            <select className="form-control" value={form.outcome} onChange={e => updateForm('outcome', e.target.value)} required>
              <option value="">Välj…</option>
              <option value="W">Win</option>
              <option value="L">Loss</option>
              <option value="BE">Break Even</option>
            </select>
          </div>
        )
      case 'r_display':
        return calcR !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border2)' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>R Auto</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: rColor }}>
                {calcR > 0 ? '+' : ''}{calcR.toFixed(2)}R
              </div>
            </div>
            {calcUSD !== null && (
              <div style={{ borderLeft: '1px solid var(--border2)', paddingLeft: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>P&L</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: calcUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {calcUSD >= 0 ? '+' : ''}${Math.abs(calcUSD).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        ) : null
      case 'risk_pct':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Risk % av konto</label>
            <input type="number" step="0.1" min="0" className="form-control" placeholder="0.5"
              value={form.risk_pct} onChange={e => updateForm('risk_pct', e.target.value)} />
          </div>
        )
      case 'account_size':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Kontostorlek</label>
            <input type="number" step="1000" className="form-control" placeholder="50000"
              value={form.account_size} onChange={e => updateForm('account_size', e.target.value)} />
            {riskDollar && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                ${riskDollar}/R
                {spec && form.entry && form.sl ? (() => {
                  const risk = Math.abs(parseFloat(form.entry) - parseFloat(form.sl))
                  const riskPerContract = risk * spec.pointValue
                  const suggestedContracts = riskPerContract > 0 ? Math.floor(riskDollar / riskPerContract) : null
                  return suggestedContracts ? <span style={{ color: 'var(--accent)', marginLeft: 8 }}>→ {suggestedContracts} ktr vid {spec.name}</span> : null
                })() : null}
              </div>
            )}
          </div>
        )
      case 'grade':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Grade</label>
            <div className="grade-btns" style={{ marginTop: 6 }}>
              {GRADES.map(g => (
                <button key={g} type="button" className={`grade-btn ${form.grade === g ? 'sel' : ''}`}
                  onClick={() => updateForm('grade', form.grade === g ? '' : g)}>{g}</button>
              ))}
            </div>
          </div>
        )
      case 'emotion':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Känsla <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
            <div className="emotion-btns" style={{ marginTop: 6 }}>
              {EMOTIONS.map(em => (
                <button key={em.id} type="button" className={`emotion-btn ${form.emotion === em.id ? 'sel' : ''}`}
                  onClick={() => updateForm('emotion', form.emotion === em.id ? '' : em.id)}>
                  {em.emoji} {em.label}
                </button>
              ))}
            </div>
          </div>
        )
      case 'chart':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Chart / Skärmbild</label>
            <input type="url" className="form-control" placeholder="URL eller länk till chart…"
              value={form.chart_link || ''} onChange={e => updateForm('chart_link', e.target.value)} style={{ marginTop: 6 }} />
          </div>
        )
      case 'notes':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Noteringar</label>
            <textarea className="form-control" rows={3} placeholder="Vad gick bra? Vad kunde gjorts bättre?"
              value={form.notes} onChange={e => updateForm('notes', e.target.value)}
              style={{ resize: 'vertical', marginTop: 6 }} />
          </div>
        )
      case 'custom':
        return customFields.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Egna fält</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customFields.map(f => (
                <div key={f.id} className="form-group">
                  <label className="form-label" style={{ textTransform: 'none', letterSpacing: 0 }}>{f.name}</label>
                  {f.type === 'select' ? (
                    <select className="form-control" value={customValues[f.id] || ''}
                      onChange={e => setCustomValues(v => ({ ...v, [f.id]: e.target.value }))}>
                      <option value="">Välj…</option>
                      {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type === 'number' ? 'number' : 'text'} className="form-control"
                      value={customValues[f.id] || ''}
                      onChange={e => setCustomValues(v => ({ ...v, [f.id]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null
      default: return null
    }
  }

  return (
    <div style={{ flex: 1 }}>
      <Topbar title={editingId ? 'Journal – Redigerar' : 'Journal'} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'clamp(420px, 27vw, 520px) 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Form ── */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 24px)' }} ref={formRef}>
            <div className="card-header">
              <div className="card-title">{editingId ? '✏️ Redigera trade' : 'Log Trade'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFieldMgr(m => !m)} title="Hantera fält"
                  style={showFieldMgr ? { background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.4)', color: 'var(--accent)' } : undefined}>
                  ⚙ Anpassa
                </button>
              </div>
            </div>

            {/* Field manager */}
            {showFieldMgr && (
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Obligatoriska fält</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 18 }}>
                  {fieldRows.flat().filter(id => REQUIRABLE_FIELD_IDS.includes(id)).map(id => (
                    <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={requiredFields.includes(id)} onChange={() => toggleRequired(id)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                      {FIELD_LABELS[id] || id}
                    </label>
                  ))}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Egna fält</div>
                {customFields.map((f, i) => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{f.name} <span style={{ color: 'var(--text4)' }}>({f.type})</span></span>
                    <button onClick={() => removeCustomField(f.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>Ta bort</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input className="form-control" style={{ flex: 2 }} placeholder="Fältnamn" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomField()} />
                  <select className="form-control" style={{ flex: 1 }} value={newFieldType} onChange={e => setNewFieldType(e.target.value)}>
                    <option value="text">Text</option>
                    <option value="number">Nummer</option>
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" onClick={addCustomField}>+</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 10 }}>
                  I detta läge (Anpassa aktivt) kan du dra ⠿⠿-handtagen för att flytta fält – släpp på ett ensamt fält för att dela raden, eller på ett redan ihopparat fält för att byta plats. Stäng Anpassa när du är klar så går fälten tillbaka till normalt loggningsläge utan drag.
                </div>
              </div>
            )}

            <div className="card-body">
              <form onSubmit={handleSave}>
                {fieldRows.map(row => {
                  const cells = row.map(id => ({ id, content: renderField(id) })).filter(c => c.content)
                  if (cells.length === 0) return null
                  return (
                    <div key={row.join('-')} style={{
                      display: 'grid',
                      gridTemplateColumns: cells.length === 2 ? '1fr 1fr' : '1fr',
                      gap: 12,
                    }}>
                      {cells.map(({ id, content }) => {
                        const isDragging = draggingField === id
                        const hint = dropHint?.id === id ? dropHint.mode : null
                        const isRequired = requiredFields.includes(id)
                        const missing = isRequired && !isFieldFilled(id)
                        return (
                          <div key={id}
                            draggable={showFieldMgr}
                            onDragStart={e => showFieldMgr && onFieldDragStart(e, id)}
                            onDragOver={e => showFieldMgr && onFieldDragOver(e, id)}
                            onDragEnd={() => showFieldMgr && onFieldDragEnd()}
                            style={{
                              position: 'relative',
                              opacity: isDragging ? 0.35 : 1,
                              transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                              transition: 'opacity 0.15s, transform 0.15s',
                              outline: showFieldMgr && (hint === 'pair' || hint === 'swap') ? '2px dashed var(--accent)' : '2px solid transparent',
                              outlineOffset: 4,
                              borderRadius: 'var(--r2)',
                              boxShadow: missing ? 'inset 2px 0 0 0 var(--red)' : 'none',
                            }}
                          >
                            {showFieldMgr && hint === 'before' && (
                              <div style={{ position: 'absolute', top: -8, left: 0, right: 0, height: 3, background: 'var(--accent)', borderRadius: 3, zIndex: 10, boxShadow: '0 0 8px rgba(0,212,170,0.6)' }} />
                            )}
                            {showFieldMgr && hint === 'after' && (
                              <div style={{ position: 'absolute', bottom: -8, left: 0, right: 0, height: 3, background: 'var(--accent)', borderRadius: 3, zIndex: 10, boxShadow: '0 0 8px rgba(0,212,170,0.6)' }} />
                            )}
                            {showFieldMgr && (
                              <div style={{
                                position: 'absolute', top: 0, right: 2, zIndex: 5,
                                color: 'var(--text4)', fontSize: 12, cursor: 'grab',
                                opacity: 0.5, userSelect: 'none', lineHeight: 1,
                              }} title="Dra för att flytta">⠿⠿</div>
                            )}
                            {content}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || missingRequiredFields.length > 0}>
                    {saving ? 'Sparar…' : editingId ? '💾 Spara ändringar' : '🔖 Spara trade'}
                  </button>
                  {editingId && <button type="button" className="btn btn-ghost" onClick={resetForm}>Avbryt</button>}
                </div>
                {missingRequiredFields.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
                    Fyll i: {missingRequiredFields.map(id => FIELD_LABELS[id] || id).join(', ')}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Journal ({trades.length})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(trades)}>⬇ CSV</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
              ) : trades.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga trades loggade ännu.</div>
              ) : (
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Datum</th><th>Symbol</th><th>Dir</th><th>Entry</th>
                      <th>SL</th><th>TP</th><th>Utfall</th><th>R</th>
                      <th>Grade</th><th>Strategi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(t => (
                      <tr key={t.id} onClick={() => setSelectedModal(t)}>
                        <td className="mono">{t.date}</td>
                        <td><strong style={{ color: 'var(--text)' }}>{t.symbol || '—'}</strong></td>
                        <td>{t.direction ? <span className={`badge badge-${t.direction}`}>{t.direction}</span> : '—'}</td>
                        <td className="mono">{t.entry ?? '—'}</td>
                        <td className="mono">{t.sl ?? '—'}</td>
                        <td className="mono">{t.tp ?? '—'}</td>
                        <td>{t.outcome ? <span className={`badge badge-${t.outcome}`}>{t.outcome}</span> : '—'}</td>
                        <td className={t.result > 0 ? 'r-pos' : t.result < 0 ? 'r-neg' : 'r-neu'}>{formatR(t.result)}</td>
                        <td style={{ fontWeight: 700, color: gradeColor(t.grade) }}>{t.grade || '—'}</td>
                        <td style={{ color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.strategy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedModal && (
        <div className="modal-backdrop open" onClick={e => e.target === e.currentTarget && setSelectedModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{selectedModal.symbol} · {selectedModal.date}</div>
              <button className="modal-close" onClick={() => setSelectedModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  ['Strategi', selectedModal.strategy],
                  ['Riktning', selectedModal.direction],
                  ['Entry', selectedModal.entry],
                  ['Stop Loss', selectedModal.sl],
                  ['Take Profit', selectedModal.tp],
                  ['Faktisk exit', selectedModal.custom_data?._actual_exit],
                  ['Utfall', selectedModal.outcome],
                  ['R', formatR(selectedModal.result)],
                  ['Grade', selectedModal.grade],
                  ['Emotion', selectedModal.emotion],
                  ['Risk $', selectedModal.risk_amount ? '$' + Number(selectedModal.risk_amount).toFixed(2) : null],
                ].filter(([, v]) => v != null && v !== '').map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {selectedModal.custom_data?._scaleIns?.length > 0 && (
                <div style={{ marginBottom: 10, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Scale-in entries</div>
                  {selectedModal.custom_data._scaleIns.map((s, i) => (
                    <div key={i} style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Entry {i + 2}: {s.price} · {s.contracts} ktr</div>
                  ))}
                  <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                    Weighted: {selectedModal.custom_data._weightedEntry} · Total: {selectedModal.custom_data._totalContracts} ktr
                  </div>
                </div>
              )}

              {selectedModal.custom_data?._targets?.length > 0 && (
                <div style={{ marginBottom: 10, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Targets</div>
                  {selectedModal.custom_data._targets.map((t, i) => (
                    <div key={i} style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>TP {i + 2}: {t.price} · {t.contracts} ktr</div>
                  ))}
                </div>
              )}

              {selectedModal.notes && (
                <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {selectedModal.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(selectedModal)}>✏️ Redigera</button>
                <button onClick={() => deleteTrade(selectedModal.id)}
                  style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  🗑 Ta bort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function exportCSV(trades) {
  const headers = ['date','time','symbol','direction','entry','sl','tp','outcome','result','grade','emotion','strategy','notes','risk_amount']
  const rows = trades.map(t => headers.map(h => {
    const v = t[h]
    if (v == null) return ''
    if (typeof v === 'string' && v.includes(',')) return `"${v}"`
    return v
  }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `tradelog_${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}
