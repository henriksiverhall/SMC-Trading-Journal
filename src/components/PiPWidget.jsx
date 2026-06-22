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
  time: '', symbol: '', direction: '',
  entry: '', sl: '', tp: '', actual_exit: '', exit_date: '', exit_time: '',
  outcome: '', grade: '', emotion: '', notes: '', strategy: '',
  contracts: '1', risk_pct: '', account_size: '',
}

const EMOTIONS = ['😊 Disciplined','🤝 Confident','😐 Hesitant','⚡ FOMO','😤 Revenge','🎯 Over']

// ── Full Journal form (same fields as Journal.jsx Log Trade) ──────────────────
function MiniJournal({ user, checklistStrategies, activeStrategyName, onSaved }) {
  const [form, setForm] = useState({ ...DEFAULT_FORM, strategy: activeStrategyName || '' })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [scaleIns, setScaleIns] = useState([])
  const [targets, setTargets] = useState([])

  useEffect(() => {
    setForm(f => ({ ...f, strategy: checklistStrategies.includes(f.strategy) ? f.strategy : activeStrategyName || f.strategy }))
  }, [activeStrategyName])

  const spec = getFuturesSpec(form.symbol)
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inp = {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
    color: 'var(--text)', padding: '5px 8px', fontSize: 12, width: '100%', fontFamily: 'var(--font)',
  }
  const lbl = { fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3, display: 'block' }
  const row = (cols, children) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, marginBottom: 8 }}>{children}</div>
  )
  const field = (label, el) => <div><span style={lbl}>{label}</span>{el}</div>

  async function handleSave() {
    if (!form.outcome) { setSavedMsg('⚠ Välj Utfall'); setTimeout(() => setSavedMsg(''), 2500); return }
    setSaving(true)
    const slDist = (form.entry && form.sl) ? Math.abs(parseFloat(form.entry) - parseFloat(form.sl)) : null
    const tpDist = (form.entry && form.tp) ? Math.abs(parseFloat(form.tp) - parseFloat(form.entry)) : null
    const r_value = slDist && tpDist && slDist > 0
      ? (form.outcome === 'W' ? tpDist / slDist : form.outcome === 'L' ? -1 : 0)
      : null

    const trade = {
      user_id: user.id,
      date: form.date, time: form.time || null,
      symbol: form.symbol || null, direction: form.direction || null,
      entry: form.entry ? parseFloat(form.entry) : null,
      sl: form.sl ? parseFloat(form.sl) : null,
      tp: form.tp ? parseFloat(form.tp) : null,
      outcome: form.outcome, grade: form.grade || null,
      notes: form.notes || null, result: r_value,
      strategy: form.strategy || null,
      custom_data: {
        ...(form.actual_exit ? { _actual_exit: parseFloat(form.actual_exit) } : {}),
        ...(form.exit_date ? { _exit_date: form.exit_date } : {}),
        ...(form.exit_time ? { _exit_time: form.exit_time } : {}),
        ...(scaleIns.length ? { _scaleIns: scaleIns, _totalContracts: parseInt(form.contracts||1) + scaleIns.reduce((a,s)=>a+parseInt(s.contracts||1),0) } : {}),
        ...(targets.length ? { _targets: targets } : {}),
      },
    }
    const { error } = await sb.from('trades').insert(trade)
    setSaving(false)
    if (error) { setSavedMsg('⚠ ' + error.message); setTimeout(() => setSavedMsg(''), 4000); return }
    setSavedMsg('✓ Trade sparat!')
    try { new BroadcastChannel('tradelog').postMessage({ type: 'trade_saved' }) } catch {}
    setTimeout(() => setSavedMsg(''), 2000)
    setForm({ ...DEFAULT_FORM, strategy: form.strategy, date: form.date })
    setScaleIns([]); setTargets([])
    if (onSaved) onSaved()
  }

  return (
    <div style={{ padding: '10px 14px', overflowY: 'auto', height: '100%' }}>
      {/* Strategi */}
      <div style={{ marginBottom: 8 }}>
        <span style={lbl}>Strategi</span>
        {checklistStrategies.length > 0 ? (
          <select style={inp} value={checklistStrategies.includes(form.strategy) ? form.strategy : form.strategy ? '__c' : ''}
            onChange={e => up('strategy', e.target.value === '__c' ? '' : e.target.value)}>
            <option value="">Välj strategi…</option>
            {checklistStrategies.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__c">Skriv in egen…</option>
          </select>
        ) : (
          <input style={inp} placeholder="Strategi" value={form.strategy} onChange={e => up('strategy', e.target.value)} />
        )}
        {form.strategy && !checklistStrategies.includes(form.strategy) && form.strategy !== '__c' && (
          <input style={{ ...inp, marginTop: 4 }} placeholder="Ange strategi" value={form.strategy} onChange={e => up('strategy', e.target.value)} />
        )}
      </div>

      {row('1fr 1fr', [
        field('Datum', <input type="date" style={inp} value={form.date} onChange={e => up('date', e.target.value)} />),
        field('Tid (ET)', <input type="time" style={inp} value={form.time} onChange={e => up('time', e.target.value)} />),
      ])}
      {row('1fr 1fr', [
        field('Instrument', <input style={inp} placeholder="NQ, MNQ…" value={form.symbol} onChange={e => up('symbol', e.target.value)} />),
        field('Riktning', <select style={inp} value={form.direction} onChange={e => up('direction', e.target.value)}>
          <option value="">—</option><option>Long</option><option>Short</option>
        </select>),
      ])}
      {spec && <div style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 'var(--r)', padding: '2px 7px', marginBottom: 8 }}>{spec.name} · ${spec.pointValue}/pt</div>}

      {row('1fr 1fr 1fr', [
        field('Entry', <input type="number" step="0.01" style={inp} placeholder="0.00" value={form.entry} onChange={e => up('entry', e.target.value)} />),
        field('Stop Loss', <input type="number" step="0.01" style={inp} placeholder="0.00" value={form.sl} onChange={e => up('sl', e.target.value)} />),
        field('Take Profit', <input type="number" step="0.01" style={inp} placeholder="0.00" value={form.tp} onChange={e => up('tp', e.target.value)} />),
      ])}

      {/* Scale-ins */}
      {scaleIns.map((s, i) => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 24px', gap: 6, marginBottom: 6 }}>
          <input type="number" step="0.01" style={inp} placeholder={`Scale-in ${i+2}`} value={s.price} onChange={e => setScaleIns(ss => ss.map(x => x.id===s.id ? {...x,price:e.target.value} : x))} />
          <input type="number" style={inp} placeholder="Ktr" value={s.contracts} onChange={e => setScaleIns(ss => ss.map(x => x.id===s.id ? {...x,contracts:e.target.value} : x))} />
          <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}
            onClick={() => setScaleIns(ss => ss.filter(x => x.id !== s.id))}>✕</button>
        </div>
      ))}
      <button style={{ width: '100%', background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', color: 'var(--text4)', cursor: 'pointer', fontSize: 11, padding: '3px 0', marginBottom: 8 }}
        onClick={() => setScaleIns(ss => [...ss, { id: crypto.randomUUID(), price: '', contracts: '1' }])}>+ Scale-in entry</button>

      {row('1fr 1fr', [
        field('Faktisk exit', <input type="number" step="0.01" style={inp} placeholder="Valfritt" value={form.actual_exit} onChange={e => up('actual_exit', e.target.value)} />),
        field('Kontrakt', <input type="number" min="1" style={inp} placeholder="1" value={form.contracts} onChange={e => up('contracts', e.target.value)} />),
      ])}
      {row('1fr 1fr', [
        field('Exit datum', <input type="date" style={inp} value={form.exit_date} onChange={e => up('exit_date', e.target.value)} />),
        field('Exit tid (ET)', <input type="time" style={inp} value={form.exit_time} onChange={e => up('exit_time', e.target.value)} />),
      ])}
      {row('1fr 1fr', [
        field('Risk %', <input type="number" step="0.1" style={inp} placeholder="1.0" value={form.risk_pct} onChange={e => up('risk_pct', e.target.value)} />),
        field('Kontostorlek', <input type="number" step="1000" style={inp} placeholder="50000" value={form.account_size} onChange={e => up('account_size', e.target.value)} />),
      ])}

      {row('1fr 1fr', [
        field('Utfall *', <select style={{ ...inp, borderColor: !form.outcome ? 'var(--red)' : 'var(--border)' }} value={form.outcome} onChange={e => up('outcome', e.target.value)}>
          <option value="">Välj…</option><option value="W">Win</option><option value="L">Loss</option><option value="BE">Break Even</option>
        </select>),
        field('Grade', <div style={{ display: 'flex', gap: 3 }}>
          {GRADES.map(g => (
            <button key={g} onClick={() => up('grade', form.grade===g ? '' : g)}
              style={{ flex:1, padding:'4px 0', border:`1px solid ${form.grade===g?'var(--accent)':'var(--border)'}`, borderRadius:'var(--r)',
                background: form.grade===g ? 'var(--accent-dim)' : 'transparent', color: form.grade===g ? 'var(--accent)' : 'var(--text3)',
                cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'var(--font)' }}>
              {g}
            </button>
          ))}
        </div>),
      ])}

      {field('Känsla', <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
        {EMOTIONS.map(e => (
          <button key={e} onClick={() => up('emotion', form.emotion===e ? '' : e)}
            style={{ padding:'3px 8px', border:`1px solid ${form.emotion===e?'var(--accent)':'var(--border)'}`, borderRadius:12,
              background: form.emotion===e ? 'var(--accent-dim)' : 'transparent', color: form.emotion===e ? 'var(--accent)' : 'var(--text3)',
              cursor:'pointer', fontSize:11, fontFamily:'var(--font)' }}>
            {e}
          </button>
        ))}
      </div>)}

      <div style={{ marginBottom: 8, marginTop: 8 }}>
        <span style={lbl}>Chart / Skärmbild</span>
        <input style={inp} placeholder="URL till chart" value={form.chart_link||''} onChange={e => up('chart_link', e.target.value)} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <span style={lbl}>Noteringar</span>
        <textarea style={{ ...inp, resize: 'vertical', minHeight: 52 }} placeholder="Vad gick bra / vad kunde gjorts bättre?" value={form.notes} onChange={e => up('notes', e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: '9px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--r)', color: 'var(--bg)', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 4 }}>
        {saving ? 'Sparar…' : '🔖 Spara trade'}
      </button>
      {savedMsg && <div style={{ textAlign: 'center', fontSize: 12, color: savedMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{savedMsg}</div>}
    </div>
  )
}


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
  const [checklistStrategies, setChecklistStrategies] = useState([])

  useEffect(() => {
    if (!user) return
    sb.from('checklists').select('name').eq('user_id', user.id).order('created_at')
      .then(({ data }) => { if (data) setChecklistStrategies(data.map(c => c.name)) })
  }, [user])
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
          <MiniJournal user={user} checklistStrategies={checklistStrategies} activeStrategyName={activeStratName} />
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
