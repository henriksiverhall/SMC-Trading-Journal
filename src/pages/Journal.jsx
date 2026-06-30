import { useEffect, useState, useRef, useCallback } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EMOTIONS, GRADES, getFuturesSpec, gradeColor, formatR, WORKER_URL } from '../lib/constants'
import { normalizeTrades } from '../lib/tradeUtils'
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
  ['exit_date', 'exit_time'],
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
  exit_date: 'Exit datum', exit_time: 'Exit tid (ET)',
  outcome: 'Utfall', risk_pct: 'Risk %', account_size: 'Kontostorlek', grade: 'Grade',
  emotion: 'Känsla', chart: 'Chart/Skärmbild', notes: 'Noteringar',
}

// Förvalda taggar för chart-länkar/bilder. "Egen…" låter användaren skriva fritext.
const CHART_TAGS = ['4h', '1h', '15m', '5m', '1m', 'Entry', 'SL', 'TP', 'Exit', 'Övrigt']

function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_FIELD_ROWS
  const seen = new Set()
  const cleaned = []
  for (const row of rows) {
    const r = (Array.isArray(row) ? row : [row]).filter(id => ALL_FIELD_IDS.includes(id) && !seen.has(id))
    r.forEach(id => seen.add(id))
    if (r.length) cleaned.push(r)
  }
  const missing = ALL_FIELD_IDS.filter(id => !seen.has(id))
  missing.forEach(id => cleaned.push([id]))
  return cleaned
}

function getCustomFields() {
  try { return JSON.parse(localStorage.getItem('tl_custom_fields')) || [] }
  catch { return [] }
}
function setCustomFields(fields) { localStorage.setItem('tl_custom_fields', JSON.stringify(fields)) }

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  time: '',
  symbol: '',
  direction: '',
  entry: '',
  sl: '',
  tp: '',
  actual_exit: '',
  exit_date: '',
  exit_time: '',
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

