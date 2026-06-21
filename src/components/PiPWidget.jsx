import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GRADES, getFuturesSpec } from '../lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyStylesToPiP(pipDoc) {
  // Copy all <link rel="stylesheet"> and <style> tags from main document
  Array.from(document.styleSheets).forEach(sheet => {
    try {
      if (sheet.href) {
        const link = pipDoc.createElement('link')
        link.rel = 'stylesheet'; link.href = sheet.href
        pipDoc.head.appendChild(link)
      } else if (sheet.cssRules) {
        const style = pipDoc.createElement('style')
        style.textContent = Array.from(sheet.cssRules).map(r => r.cssText).join('\n')
        pipDoc.head.appendChild(style)
      }
    } catch { /* cross-origin sheets blocked, skip */ }
  })
  // Copy CSS custom properties (theme vars) from root
  const rootStyle = getComputedStyle(document.documentElement)
  const vars = Array.from(rootStyle).filter(p => p.startsWith('--'))
  if (vars.length) {
    const style = pipDoc.createElement('style')
    style.textContent = `:root{${vars.map(v => `${v}:${rootStyle.getPropertyValue(v)}`).join(';')}}`
    pipDoc.head.appendChild(style)
  }
  // Base resets so the pip window feels native
  const base = pipDoc.createElement('style')
  base.textContent = `
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:var(--font,'Inter',sans-serif);background:var(--bg);color:var(--text);font-size:14px;min-height:100vh}
    input,select,textarea{font-family:inherit}
    ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:var(--bg2)} ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
  `
  pipDoc.head.appendChild(base)
  pipDoc.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'dark')
}

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
  notes: '',
  strategy: '',
}

