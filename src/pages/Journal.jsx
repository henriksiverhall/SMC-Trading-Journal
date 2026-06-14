import { useEffect, useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EMOTIONS, GRADES, getFuturesSpec, gradeColor, formatR } from '../lib/constants'
import Topbar from '../components/Topbar'

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  time: '',
  symbol: '',
  direction: '',
  entry: '',
  sl: '',
  tp: '',
  outcome: '',
  grade: '',
  emotion: '',
  notes: '',
  strategy: '',
  contracts: '1',
}

const EMPTY_SCALE = () => ({ id: crypto.randomUUID(), price: '', contracts: '1' })
const EMPTY_PARTIAL = () => ({ id: crypto.randomUUID(), price: '', contracts: '' })

export default function Journal() {
  const { user, userSettings } = useAuth()
  const [trades, setTrades] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calcR, setCalcR] = useState(null)
  const [calcUSD, setCalcUSD] = useState(null)
  const [selectedModal, setSelectedModal] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [scaleIns, setScaleIns] = useState([])
  const [partialExits, setPartialExits] = useState([])
  const formRef = useRef(null)

  useEffect(() => {
    if (!user) return
    loadTrades()
    if (userSettings?.lastJournalStrategy) {
      setForm(f => ({ ...f, strategy: userSettings.lastJournalStrategy }))
    }
  }, [user])

  async function loadTrades() {
    const { data } = await sb.from('trades').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  function updateForm(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value }
      computeR(next, scaleIns, partialExits)
      return next
    })
  }

  // ── Scale-in helpers ──────────────────────────────────────────────────────
  function addScaleIn() { setScaleIns(s => [...s, EMPTY_SCALE()]) }
  function removeScaleIn(id) {
    const next = scaleIns.filter(s => s.id !== id)
    setScaleIns(next)
    computeR(form, next, partialExits)
  }
  function updateScaleIn(id, field, val) {
    const next = scaleIns.map(s => s.id === id ? { ...s, [field]: val } : s)
    setScaleIns(next)
    computeR(form, next, partialExits)
  }

  function getWeightedEntry(f, scales) {
    const baseEntry = parseFloat(f.entry)
    const baseContracts = parseFloat(f.contracts) || 1
    if (!baseEntry || isNaN(baseEntry)) return null
    const entries = [{ price: baseEntry, contracts: baseContracts }]
    for (const s of scales) {
      const p = parseFloat(s.price)
      const c = parseFloat(s.contracts) || 1
      if (p && !isNaN(p)) entries.push({ price: p, contracts: c })
    }
    if (entries.length === 1) return baseEntry
    const totalContracts = entries.reduce((a, e) => a + e.contracts, 0)
    const weighted = entries.reduce((a, e) => a + e.price * e.contracts, 0) / totalContracts
    return parseFloat(weighted.toFixed(4))
  }

  function getTotalContracts(f, scales) {
    const base = parseFloat(f.contracts) || 1
    return base + scales.reduce((a, s) => a + (parseFloat(s.contracts) || 1), 0)
  }

  // ── Partial exit helpers ──────────────────────────────────────────────────
  function addPartialExit() { setPartialExits(p => [...p, EMPTY_PARTIAL()]) }
  function removePartialExit(id) {
    const next = partialExits.filter(p => p.id !== id)
    setPartialExits(next)
    computeR(form, scaleIns, next)
  }
  function updatePartialExit(id, field, val) {
    const next = partialExits.map(p => p.id === id ? { ...p, [field]: val } : p)
    setPartialExits(next)
    computeR(form, scaleIns, next)
  }

  // ── R computation ─────────────────────────────────────────────────────────
  function computeR(f, scales, partials) {
    const entry = getWeightedEntry(f, scales)
    const sl    = parseFloat(f.sl)
    const tp    = parseFloat(f.tp)
    const spec  = getFuturesSpec(f.symbol)
    const totalContracts = scales.length > 0 ? getTotalContracts(f, scales) : (parseFloat(f.contracts) || 1)

    if (!entry || !sl || isNaN(entry) || isNaN(sl)) { setCalcR(null); setCalcUSD(null); return }
    // risk = distance entry→SL in points (always positive)
    const risk = Math.abs(entry - sl)
    if (risk === 0) { setCalcR(null); setCalcUSD(null); return }

    let r = null

    if (f.outcome === 'BE') {
      r = 0
    } else if (f.outcome === 'L') {
      r = -1
    } else if (f.outcome === 'W') {
      if (partials.length > 0) {
        // Partial exits: R per exit = |exitPrice - entry| / risk (always positive for wins)
        const validPartials = partials.filter(p => p.price && p.contracts)
        if (validPartials.length > 0) {
          let totalR = 0, totalQty = 0
          for (const p of validPartials) {
            const pQty   = parseFloat(p.contracts) || 0
            const pPrice = parseFloat(p.price)
            if (!pPrice || !pQty) continue
            const pR = Math.abs(pPrice - entry) / risk
            totalR   += pR * pQty
            totalQty += pQty
          }
          r = totalQty > 0 ? parseFloat((totalR / totalQty).toFixed(2)) : null
        }
      } else if (tp && !isNaN(tp)) {
        // R = |TP - entry| / risk — direction-agnostic, always positive for a win
        r = parseFloat((Math.abs(tp - entry) / risk).toFixed(2))
      }
    }

    setCalcR(r)

    // USD P&L for futures: risk (points) × pointValue × contracts × R-multiple
    if (spec && r !== null) {
      const riskUSD = risk * spec.pointValue * totalContracts
      setCalcUSD(parseFloat((r * riskUSD).toFixed(2)))
    } else {
      setCalcUSD(null)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    if (!form.outcome) return
    setSaving(true)

    const spec = getFuturesSpec(form.symbol)
    const weightedEntry = getWeightedEntry(form, scaleIns) || parseFloat(form.entry)
    const totalContracts = scaleIns.length > 0 ? getTotalContracts(form, scaleIns) : (parseFloat(form.contracts) || 1)

    const riskPerContract = spec
      ? Math.abs(weightedEntry - parseFloat(form.sl)) * spec.pointValue
      : null
    const riskAmount = riskPerContract ? riskPerContract * totalContracts : null

    const trade = {
      user_id: user.id,
      date: form.date || new Date().toISOString().split('T')[0],
      time: form.time || null,
      symbol: form.symbol || null,
      direction: form.direction || null,
      entry: weightedEntry || null,
      sl: parseFloat(form.sl) || null,
      tp: parseFloat(form.tp) || null,
      outcome: form.outcome,
      result: calcR,
      grade: form.grade || null,
      emotion: form.emotion || null,
      strategy: form.strategy || null,
      notes: form.notes || null,
      checklist_pct: 0,
      risk_amount: riskAmount,
      custom_data: {
        ...(spec ? { _futures: true } : {}),
        ...(scaleIns.length > 0 ? { _scaleIns: scaleIns, _totalContracts: totalContracts, _weightedEntry: weightedEntry } : {}),
        ...(partialExits.length > 0 ? { _partialExits: partialExits } : {}),
      },
    }

    let error
    if (editingId) {
      ;({ error } = await sb.from('trades').update(trade).eq('id', editingId).eq('user_id', user.id))
    } else {
      ;({ error } = await sb.from('trades').insert(trade))
    }

    if (!error) {
      if (form.strategy) {
        await sb.from('user_settings').upsert({
          user_id: user.id,
          settings: { ...userSettings, lastJournalStrategy: form.strategy },
          updated_at: new Date().toISOString()
        })
      }
      resetForm()
      loadTrades()
    }
    setSaving(false)
  }

  function resetForm() {
    setForm(f => ({ ...DEFAULT_FORM, strategy: f.strategy, date: f.date }))
    setCalcR(null)
    setCalcUSD(null)
    setScaleIns([])
    setPartialExits([])
    setEditingId(null)
  }

  function startEdit(trade) {
    setSelectedModal(null)
    setEditingId(trade.id)
    const cd = trade.custom_data || {}
    setScaleIns(cd._scaleIns || [])
    setPartialExits(cd._partialExits || [])
    setForm({
      date: trade.date || '',
      time: trade.time || '',
      symbol: trade.symbol || '',
      direction: trade.direction || '',
      entry: trade.entry ?? '',
      sl: trade.sl ?? '',
      tp: trade.tp ?? '',
      outcome: trade.outcome || '',
      grade: trade.grade || '',
      emotion: trade.emotion || '',
      notes: trade.notes || '',
      strategy: trade.strategy || '',
      contracts: cd._totalContracts || '1',
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function deleteTrade(id) {
    if (!window.confirm('Ta bort denna trade?')) return
    await sb.from('trades').delete().eq('id', id).eq('user_id', user.id)
    setSelectedModal(null)
    loadTrades()
  }

  const spec = getFuturesSpec(form.symbol)
  const weightedEntry = getWeightedEntry(form, scaleIns)
  const rColor = calcR > 0 ? 'var(--green)' : calcR < 0 ? 'var(--red)' : 'var(--text3)'

  return (
    <div style={{ flex: 1 }}>
      <Topbar title={editingId ? 'Journal – Redigerar trade' : 'Journal'} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Form ── */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 24px)' }} ref={formRef}>
            <div className="card-header">
              <div className="card-title">{editingId ? '✏️ Redigera trade' : 'Log Trade'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {calcUSD !== null && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: calcUSD >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {calcUSD >= 0 ? '+' : ''}${Math.abs(calcUSD).toFixed(2)}
                  </div>
                )}
                {calcR !== null && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: rColor }}>
                    {calcR > 0 ? '+' : ''}{calcR.toFixed(2)}R
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                  <div className="form-group">
                    <label className="form-label">Datum</label>
                    <input type="date" className="form-control" value={form.date} onChange={e => updateForm('date', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tid (ET)</label>
                    <input type="time" className="form-control" value={form.time} onChange={e => updateForm('time', e.target.value)} />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Strategi</label>
                    <input type="text" className="form-control" placeholder="ICT Unicorn, Trend Pullback…"
                      value={form.strategy} onChange={e => updateForm('strategy', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Symbol</label>
                    <input type="text" className="form-control" placeholder="MNQ, NQ…"
                      value={form.symbol} onChange={e => updateForm('symbol', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Riktning</label>
                    <select className="form-control" value={form.direction} onChange={e => updateForm('direction', e.target.value)}>
                      <option value="">Välj…</option>
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                    </select>
                  </div>

                  {spec && (
                    <div style={{ gridColumn: 'span 2', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, color: 'var(--accent)' }}>
                      🔷 {spec.name} · ${spec.pointValue}/point · {spec.exchange}
                    </div>
                  )}

                  {/* Entry + contracts */}
                  <div className="form-group">
                    <label className="form-label">Entry</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00"
                      value={form.entry} onChange={e => updateForm('entry', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kontrakt</label>
                    <input type="number" step="1" min="1" className="form-control" placeholder="1"
                      value={form.contracts} onChange={e => updateForm('contracts', e.target.value)} />
                  </div>

                  {/* Scale-in */}
                  {scaleIns.length > 0 && (
                    <div style={{ gridColumn: 'span 2' }}>
                      {scaleIns.map((s, i) => (
                        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
                          <input type="number" step="0.01" className="form-control" placeholder={`Entry ${i + 2}`}
                            value={s.price} onChange={e => updateScaleIn(s.id, 'price', e.target.value)} />
                          <input type="number" step="1" min="1" className="form-control" placeholder="Ktr"
                            value={s.contracts} onChange={e => updateScaleIn(s.id, 'contracts', e.target.value)} />
                          <button type="button" onClick={() => removeScaleIn(s.id)}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--red)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        </div>
                      ))}
                      {weightedEntry && scaleIns.some(s => s.price) && (
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                          Weighted entry: {weightedEntry} · Total: {getTotalContracts(form, scaleIns)} ktr
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ gridColumn: 'span 2' }}>
                    <button type="button" onClick={addScaleIn}
                      style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '5px 12px', width: '100%' }}>
                      + Lägg till scale-in entry
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stop Loss</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00"
                      value={form.sl} onChange={e => updateForm('sl', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Take Profit</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00"
                      value={form.tp} onChange={e => updateForm('tp', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Utfall</label>
                    <select className="form-control" value={form.outcome} onChange={e => updateForm('outcome', e.target.value)} required>
                      <option value="">Välj…</option>
                      <option value="W">Win</option>
                      <option value="L">Loss</option>
                      <option value="BE">Break Even</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" onClick={addPartialExit}
                      style={{ background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '5px 12px', width: '100%', marginBottom: 0 }}>
                      + Partial exit
                    </button>
                  </div>

                  {/* Partial exits */}
                  {partialExits.length > 0 && (
                    <div style={{ gridColumn: 'span 2' }}>
                      {partialExits.map((p, i) => (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
                          <input type="number" step="0.01" className="form-control" placeholder={`Exit ${i + 1} pris`}
                            value={p.price} onChange={e => updatePartialExit(p.id, 'price', e.target.value)} />
                          <input type="number" step="1" min="1" className="form-control" placeholder="Ktr"
                            value={p.contracts} onChange={e => updatePartialExit(p.id, 'contracts', e.target.value)} />
                          <button type="button" onClick={() => removePartialExit(p.id)}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--red)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Grade</label>
                    <div className="grade-btns">
                      {GRADES.map(g => (
                        <button key={g} type="button" className={`grade-btn ${form.grade === g ? 'sel' : ''}`}
                          onClick={() => updateForm('grade', form.grade === g ? '' : g)}>{g}</button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Emotion</label>
                    <div className="emotion-btns">
                      {EMOTIONS.map(em => (
                        <button key={em.id} type="button" className={`emotion-btn ${form.emotion === em.id ? 'sel' : ''}`}
                          onClick={() => updateForm('emotion', form.emotion === em.id ? '' : em.id)}>
                          {em.emoji} {em.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Anteckningar</label>
                    <textarea className="form-control" rows={3} placeholder="Vad funkade? Vad förbättra?"
                      value={form.notes} onChange={e => updateForm('notes', e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !form.outcome}>
                    {saving ? 'Sparar…' : editingId ? '💾 Spara ändringar' : '+ Spara trade'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-ghost" onClick={resetForm}>Avbryt</button>
                  )}
                </div>
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
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  Inga trades loggade ännu.
                </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Strategi', selectedModal.strategy],
                  ['Riktning', selectedModal.direction],
                  ['Entry', selectedModal.entry],
                  ['Stop Loss', selectedModal.sl],
                  ['Take Profit', selectedModal.tp],
                  ['Utfall', selectedModal.outcome],
                  ['R', formatR(selectedModal.result)],
                  ['Grade', selectedModal.grade],
                  ['Emotion', selectedModal.emotion],
                  ['Risk $', selectedModal.risk_amount ? '$' + Number(selectedModal.risk_amount).toFixed(2) : null],
                  ['Checklist %', selectedModal.checklist_pct != null ? selectedModal.checklist_pct + '%' : null],
                ].filter(([, v]) => v != null && v !== '').map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Scale-in info */}
              {selectedModal.custom_data?._scaleIns?.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Scale-in entries</div>
                  {selectedModal.custom_data._scaleIns.map((s, i) => (
                    <div key={i} style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      Entry {i + 2}: {s.price} · {s.contracts} ktr
                    </div>
                  ))}
                  <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                    Weighted: {selectedModal.custom_data._weightedEntry} · Total: {selectedModal.custom_data._totalContracts} ktr
                  </div>
                </div>
              )}

              {/* Partial exits info */}
              {selectedModal.custom_data?._partialExits?.length > 0 && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>Partial exits</div>
                  {selectedModal.custom_data._partialExits.map((p, i) => (
                    <div key={i} style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      Exit {i + 1}: {p.price} · {p.contracts} ktr
                    </div>
                  ))}
                </div>
              )}

              {selectedModal.notes && (
                <div style={{ marginTop: 14, padding: 12, background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {selectedModal.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
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
