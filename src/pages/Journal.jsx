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
}

export default function Journal() {
  const { user, userSettings } = useAuth()
  const [trades, setTrades] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calcR, setCalcR] = useState(null)
  const [selectedModal, setSelectedModal] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    if (!user) return
    loadTrades()
    // Restore last strategy
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
      computeR(next)
      return next
    })
  }

  function computeR(f) {
    const entry = parseFloat(f.entry)
    const sl = parseFloat(f.sl)
    const tp = parseFloat(f.tp)
    const risk = Math.abs(entry - sl)
    if (!entry || !sl || isNaN(entry) || isNaN(sl) || risk === 0) { setCalcR(null); return }
    if (f.outcome === 'BE') { setCalcR(0); return }
    if (f.outcome === 'W' && tp && !isNaN(tp)) { setCalcR(parseFloat((Math.abs(tp - entry) / risk).toFixed(2))); return }
    if (f.outcome === 'L') { setCalcR(-1); return }
    setCalcR(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.outcome) return
    setSaving(true)
    const spec = getFuturesSpec(form.symbol)
    const trade = {
      user_id: user.id,
      date: form.date || new Date().toISOString().split('T')[0],
      time: form.time || null,
      symbol: form.symbol || null,
      direction: form.direction || null,
      entry: parseFloat(form.entry) || null,
      sl: parseFloat(form.sl) || null,
      tp: parseFloat(form.tp) || null,
      outcome: form.outcome,
      result: calcR,
      grade: form.grade || null,
      emotion: form.emotion || null,
      strategy: form.strategy || null,
      notes: form.notes || null,
      checklist_pct: 0,
      custom_data: spec ? { _futures: true } : {},
    }
    const { error } = await sb.from('trades').insert(trade)
    if (!error) {
      // Save last strategy
      if (form.strategy) {
        await sb.from('user_settings').upsert({
          user_id: user.id,
          settings: { ...userSettings, lastJournalStrategy: form.strategy },
          updated_at: new Date().toISOString()
        })
      }
      setForm(f => ({ ...DEFAULT_FORM, strategy: f.strategy, date: f.date }))
      setCalcR(null)
      loadTrades()
    }
    setSaving(false)
  }

  const spec = getFuturesSpec(form.symbol)
  const rColor = calcR > 0 ? 'var(--green)' : calcR < 0 ? 'var(--red)' : 'var(--text3)'

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Journal" />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Trade form */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 24px)' }}>
            <div className="card-header">
              <div className="card-title">Log Trade</div>
              {calcR != null && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: rColor }}>
                  {calcR > 0 ? '+' : ''}{calcR.toFixed(2)}R
                </div>
              )}
            </div>
            <div className="card-body">
              <form onSubmit={handleSave} ref={formRef}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-control" value={form.date} onChange={e => updateForm('date', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time (ET)</label>
                    <input type="time" className="form-control" value={form.time} onChange={e => updateForm('time', e.target.value)} />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Strategy</label>
                    <input type="text" className="form-control" placeholder="ICT Unicorn, Trend Pullback…"
                      value={form.strategy} onChange={e => updateForm('strategy', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Symbol</label>
                    <input type="text" className="form-control" placeholder="MNQ, EURUSD…"
                      value={form.symbol} onChange={e => updateForm('symbol', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Direction</label>
                    <select className="form-control" value={form.direction} onChange={e => updateForm('direction', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                    </select>
                  </div>

                  {spec && (
                    <div style={{ gridColumn: 'span 2', background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, color: 'var(--accent)' }}>
                      🔷 {spec.name} · ${spec.pointValue}/point · {spec.exchange}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Entry</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00"
                      value={form.entry} onChange={e => updateForm('entry', e.target.value)} />
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
                    <label className="form-label">Outcome</label>
                    <select className="form-control" value={form.outcome} onChange={e => updateForm('outcome', e.target.value)} required>
                      <option value="">Select…</option>
                      <option value="W">Win</option>
                      <option value="L">Loss</option>
                      <option value="BE">Break Even</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Grade</label>
                    <div className="grade-btns">
                      {GRADES.map(g => (
                        <button key={g} type="button" className={`grade-btn ${form.grade === g ? 'sel' : ''}`}
                          onClick={() => updateForm('grade', form.grade === g ? '' : g)}>
                          {g}
                        </button>
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
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={3} placeholder="What worked? What to improve?"
                      value={form.notes} onChange={e => updateForm('notes', e.target.value)}
                      style={{ resize: 'vertical' }} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 16, justifyContent: 'center' }} disabled={saving || !form.outcome}>
                  {saving ? 'Saving…' : '+ Save Trade'}
                </button>
              </form>
            </div>
          </div>

          {/* Journal table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Trade Journal ({trades.length})</div>
              <button className="btn btn-ghost btn-sm">⬇ CSV</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
              ) : trades.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  No trades logged yet. Use the form to log your first trade.
                </div>
              ) : (
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Symbol</th>
                      <th>Dir</th>
                      <th>Entry</th>
                      <th>SL</th>
                      <th>TP</th>
                      <th>Outcome</th>
                      <th>R</th>
                      <th>Grade</th>
                      <th>Emotion</th>
                      <th>Strategy</th>
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
                        <td style={{ fontSize: 11 }}>{t.emotion || '—'}</td>
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

      {/* Trade detail modal */}
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
                  ['Strategy', selectedModal.strategy],
                  ['Direction', selectedModal.direction],
                  ['Entry', selectedModal.entry],
                  ['Stop Loss', selectedModal.sl],
                  ['Take Profit', selectedModal.tp],
                  ['Outcome', selectedModal.outcome],
                  ['R', formatR(selectedModal.result)],
                  ['Grade', selectedModal.grade],
                  ['Emotion', selectedModal.emotion],
                  ['Checklist %', selectedModal.checklist_pct != null ? selectedModal.checklist_pct + '%' : null],
                ].filter(([, v]) => v != null && v !== '').map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: typeof val === 'number' ? 'var(--mono)' : 'inherit' }}>{val}</div>
                  </div>
                ))}
              </div>
              {selectedModal.notes && (
                <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {selectedModal.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