// ── Compact Journal form ──────────────────────────────────────────────────────
function MiniJournal({ user, activeStrategyName, onSaved }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM, strategy: activeStrategyName || '' })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    setForm(f => ({ ...f, strategy: activeStrategyName || '' }))
  }, [activeStrategyName])

  const spec = getFuturesSpec(form.symbol)
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sliderStyle = { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }
  const inputStyle = {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
    color: 'var(--text)', padding: '6px 9px', fontSize: 13, width: '100%', fontFamily: 'var(--font)',
  }

  async function handleSave() {
    if (!form.outcome) { setSavedMsg('⚠ Välj Utfall'); setTimeout(() => setSavedMsg(''), 2000); return }
    setSaving(true)
    const r_value = (form.entry && form.sl) ? (() => {
      const risk = Math.abs(parseFloat(form.entry) - parseFloat(form.sl))
      const reward = form.tp ? Math.abs(parseFloat(form.tp) - parseFloat(form.entry)) : null
      if (!reward || !risk) return null
      const rr = reward / risk
      return form.outcome === 'W' ? rr : form.outcome === 'L' ? -1 : 0
    })() : null

    const trade = {
      user_id: user.id,
      date: form.date,
      time: form.time || null,
      symbol: form.symbol || null,
      direction: form.direction || null,
      entry: form.entry ? parseFloat(form.entry) : null,
      sl: form.sl ? parseFloat(form.sl) : null,
      tp: form.tp ? parseFloat(form.tp) : null,
      outcome: form.outcome,
      grade: form.grade || null,
      notes: form.notes || null,
      result: r_value,
      strategy: form.strategy || null,
      custom_data: {},
    }
    const { error } = await sb.from('trades').insert(trade)
    setSaving(false)
    if (error) { setSavedMsg('⚠ Fel: ' + error.message); setTimeout(() => setSavedMsg(''), 3000); return }
    setSavedMsg('✓ Trade sparat!')
    setTimeout(() => setSavedMsg(''), 2000)
    setForm({ ...DEFAULT_FORM, strategy: form.strategy, date: form.date })
    if (onSaved) onSaved()
  }

  return (
    <div style={{ padding: 14, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={sliderStyle}>
          <span style={labelStyle}>Datum</span>
          <input type="date" style={inputStyle} value={form.date} onChange={e => update('date', e.target.value)} />
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Tid (ET)</span>
          <input type="time" style={inputStyle} value={form.time} onChange={e => update('time', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={sliderStyle}>
          <span style={labelStyle}>Instrument</span>
          <input style={inputStyle} placeholder="NQ, MNQ…" value={form.symbol} onChange={e => update('symbol', e.target.value)} />
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Riktning</span>
          <select style={inputStyle} value={form.direction} onChange={e => update('direction', e.target.value)}>
            <option value="">—</option>
            <option>Long</option>
            <option>Short</option>
          </select>
        </div>
      </div>

      {spec && (
        <div style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 'var(--r)', padding: '4px 8px', marginBottom: 8 }}>
          {spec.name} · ${spec.pointValue}/point
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div style={sliderStyle}>
          <span style={labelStyle}>Entry</span>
          <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={form.entry} onChange={e => update('entry', e.target.value)} />
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Stop Loss</span>
          <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={form.sl} onChange={e => update('sl', e.target.value)} />
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Take Profit</span>
          <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={form.tp} onChange={e => update('tp', e.target.value)} />
        </div>
      </div>

      <div style={sliderStyle}>
        <span style={labelStyle}>Strategi</span>
        <input style={inputStyle} placeholder="Strategi" value={form.strategy} onChange={e => update('strategy', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={sliderStyle}>
          <span style={labelStyle}>Utfall *</span>
          <select style={{ ...inputStyle, borderColor: !form.outcome ? 'var(--red)' : 'var(--border)' }}
            value={form.outcome} onChange={e => update('outcome', e.target.value)}>
            <option value="">Välj…</option>
            <option value="W">Win</option>
            <option value="L">Loss</option>
            <option value="BE">Break Even</option>
          </select>
        </div>
        <div style={sliderStyle}>
          <span style={labelStyle}>Grade</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {GRADES.map(g => (
              <button key={g} onClick={() => update('grade', form.grade === g ? '' : g)}
                style={{
                  flex: 1, padding: '6px 0', border: `1px solid ${form.grade === g ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--r)', background: form.grade === g ? 'var(--accent-dim)' : 'transparent',
                  color: form.grade === g ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={sliderStyle}>
        <span style={labelStyle}>Noteringar</span>
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} placeholder="Vad gick bra / vad kunde gjorts bättre?" value={form.notes} onChange={e => update('notes', e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--r)', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4 }}>
        {saving ? 'Sparar…' : '🔖 Spara trade'}
      </button>
      {savedMsg && <div style={{ textAlign: 'center', fontSize: 12, marginTop: 6, color: savedMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{savedMsg}</div>}
    </div>
  )
}

// ── Compact Checklist ─────────────────────────────────────────────────────────
function MiniChecklist({ user, onStrategyChange }) {
  const [checklists, setChecklists] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [checked, setChecked] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    sb.from('checklists').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
      if (data?.length) {
        setChecklists(data)
        setActiveKey(data[0].strategy_key)
        if (onStrategyChange) onStrategyChange(data[0].name)
      }
      setLoading(false)
    })
  }, [user])

  function selectStrategy(key) {
    setActiveKey(key)
    setChecked({})
    const cl = checklists.find(c => c.strategy_key === key)
    if (cl && onStrategyChange) onStrategyChange(cl.name)
  }

  const active = checklists.find(c => c.strategy_key === activeKey)
  const phases = active?.phases || []
  const allItems = phases.flatMap(p => p.items || [])
  const doneCount = allItems.filter(it => checked[it.id]).length
  const pct = allItems.length ? Math.round(doneCount / allItems.length * 100) : 0
  const firstBlocker = allItems.find(it => it.blocker && !checked[it.id])

  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }

  if (loading) return <div style={{ padding: 24, color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Strategy picker + progress */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select value={activeKey || ''} onChange={e => selectStrategy(e.target.value)}
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font)' }}>
            {checklists.map(c => <option key={c.strategy_key} value={c.strategy_key}>{c.name}</option>)}
          </select>
          <button onClick={() => setChecked({})}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>
            ↺
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text4)', marginBottom: 4 }}>
          <span>{doneCount}/{allItems.length} steg</span>
          <span style={{ color: pct === 100 ? 'var(--green)' : 'var(--text4)' }}>{pct}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.2s' }} />
        </div>
        {pct === 100 && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 5, fontWeight: 600 }}>✅ Klart – A+ setup!</div>}
        {pct < 100 && doneCount > 0 && firstBlocker && (
          <div style={{ fontSize: 11, color: '#d97706', marginTop: 5 }}>⚠ {firstBlocker.label}</div>
        )}
      </div>

      {/* Items */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {phases.map(phase => (
          <div key={phase.id}>
            <div style={{ padding: '6px 14px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{phase.title}</span>
            </div>
            {(phase.items || []).map(item => {
              const isChecked = !!checked[item.id]
              return (
                <div key={item.id} onClick={() => setChecked(c => ({ ...c, [item.id]: !c[item.id] }))}
                  style={{ display: 'flex', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isChecked ? 'rgba(0,212,170,0.04)' : 'transparent' }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1,
                    border: `1.5px solid ${isChecked ? 'var(--accent)' : 'var(--border2)'}`,
                    background: isChecked ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--bg)', fontSize: 11, fontWeight: 700,
                  }}>{isChecked && '✓'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isChecked ? 'var(--text4)' : 'var(--text2)', textDecoration: isChecked ? 'line-through' : 'none' }}>
                      {item.label}
                    </div>
                    {item.sub && !isChecked && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 2 }}>{item.sub}</div>}
                    {item.stop && !isChecked && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>⛔ {item.stop}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main PiP widget ───────────────────────────────────────────────────────────
export default function PiPWidget() {
  const { user } = useAuth()
  const [pipWindow, setPipWindow] = useState(null)
  const [pipRoot, setPipRoot] = useState(null)
  const [tab, setTab] = useState('checklist') // 'checklist' | 'journal'
  const [activeStratName, setActiveStratName] = useState('')
  const isSupported = 'documentPictureInPicture' in window

  async function openPiP() {
    if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 480, height: 680 })
      copyStylesToPiP(pip.document)
      const root = pip.document.createElement('div')
      root.id = 'pip-root'
      root.style.cssText = 'height:100vh;display:flex;flex-direction:column;overflow:hidden'
      pip.document.body.appendChild(root)
      pip.addEventListener('pagehide', () => { setPipWindow(null); setPipRoot(null) })
      setPipWindow(pip)
      setPipRoot(root)
    } catch (e) {
      console.error('PiP failed:', e)
    }
  }

  function closePiP() {
    if (pipWindow && !pipWindow.closed) pipWindow.close()
    setPipWindow(null); setPipRoot(null)
  }

  if (!isSupported) return null

  const pipContent = pipRoot ? createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        {[{ id: 'checklist', label: '✅ Checklist' }, { id: 'journal', label: '📝 Logga trade' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
              fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'checklist' && (
          <MiniChecklist user={user} onStrategyChange={name => setActiveStratName(name)} />
        )}
        {tab === 'journal' && (
          <MiniJournal user={user} activeStrategyName={activeStratName} />
        )}
      </div>
    </div>,
    pipRoot
  ) : null

  return (
    <>
      <button
        onClick={pipWindow && !pipWindow.closed ? closePiP : openPiP}
        title={pipWindow ? 'Stäng PiP-fönster' : 'Öppna flytande logga/checklist'}
        style={{
          background: pipWindow ? 'var(--accent-dim)' : 'none',
          border: `1px solid ${pipWindow ? 'rgba(0,212,170,0.4)' : 'var(--border)'}`,
          borderRadius: 'var(--r)',
          color: pipWindow ? 'var(--accent)' : 'var(--text3)',
          cursor: 'pointer', fontSize: 16, padding: '4px 8px', lineHeight: 1,
        }}
      >
        ⧉
      </button>
      {pipContent}
    </>
  )
}