export default function Journal() {
  const { user, userSettings, saveSettings, impersonating } = useAuth()
  const effectiveUserId = impersonating?.id ?? user?.id
  const [trades, setTrades] = useState([])
  const [filter, setFilter] = useState({ outcome: '', direction: '', strategy: '', dateFrom: '', dateTo: '' })
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const [checklistStrategies, setChecklistStrategies] = useState([])

  function toggleSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))
  }

  function SortArrow({ col }) {
    if (sort.col !== col) return null
    return <span style={{ fontSize: 10, marginLeft: 3 }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
  }
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
  const [dropHint, setDropHint] = useState(null)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const formRef = useRef(null)

  // ── Chart links/images (multiimage) state ─────────────────────────────────
  const [chartLinks, setChartLinks] = useState([]) // [{ id, url, tag, type: 'link'|'image' }]
  const [chartUrlInput, setChartUrlInput] = useState('')
  const [chartTagInput, setChartTagInput] = useState(CHART_TAGS[0])
  const [chartCustomTag, setChartCustomTag] = useState('')
  const [chartBusy, setChartBusy] = useState(false)
  const [chartError, setChartError] = useState('')
  const fileInputRef = useRef(null)

  function resolveChartTag() {
    return chartTagInput === '__custom__' ? (chartCustomTag.trim() || 'Övrigt') : chartTagInput
  }

  async function getAuthHeader() {
    const { data } = await sb.auth.getSession()
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function addChartFromUrl() {
    const trimmed = chartUrlInput.trim()
    if (!trimmed) return
    setChartBusy(true); setChartError('')
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WORKER_URL}/trade-images/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Kunde inte spara bilden')
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: data.url, tag: resolveChartTag(), type: 'image' }])
      setChartUrlInput(''); setChartCustomTag('')
    } catch (e) {
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: trimmed, tag: resolveChartTag(), type: 'link' }])
      setChartError(`Kunde inte ladda ner bilden automatiskt (${e.message}) – sparad som länk istället.`)
      setChartUrlInput(''); setChartCustomTag('')
    } finally {
      setChartBusy(false)
    }
  }

  async function addChartFromFile(file) {
    if (!file) return
    setChartBusy(true); setChartError('')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result.split(',')[1])
        r.onerror = () => reject(new Error('Kunde inte läsa filen'))
        r.readAsDataURL(file)
      })
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WORKER_URL}/trade-images/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ base64, mimeType: file.type || 'image/png' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Kunde inte spara bilden')
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: data.url, tag: resolveChartTag(), type: 'image' }])
      setChartCustomTag('')
    } catch (e) {
      setChartError(`Uppladdning misslyckades: ${e.message}`)
    } finally {
      setChartBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeChartLink(id) {
    setChartLinks(l => l.filter(c => c.id !== id))
  }

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
    if (id === 'chart') return chartLinks.length > 0
    const key = FIELD_FORM_KEY[id] || id
    const v = form[key]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }

  useEffect(() => {
    if (!user) return
    loadTrades()
    setForm(f => ({
      ...f,
      strategy: userSettings?.lastJournalStrategy || f.strategy,
      risk_pct: userSettings?.riskPct ? String(userSettings.riskPct) : f.risk_pct,
      account_size: userSettings?.accountSize ? String(userSettings.accountSize) : f.account_size,
    }))
    sb.from('checklists').select('name').eq('user_id', effectiveUserId).order('created_at')
      .then(({ data }) => { if (data) setChecklistStrategies(data.map(c => c.name)) })
    if (!impersonating) {
      const bc = new BroadcastChannel('tradelog')
      bc.onmessage = e => { if (e.data?.type === 'trade_saved') loadTrades() }
      return () => bc.close()
    }
  }, [effectiveUserId])

  async function loadTrades() {
    const { data } = await sb.from('trades').select('*').eq('user_id', effectiveUserId).order('date', { ascending: false })
    setTrades(normalizeTrades(data || []))
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

  function addScaleIn() { setScaleIns(s => [...s, EMPTY_SCALE()]) }
  function removeScaleIn(id) { const n = scaleIns.filter(s => s.id !== id); setScaleIns(n); recalc(form, n, targets) }
  function updateScaleIn(id, field, val) { const n = scaleIns.map(s => s.id === id ? { ...s, [field]: val } : s); setScaleIns(n); recalc(form, n, targets) }

  function addTarget() { setTargets(t => [...t, EMPTY_TARGET()]) }
  function removeTarget(id) { const n = targets.filter(t => t.id !== id); setTargets(n); recalc(form, scaleIns, n) }
  function updateTarget(id, field, val) { const n = targets.map(t => t.id === id ? { ...t, [field]: val } : t); setTargets(n); recalc(form, scaleIns, n) }

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

  const spec = getFuturesSpec(form.symbol)
  const weightedEntry = getWeightedEntry(form, scaleIns)
  const riskPct = parseFloat(form.risk_pct)
  const accountSize = parseFloat(form.account_size)
  const riskDollar = (riskPct && accountSize) ? parseFloat((accountSize * riskPct / 100).toFixed(2)) : null
  const missingRequiredFields = requiredFields.filter(id => !isFieldFilled(id))

  async function handleSave(e) {
    e.preventDefault()
    if (missingRequiredFields.length > 0) { setAttemptedSave(true); return }
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
        ...(form.exit_date ? { _exit_date: form.exit_date } : {}),
        ...(form.exit_time ? { _exit_time: form.exit_time } : {}),
        ...(scaleIns.length > 0 ? { _scaleIns: scaleIns, _totalContracts: totalC, _weightedEntry: entry } : {}),
        ...(targets.length > 0 ? { _targets: targets } : {}),
        ...(riskPct ? { _risk_pct: riskPct } : {}),
        ...(accountSize ? { _account_size: accountSize } : {}),
        ...(chartLinks.length > 0 ? { _chartLinks: chartLinks } : {}),
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
    setChartLinks([]); setChartUrlInput(''); setChartCustomTag(''); setChartError('')
    setAttemptedSave(false)
    setEditingId(null)
  }

  function startEdit(trade) {
    setSelectedModal(null); setEditingId(trade.id)
    const cd = trade.custom_data || {}
    setScaleIns(cd._scaleIns || [])
    setTargets(cd._targets || [])
    setChartLinks(Array.isArray(cd._chartLinks) ? cd._chartLinks : (trade.chart_link ? [{ id: crypto.randomUUID(), url: trade.chart_link, tag: 'Övrigt', type: 'link' }] : []))
    setChartError('')
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
      exit_date: cd._exit_date ?? '',
      exit_time: cd._exit_time ?? '',
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

  function reqMark(id) {
    return requiredFields.includes(id) ? <span style={{ color: 'var(--red)', marginLeft: 4, fontWeight: 700 }}>*</span> : null
  }

  function renderField(id) {
    switch (id) {
      case 'strategy':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Strategi{reqMark('strategy')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>sparas automatiskt</span></label>
            {checklistStrategies.length > 0 ? (
              <>
                <select className="form-control" value={checklistStrategies.includes(form.strategy) ? form.strategy : form.strategy ? '__custom__' : ''}
                  onChange={e => updateForm('strategy', e.target.value === '__custom__' ? '' : e.target.value)}>
                  <option value="">Välj strategi…</option>
                  {checklistStrategies.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">Skriv in egen…</option>
                </select>
                {(form.strategy && !checklistStrategies.includes(form.strategy)) && (
                  <input type="text" className="form-control" style={{ marginTop: 6 }} placeholder="Ange strategi"
                    value={form.strategy} onChange={e => updateForm('strategy', e.target.value)} />
                )}
              </>
            ) : (
              <input type="text" className="form-control" placeholder="ICT Unicorn, Trend Pullback…"
                value={form.strategy} onChange={e => updateForm('strategy', e.target.value)} />
            )}
          </div>
        )
      case 'date':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Datum{reqMark('date')}</label>
            <input type="date" className="form-control" value={form.date} onChange={e => updateForm('date', e.target.value)} />
          </div>
        )
      case 'time':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Tid (ET){reqMark('time')}</label>
            <input type="time" className="form-control" value={form.time} onChange={e => updateForm('time', e.target.value)} />
          </div>
        )
      case 'symbol':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Instrument{reqMark('symbol')}</label>
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
            <label className="form-label">Riktning{reqMark('direction')}</label>
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
            <label className="form-label">Entry{reqMark('entry')}</label>
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
            <label className="form-label">Kontrakt{reqMark('contracts')}</label>
            <input type="number" step="1" min="1" className="form-control" placeholder="1"
              value={form.contracts} onChange={e => updateForm('contracts', e.target.value)} />
          </div>
        )
      case 'sl':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Stop Loss{reqMark('sl')}</label>
            <input type="number" step="0.01" className="form-control" placeholder="0.00"
              value={form.sl} onChange={e => updateForm('sl', e.target.value)} />
          </div>
        )
      case 'tp':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Take Profit 1{reqMark('tp')}</label>
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
            <label className="form-label">Faktisk exit{reqMark('actual_exit')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
            <input type="number" step="0.01" className="form-control" placeholder="Om ej exakt TP/SL"
              value={form.actual_exit} onChange={e => updateForm('actual_exit', e.target.value)} />
          </div>
        )
      case 'exit_date':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Exit datum{reqMark('exit_date')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
            <input type="date" className="form-control" value={form.exit_date} onChange={e => updateForm('exit_date', e.target.value)} />
          </div>
        )
      case 'exit_time':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Exit tid (ET){reqMark('exit_time')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
            <input type="time" className="form-control" value={form.exit_time} onChange={e => updateForm('exit_time', e.target.value)} />
          </div>
        )
      case 'outcome':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Utfall{reqMark('outcome')}</label>
            <select className="form-control" value={form.outcome} onChange={e => updateForm('outcome', e.target.value)}>
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
            <label className="form-label">Risk % av konto{reqMark('risk_pct')}</label>
            <input type="number" step="0.1" min="0" className="form-control" placeholder="0.5"
              value={form.risk_pct} onChange={e => updateForm('risk_pct', e.target.value)} />
          </div>
        )
      case 'account_size':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Kontostorlek{reqMark('account_size')}</label>
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
            <label className="form-label">Grade{reqMark('grade')}</label>
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
            <label className="form-label">Känsla{reqMark('emotion')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>valfritt</span></label>
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
            <label className="form-label">Chart / Skärmbilder{reqMark('chart')} <span style={{ color: 'var(--text4)', textTransform: 'none', letterSpacing: 0 }}>flera, med tagg</span></label>

            {chartLinks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, marginBottom: 10 }}>
                {chartLinks.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border2)' }}>
                    {c.type === 'image' ? (
                      <img src={c.url} alt={c.tag} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border2)' }} />
                    ) : (
                      <span style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>🔗</span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>{c.tag}</span>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{c.url}</a>
                    <button type="button" onClick={() => removeChartLink(c.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select className="form-control" style={{ flex: 1 }} value={chartTagInput} onChange={e => setChartTagInput(e.target.value)}>
                {CHART_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Egen tagg…</option>
              </select>
              {chartTagInput === '__custom__' && (
                <input type="text" className="form-control" style={{ flex: 1 }} placeholder="Taggnamn"
                  value={chartCustomTag} onChange={e => setChartCustomTag(e.target.value)} />
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input type="url" className="form-control" placeholder="Länk till TradingView-bild eller annan chart-URL…"
                value={chartUrlInput} onChange={e => setChartUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChartFromUrl() } }} />
              <button type="button" className="btn btn-ghost btn-sm" disabled={chartBusy || !chartUrlInput.trim()} onClick={addChartFromUrl}>
                {chartBusy ? '…' : '+ Lägg till'}
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => addChartFromFile(e.target.files?.[0])} />
              <button type="button" className="btn btn-ghost btn-sm" disabled={chartBusy} style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}>
                📤 Ladda upp skärmbild från datorn
              </button>
            </div>

            {chartError && (
              <div style={{ fontSize: 11, color: 'var(--amber, #f59e0b)', marginTop: 6 }}>{chartError}</div>
            )}
          </div>
        )
      case 'notes':
        return (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Noteringar{reqMark('notes')}</label>
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
      <Topbar title={editingId ? 'Journal – Redigerar' : 'Journal'} subtitle={impersonating ? `👁 Visar: ${impersonating.email}` : undefined} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'clamp(420px, 27vw, 520px) 1fr', gap: 20, alignItems: 'start' }}>

          <div className="card" style={{
            position: 'sticky',
            top: 'calc(var(--topbar-h) + 24px)',
            maxHeight: 'calc(100vh - var(--topbar-h) - 48px)',
            overflowY: 'auto',
          }} ref={formRef}>
            <div className="card-header">
              <div className="card-title">{editingId ? '✏️ Redigera trade' : 'Log Trade'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFieldMgr(m => !m)} title="Hantera fält"
                  style={showFieldMgr ? { background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.4)', color: 'var(--accent)' } : undefined}>
                  ⚙ Anpassa
                </button>
              </div>
            </div>

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
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                    {saving ? 'Sparar…' : editingId ? '💾 Spara ändringar' : '🔖 Spara trade'}
                  </button>
                  {editingId && <button type="button" className="btn btn-ghost" onClick={resetForm}>Avbryt</button>}
                </div>
                {attemptedSave && missingRequiredFields.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
                    Fyll i: {missingRequiredFields.map(id => FIELD_LABELS[id] || id).join(', ')}
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Journal ({trades.length})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(trades)}>⬇ CSV</button>
            </div>

            {trades.length > 0 && (() => {
              const strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))].sort()
              return (
                <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="form-control" style={{ width: 'auto', fontSize: 12 }}
                    value={filter.outcome} onChange={e => setFilter(f => ({ ...f, outcome: e.target.value }))}>
                    <option value="">Alla utfall</option>
                    <option value="W">Win</option>
                    <option value="L">Loss</option>
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
                  <input type="date" className="form-control" style={{ width: 'auto', fontSize: 12 }}
                    value={filter.dateFrom} onChange={e => setFilter(f => ({ ...f, dateFrom: e.target.value }))} title="Från datum" />
                  <span style={{ fontSize: 11, color: 'var(--text4)' }}>–</span>
                  <input type="date" className="form-control" style={{ width: 'auto', fontSize: 12 }}
                    value={filter.dateTo} onChange={e => setFilter(f => ({ ...f, dateTo: e.target.value }))} title="Till datum" />
                  {(filter.outcome || filter.direction || filter.strategy || filter.dateFrom || filter.dateTo) && (
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setFilter({ outcome: '', direction: '', strategy: '', dateFrom: '', dateTo: '' })}>
                      ✕ Rensa
                    </button>
                  )}
                  {(() => {
                    const n = trades.filter(t => {
                      if (filter.outcome && t.outcome !== filter.outcome) return false
                      if (filter.direction && t.direction !== filter.direction) return false
                      if (filter.strategy && t.strategy !== filter.strategy) return false
                      if (filter.dateFrom && t.date < filter.dateFrom) return false
                      if (filter.dateTo && t.date > filter.dateTo) return false
                      return true
                    }).length
                    return n !== trades.length
                      ? <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{n} av {trades.length} trades</span>
                      : <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 'auto' }}>{trades.length} trades</span>
                  })()}
                </div>
              )
            })()}

            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>
              ) : trades.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga trades loggade ännu.</div>
              ) : (() => {
                const filteredTrades = trades.filter(t => {
                  if (filter.outcome && t.outcome !== filter.outcome) return false
                  if (filter.direction && t.direction !== filter.direction) return false
                  if (filter.strategy && t.strategy !== filter.strategy) return false
                  if (filter.dateFrom && t.date < filter.dateFrom) return false
                  if (filter.dateTo && t.date > filter.dateTo) return false
                  return true
                }).sort((a, b) => {
                  const dir = sort.dir === 'asc' ? 1 : -1
                  const av = a[sort.col] ?? ''
                  const bv = b[sort.col] ?? ''
                  if (sort.col === 'result' || sort.col === 'entry' || sort.col === 'sl' || sort.col === 'tp') {
                    return (parseFloat(av) - parseFloat(bv)) * dir
                  }
                  return av < bv ? -dir : av > bv ? dir : 0
                })
                return (
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('date')}>Datum{SortArrow({col:'date'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('symbol')}>Symbol{SortArrow({col:'symbol'})}</th>
                      <th>Dir</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('entry')}>Entry{SortArrow({col:'entry'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('sl')}>SL{SortArrow({col:'sl'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('tp')}>TP{SortArrow({col:'tp'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('outcome')}>Utfall{SortArrow({col:'outcome'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('result')}>R{SortArrow({col:'result'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('grade')}>Grade{SortArrow({col:'grade'})}</th>
                      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }} onClick={()=>toggleSort('strategy')}>Strategi{SortArrow({col:'strategy'})}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map(t => (
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
                )
              })()}
            </div>
          </div>
        </div>
      </div>

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
                  ['Exit datum', selectedModal.custom_data?._exit_date],
                  ['Exit tid', selectedModal.custom_data?._exit_time],
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

              {Array.isArray(selectedModal.custom_data?._chartLinks) && selectedModal.custom_data._chartLinks.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 8, fontSize: 12 }}>Charts</div>
                  {Object.entries(
                    selectedModal.custom_data._chartLinks.reduce((acc, c) => {
                      ;(acc[c.tag] = acc[c.tag] || []).push(c)
                      return acc
                    }, {})
                  ).map(([tag, items]) => (
                    <div key={tag} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{tag}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {items.map(c => (
                          <a key={c.id} href={c.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                            {c.type === 'image' ? (
                              <img src={c.url} alt={tag} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 'var(--r)', border: '1px solid var(--border2)' }} />
                            ) : (
                              <div style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r)', border: '1px dashed var(--border2)', fontSize: 22 }}>🔗</div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
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
