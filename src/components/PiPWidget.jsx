import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EMOTIONS, GRADES, getFuturesSpec, WORKER_URL } from '../lib/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────────────────
function copyStylesToPiP(pipDoc) {
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
    } catch {}
  })
  const rootStyle = getComputedStyle(document.documentElement)
  const vars = Array.from(rootStyle).filter(p => p.startsWith('--'))
  if (vars.length) {
    const style = pipDoc.createElement('style')
    style.textContent = `:root{${vars.map(v => `${v}:${rootStyle.getPropertyValue(v)}`).join(';')}}`
    pipDoc.head.appendChild(style)
  }
  const base = pipDoc.createElement('style')
  base.textContent = `
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:var(--font,'Inter',sans-serif);background:var(--bg);color:var(--text);font-size:14px;min-height:100vh}
    input,select,textarea,button{font-family:inherit}
    ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:var(--bg2)} ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
    .pip-form-label{font-size:10px;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;display:block}
    .pip-inp{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);padding:5px 8px;font-size:12px;width:100%}
    .pip-inp:focus{outline:none;border-color:var(--accent)}
    .pip-grade-btn{flex:1;padding:4px 0;border:1px solid var(--border);border-radius:var(--r);background:transparent;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600}
    .pip-grade-btn.sel{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
    .pip-emotion-btn{padding:3px 8px;border:1px solid var(--border);border-radius:12px;background:transparent;color:var(--text3);cursor:pointer;font-size:11px}
    .pip-emotion-btn.sel{border-color:var(--accent);background:var(--accent-dim);color:var(--accent)}
  `
  pipDoc.head.appendChild(base)
  pipDoc.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'dark')
}

const CHART_TAGS = ['4h', '1h', '15m', '5m', '1m', 'Entry', 'SL', 'TP', 'Exit', 'Övrigt']

const DEFAULT_FORM = {
  date: new Date().toISOString().split('T')[0],
  time: '', symbol: '', direction: '', entry: '', sl: '', tp: '',
  actual_exit: '', exit_date: '', exit_time: '', outcome: '', grade: '',
  emotion: '', notes: '', strategy: '', contracts: '1', risk_pct: '', account_size: '',
}
const EMPTY_SCALE  = () => ({ id: crypto.randomUUID(), price: '', contracts: '1' })
const EMPTY_TARGET = () => ({ id: crypto.randomUUID(), price: '', contracts: '' })

function computeR(f, scales, targets) {
  const baseEntry = parseFloat(f.entry)
  if (!baseEntry || !parseFloat(f.sl)) return null
  let entry = baseEntry
  if (scales.length) {
    const all = [{ price: baseEntry, c: parseFloat(f.contracts)||1 }, ...scales.map(s=>({price:parseFloat(s.price)||0,c:parseFloat(s.contracts)||1}))]
    const totalC = all.reduce((a,x)=>a+x.c,0)
    entry = all.reduce((a,x)=>a+x.price*x.c,0)/totalC
  }
  const risk = Math.abs(entry - parseFloat(f.sl))
  if (!risk) return null
  if (f.outcome === 'BE') return 0
  if (f.outcome === 'L') return -1
  if (f.outcome === 'W') {
    const ae = parseFloat(f.actual_exit)
    if (ae) return parseFloat((Math.abs(ae-entry)/risk).toFixed(2))
    if (targets.length) {
      const valid = targets.filter(t=>t.price&&t.contracts)
      if (valid.length) {
        let totalR=0,totalQ=0
        for(const t of valid){ const q=parseFloat(t.contracts)||0; totalR+=Math.abs(parseFloat(t.price)-entry)/risk*q; totalQ+=q }
        return totalQ>0 ? parseFloat((totalR/totalQ).toFixed(2)) : null
      }
    }
    const tp = parseFloat(f.tp)
    if (tp) return parseFloat((Math.abs(tp-entry)/risk).toFixed(2))
  }
  return null
}

// ── Journal form – identisk med Journal.jsx Log Trade ───────────────────────────────
function MiniJournal({ user, userSettings, checklistStrategies, activeStrategyName, saveSettings }) {
  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    strategy: activeStrategyName || '',
    risk_pct: userSettings?.riskPct ? String(userSettings.riskPct) : '',
    account_size: userSettings?.accountSize ? String(userSettings.accountSize) : '',
  })
  const [scaleIns, setScaleIns] = useState([])
  const [targets, setTargets] = useState([])
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [chartLinks, setChartLinks] = useState([])
  const [chartUrlInput, setChartUrlInput] = useState('')
  const [chartTagInput, setChartTagInput] = useState(CHART_TAGS[0])
  const [chartCustomTag, setChartCustomTag] = useState('')
  const [chartBusy, setChartBusy] = useState(false)
  const [chartError, setChartError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (activeStrategyName) setForm(f => ({ ...f, strategy: activeStrategyName }))
  }, [activeStrategyName])

  useEffect(() => {
    setForm(f => ({
      ...f,
      risk_pct: userSettings?.riskPct ? String(userSettings.riskPct) : f.risk_pct,
      account_size: userSettings?.accountSize ? String(userSettings.accountSize) : f.account_size,
    }))
  }, [userSettings?.riskPct, userSettings?.accountSize])

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const spec = getFuturesSpec(form.symbol)
  const r = computeR(form, scaleIns, targets)
  const riskPct = parseFloat(form.risk_pct)
  const accountSize = parseFloat(form.account_size)
  const riskDollar = (riskPct && accountSize) ? parseFloat((accountSize*riskPct/100).toFixed(2)) : null

  function resolveTag() { return chartTagInput==='__custom__' ? (chartCustomTag.trim()||'Övrigt') : chartTagInput }

  async function getAuthHeader() {
    const { data } = await sb.auth.getSession()
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function addChartFromUrl() {
    const trimmed = chartUrlInput.trim(); if (!trimmed) return
    setChartBusy(true); setChartError('')
    try {
      const authHeader = await getAuthHeader()
      const res = await fetch(`${WORKER_URL}/trade-images/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (data.tvBlocked && data.s3url) {
        setChartLinks(l => [...l, { id: crypto.randomUUID(), url: data.s3url, tag: resolveTag(), type: 'link' }])
        setChartError('TV S3 blockerar server-side – sparad som klänk.')
        setChartUrlInput(''); setChartCustomTag(''); return
      }
      if (!res.ok || !data.success) throw new Error(data.error || 'Kunde inte spara')
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: data.url, tag: resolveTag(), type: 'image' }])
      setChartUrlInput(''); setChartCustomTag('')
    } catch (e) {
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: trimmed, tag: resolveTag(), type: 'link' }])
      setChartError(`Hämtning misslyckades – sparad som länk.`)
      setChartUrlInput(''); setChartCustomTag('')
    } finally { setChartBusy(false) }
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
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ base64, mimeType: file.type || 'image/png' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Kunde inte spara')
      setChartLinks(l => [...l, { id: crypto.randomUUID(), url: data.url, tag: resolveTag(), type: 'image' }])
      setChartCustomTag('')
    } catch (e) { setChartError(`Uppladdning misslyckades: ${e.message}`) }
    finally { setChartBusy(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function handleSave() {
    if (!form.outcome) { setSavedMsg('⚠ Välj Utfall'); setTimeout(()=>setSavedMsg(''),2500); return }
    setSaving(true)
    const entry = (() => {
      const base = parseFloat(form.entry); if (!base) return null
      if (!scaleIns.length) return base
      const all = [{ price: base, c: parseFloat(form.contracts)||1 }, ...scaleIns.map(s=>({price:parseFloat(s.price)||0,c:parseFloat(s.contracts)||1}))]
      const tc = all.reduce((a,x)=>a+x.c,0)
      return parseFloat((all.reduce((a,x)=>a+x.price*x.c,0)/tc).toFixed(4))
    })()
    const trade = {
      user_id: user.id,
      date: form.date, time: form.time||null,
      symbol: form.symbol||null, direction: form.direction||null,
      entry: entry||null, sl: parseFloat(form.sl)||null, tp: parseFloat(form.tp)||null,
      outcome: form.outcome, result: r, grade: form.grade||null,
      emotion: form.emotion||null, strategy: form.strategy||null,
      notes: form.notes||null, checklist_pct: 0,
      risk_amount: riskDollar,
      custom_data: {
        ...(spec ? { _futures: true } : {}),
        ...(form.actual_exit ? { _actual_exit: parseFloat(form.actual_exit) } : {}),
        ...(form.exit_date ? { _exit_date: form.exit_date } : {}),
        ...(form.exit_time ? { _exit_time: form.exit_time } : {}),
        ...(scaleIns.length ? { _scaleIns: scaleIns } : {}),
        ...(targets.length ? { _targets: targets } : {}),
        ...(riskPct ? { _risk_pct: riskPct } : {}),
        ...(accountSize ? { _account_size: accountSize } : {}),
        ...(chartLinks.length ? { _chartLinks: chartLinks } : {}),
      },
    }
    const { error } = await sb.from('trades').insert(trade)
    setSaving(false)
    if (error) { setSavedMsg('⚠ '+error.message); setTimeout(()=>setSavedMsg(''),4000); return }
    if (riskPct||accountSize) await saveSettings?.({ riskPct: riskPct||userSettings?.riskPct, accountSize: accountSize||userSettings?.accountSize })
    if (form.strategy) await saveSettings?.({ lastJournalStrategy: form.strategy })
    setSavedMsg('✓ Trade sparat!')
    try { new BroadcastChannel('tradelog').postMessage({ type: 'trade_saved' }) } catch {}
    setTimeout(()=>setSavedMsg(''),2000)
    setForm(f => ({ ...DEFAULT_FORM, strategy: f.strategy, date: f.date, risk_pct: f.risk_pct, account_size: f.account_size }))
    setScaleIns([]); setTargets([])
    setChartLinks([]); setChartUrlInput(''); setChartCustomTag(''); setChartError('')
  }

  return (
    <div style={{ padding: '10px 14px', overflowY: 'auto', height: '100%' }}>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Strategi</span>
        {checklistStrategies.length > 0 ? (
          <>
            <select className="pip-inp" value={checklistStrategies.includes(form.strategy) ? form.strategy : form.strategy ? '__c' : ''}
              onChange={e => up('strategy', e.target.value === '__c' ? '' : e.target.value)}>
              <option value="">Välj strategi…</option>
              {checklistStrategies.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__c">Skriv in egen…</option>
            </select>
            {form.strategy && !checklistStrategies.includes(form.strategy) && (
              <input style={{ marginTop: 4 }} className="pip-inp" placeholder="Ange strategi" value={form.strategy} onChange={e => up('strategy', e.target.value)} />
            )}
          </>
        ) : (
          <input className="pip-inp" placeholder="Strategi" value={form.strategy} onChange={e => up('strategy', e.target.value)} />
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><span className="pip-form-label">Datum</span><input type="date" className="pip-inp" value={form.date} onChange={e=>up('date',e.target.value)} /></div>
        <div><span className="pip-form-label">Tid (ET)</span><input type="time" className="pip-inp" value={form.time} onChange={e=>up('time',e.target.value)} /></div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><span className="pip-form-label">Instrument</span><input className="pip-inp" placeholder="NQ, ES, XAU…" value={form.symbol} onChange={e=>up('symbol',e.target.value)} /></div>
        <div><span className="pip-form-label">Riktning</span>
          <select className="pip-inp" value={form.direction} onChange={e=>up('direction',e.target.value)}>
            <option value="">Välj…</option><option>Long</option><option>Short</option>
          </select>
        </div>
      </div>
      {spec && <div style={{ fontSize:10, color:'var(--accent)', background:'var(--accent-dim)', borderRadius:'var(--r)', padding:'2px 8px', marginBottom:8 }}>🔷 {spec.name} · ${spec.pointValue}/pt · {spec.exchange}</div>}

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Entry</span>
        <input type="number" step="0.01" className="pip-inp" placeholder="0.00" value={form.entry} onChange={e=>up('entry',e.target.value)} />
        {scaleIns.map((s,i) => (
          <div key={s.id} style={{ display:'grid', gridTemplateColumns:'1fr 60px 24px', gap:6, marginTop:4 }}>
            <input type="number" step="0.01" className="pip-inp" placeholder={`Scale-in ${i+2}`} value={s.price} onChange={e=>setScaleIns(ss=>ss.map(x=>x.id===s.id?{...x,price:e.target.value}:x))} />
            <input type="number" className="pip-inp" placeholder="Ktr" value={s.contracts} onChange={e=>setScaleIns(ss=>ss.map(x=>x.id===s.id?{...x,contracts:e.target.value}:x))} />
            <button style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--red)', cursor:'pointer', fontSize:11 }} onClick={()=>setScaleIns(ss=>ss.filter(x=>x.id!==s.id))}>✕</button>
          </div>
        ))}
        <button style={{ width:'100%', background:'none', border:'1px dashed var(--border2)', borderRadius:'var(--r)', color:'var(--text4)', cursor:'pointer', fontSize:11, padding:'3px 0', marginTop:4 }} onClick={()=>setScaleIns(ss=>[...ss,EMPTY_SCALE()])}>+ Scale-in entry</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Kontrakt</span>
        <input type="number" min="1" className="pip-inp" placeholder="1" value={form.contracts} onChange={e=>up('contracts',e.target.value)} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><span className="pip-form-label">Stop Loss</span><input type="number" step="0.01" className="pip-inp" placeholder="0.00" value={form.sl} onChange={e=>up('sl',e.target.value)} /></div>
        <div><span className="pip-form-label">Take Profit 1</span><input type="number" step="0.01" className="pip-inp" placeholder="0.00" value={form.tp} onChange={e=>up('tp',e.target.value)} /></div>
      </div>

      {targets.map((t,i) => (
        <div key={t.id} style={{ display:'grid', gridTemplateColumns:'1fr 60px 24px', gap:6, marginBottom:4 }}>
          <input type="number" step="0.01" className="pip-inp" placeholder={`TP ${i+2}`} value={t.price} onChange={e=>setTargets(tt=>tt.map(x=>x.id===t.id?{...x,price:e.target.value}:x))} />
          <input type="number" className="pip-inp" placeholder="Ktr" value={t.contracts} onChange={e=>setTargets(tt=>tt.map(x=>x.id===t.id?{...x,contracts:e.target.value}:x))} />
          <button style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--red)', cursor:'pointer', fontSize:11 }} onClick={()=>setTargets(tt=>tt.filter(x=>x.id!==t.id))}>✕</button>
        </div>
      ))}
      <button style={{ width:'100%', background:'none', border:'1px dashed var(--border2)', borderRadius:'var(--r)', color:'var(--text4)', cursor:'pointer', fontSize:11, padding:'3px 0', marginBottom:8 }} onClick={()=>setTargets(tt=>[...tt,EMPTY_TARGET()])}>+ Fler targets</button>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Faktisk exit <span style={{ textTransform:'none', letterSpacing:0 }}>valfritt</span></span>
        <input type="number" step="0.01" className="pip-inp" placeholder="Om ej exakt TP/SL" value={form.actual_exit} onChange={e=>up('actual_exit',e.target.value)} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><span className="pip-form-label">Exit datum</span><input type="date" className="pip-inp" value={form.exit_date} onChange={e=>up('exit_date',e.target.value)} /></div>
        <div><span className="pip-form-label">Exit tid (ET)</span><input type="time" className="pip-inp" value={form.exit_time} onChange={e=>up('exit_time',e.target.value)} /></div>
      </div>

      {r !== null && (
        <div style={{ display:'flex', gap:12, alignItems:'center', padding:'8px 12px', background:'var(--bg3)', borderRadius:'var(--r)', border:'1px solid var(--border2)', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:.5, marginBottom:1 }}>R Auto</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color: r>0?'var(--green)':r<0?'var(--red)':'var(--text3)' }}>{r>0?'+':''}{r.toFixed(2)}R</div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><span className="pip-form-label">Risk %</span><input type="number" step="0.1" min="0" className="pip-inp" placeholder="0.5" value={form.risk_pct} onChange={e=>up('risk_pct',e.target.value)} /></div>
        <div><span className="pip-form-label">Kontostorlek</span><input type="number" step="1000" className="pip-inp" placeholder="50000" value={form.account_size} onChange={e=>up('account_size',e.target.value)} /></div>
      </div>
      {riskDollar && <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, fontFamily:'var(--mono)' }}>${riskDollar}/R</div>}

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Utfall *</span>
        <select className="pip-inp" style={{ borderColor: !form.outcome ? 'var(--red)' : undefined }} value={form.outcome} onChange={e=>up('outcome',e.target.value)}>
          <option value="">Välj…</option><option value="W">Win</option><option value="L">Loss</option><option value="BE">Break Even</option>
        </select>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Grade</span>
        <div style={{ display:'flex', gap:4, marginTop:2 }}>
          {['A+','A','B','C'].map(g => <button key={g} className={`pip-grade-btn${form.grade===g?' sel':''}`} onClick={()=>up('grade',form.grade===g?'':g)}>{g}</button>)}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Känsla <span style={{ textTransform:'none', letterSpacing:0 }}>valfritt</span></span>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:2 }}>
          {EMOTIONS.map(em => <button key={em.id} className={`pip-emotion-btn${form.emotion===em.id?' sel':''}`} onClick={()=>up('emotion',form.emotion===em.id?'':em.id)}>{em.emoji} {em.label}</button>)}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="pip-form-label">Chart / Skärmbilder <span style={{ textTransform:'none', letterSpacing:0 }}>flera, med tagg</span></span>
        {chartLinks.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:6 }}>
            {chartLinks.map(c => (
              <div key={c.id} style={{ display:'grid', gridTemplateColumns:'28px auto 1fr 20px', alignItems:'center', gap:6, padding:'4px 6px', background:'var(--bg3)', borderRadius:'var(--r)', border:'1px solid var(--border2)', overflow:'hidden' }}>
                {c.type==='image' ? <img src={c.url} alt={c.tag} style={{ width:28, height:28, objectFit:'cover', borderRadius:3, border:'1px solid var(--border2)' }} /> : <span style={{ display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🔗</span>}
                <span style={{ fontSize:9, fontWeight:700, color:'var(--accent)', background:'var(--accent-dim)', borderRadius:3, padding:'1px 5px', whiteSpace:'nowrap' }}>{c.tag}</span>
                <a href={c.url} target="_blank" rel="noreferrer" title={c.url} style={{ display:'block', fontSize:10, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{c.url}</a>
                <button onClick={()=>setChartLinks(l=>l.filter(x=>x.id!==c.id))} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:4, marginBottom:4 }}>
          <select className="pip-inp" style={{ flex:1 }} value={chartTagInput} onChange={e=>setChartTagInput(e.target.value)}>
            {CHART_TAGS.map(t=><option key={t} value={t}>{t}</option>)}
            <option value="__custom__">Egen tagg…</option>
          </select>
          {chartTagInput==='__custom__' && <input className="pip-inp" style={{ flex:1 }} placeholder="Taggnamn" value={chartCustomTag} onChange={e=>setChartCustomTag(e.target.value)} />}
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:4 }}>
          <input type="url" className="pip-inp" placeholder="TV 'Copy link' eller URL…" value={chartUrlInput} onChange={e=>setChartUrlInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){e.preventDefault();addChartFromUrl()} }} />
          <button disabled={chartBusy||!chartUrlInput.trim()} onClick={addChartFromUrl}
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text2)', cursor:'pointer', fontSize:11, padding:'4px 8px', whiteSpace:'nowrap' }}>
            {chartBusy ? '…' : '+ Lägg till'}
          </button>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>addChartFromFile(e.target.files?.[0])} />
          <button disabled={chartBusy} onClick={()=>fileInputRef.current?.click()}
            style={{ width:'100%', background:'var(--bg3)', border:'1px dashed var(--border2)', borderRadius:'var(--r)', color:'var(--text3)', cursor:'pointer', fontSize:11, padding:'4px 0' }}>
            📤 Ladda upp skärmbild
          </button>
        </div>
        {chartError && <div style={{ fontSize:10, color:'#f59e0b', marginTop:4 }}>{chartError}</div>}
      </div>

      <div style={{ marginBottom: 10 }}>
        <span className="pip-form-label">Noteringar</span>
        <textarea className="pip-inp" rows={2} style={{ resize:'vertical' }} placeholder="Vad gick bra? Vad kunde gjorts bättre?" value={form.notes} onChange={e=>up('notes',e.target.value)} />
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ width:'100%', padding:'9px', background:'var(--accent)', border:'none', borderRadius:'var(--r)', color:'var(--bg)', fontWeight:700, fontSize:13, cursor:saving?'not-allowed':'pointer', marginBottom:4 }}>
        {saving ? 'Sparar…' : '🔖 Spara trade'}
      </button>
      {savedMsg && <div style={{ textAlign:'center', fontSize:12, color:savedMsg.startsWith('✓')?'var(--green)':'var(--red)', marginBottom:4 }}>{savedMsg}</div>}
    </div>
  )
}

// ── Checklist ─────────────────────────────────────────────────────────────────────────────────
function MiniChecklist({ user, onStrategyChange }) {
  const [checklists, setChecklists] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [checked, setChecked] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    sb.from('checklists').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
      if (data?.length) {
        setChecklists(data); setActiveKey(data[0].strategy_key)
        if (onStrategyChange) onStrategyChange(data[0].name)
      }
      setLoading(false)
    })
  }, [user])

  function selectStrategy(key) {
    setActiveKey(key); setChecked({})
    const cl = checklists.find(c => c.strategy_key === key)
    if (cl && onStrategyChange) onStrategyChange(cl.name)
  }

  const active = checklists.find(c => c.strategy_key === activeKey)
  const phases = active?.phases || []
  const allItems = phases.flatMap(p => p.items || [])
  const doneCount = allItems.filter(it => checked[it.id]).length
  const pct = allItems.length ? Math.round(doneCount / allItems.length * 100) : 0
  const firstBlocker = allItems.find(it => it.blocker && !checked[it.id])

  if (loading) return <div style={{ padding:24, color:'var(--text3)', fontSize:13 }}>Laddar…</div>

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg3)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <select value={activeKey||''} onChange={e=>selectStrategy(e.target.value)} className="pip-inp" style={{ flex:1 }}>
            {checklists.map(c => <option key={c.strategy_key} value={c.strategy_key}>{c.name}</option>)}
          </select>
          <button onClick={()=>setChecked({})} style={{ background:'none', border:'1px solid var(--border)', borderRadius:'var(--r)', color:'var(--text3)', cursor:'pointer', fontSize:11, padding:'4px 8px' }}>↺</button>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text4)', marginBottom:4 }}>
          <span>{doneCount}/{allItems.length} steg</span>
          <span style={{ color:pct===100?'var(--green)':'var(--text4)' }}>{pct}%</span>
        </div>
        <div style={{ height:4, background:'var(--bg)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:pct===100?'var(--green)':'var(--accent)', borderRadius:2, transition:'width .2s' }} />
        </div>
        {pct===100 && <div style={{ fontSize:11, color:'var(--green)', marginTop:5, fontWeight:600 }}>✅ Klart – A+ setup!</div>}
        {pct<100 && firstBlocker && <div style={{ fontSize:11, color:'#d97706', marginTop:5 }}>⚠ {firstBlocker.label}</div>}
      </div>
      <div style={{ overflowY:'auto', flex:1 }}>
        {phases.map(phase => (
          <div key={phase.id}>
            <div style={{ padding:'6px 14px', background:'var(--bg3)', display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid var(--border)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:phase.color, flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5 }}>{phase.title}</span>
            </div>
            {(phase.items||[]).map(item => {
              const isChecked = !!checked[item.id]
              return (
                <div key={item.id} onClick={()=>setChecked(c=>({...c,[item.id]:!c[item.id]}))}
                  style={{ display:'flex', gap:10, padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background:isChecked?'rgba(0,212,170,0.04)':'transparent' }}>
                  <div style={{ width:16, height:16, borderRadius:3, flexShrink:0, marginTop:1, border:`1.5px solid ${isChecked?'var(--accent)':'var(--border2)'}`, background:isChecked?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--bg)', fontSize:11, fontWeight:700 }}>{isChecked&&'✓'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:isChecked?'var(--text4)':'var(--text2)', textDecoration:isChecked?'line-through':'none' }}>{item.label}</div>
                    {item.sub && !isChecked && <div style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>{item.sub}</div>}
                    {item.stop && !isChecked && <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>⛔ {item.stop}</div>}
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

// ── Main PiP widget ───────────────────────────────────────────────────────────────────────────
export default function PiPWidget() {
  const { user, userSettings, saveSettings } = useAuth()
  const [pipWindow, setPipWindow] = useState(null)
  const [pipRoot, setPipRoot] = useState(null)
  const [tab, setTab] = useState('checklist')
  const [activeStratName, setActiveStratName] = useState('')
  const [checklistStrategies, setChecklistStrategies] = useState([])
  const isSupported = 'documentPictureInPicture' in window

  useEffect(() => {
    if (!user) return
    sb.from('checklists').select('name').eq('user_id', user.id).order('created_at')
      .then(({ data }) => { if (data) setChecklistStrategies(data.map(c => c.name)) })
  }, [user])

  async function openPiP() {
    if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width: 500, height: 720 })
      copyStylesToPiP(pip.document)
      const root = pip.document.createElement('div')
      root.id = 'pip-root'
      root.style.cssText = 'height:100vh;display:flex;flex-direction:column;overflow:hidden'
      pip.document.body.appendChild(root)
      pip.addEventListener('pagehide', () => { setPipWindow(null); setPipRoot(null) })
      setPipWindow(pip); setPipRoot(root)
    } catch (e) { console.error('PiP failed:', e) }
  }

  function closePiP() {
    if (pipWindow && !pipWindow.closed) pipWindow.close()
    setPipWindow(null); setPipRoot(null)
  }

  if (!isSupported) return null

  const pipContent = pipRoot ? createPortal(
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexShrink:0 }}>
        {[{ id:'checklist', label:'✅ Checklist' }, { id:'journal', label:'📝 Logga trade' }].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:'10px', border:'none', borderBottom:tab===t.id?'2px solid var(--accent)':'2px solid transparent',
              background:'transparent', color:tab===t.id?'var(--accent)':'var(--text3)',
              fontWeight:tab===t.id?700:400, cursor:'pointer', fontSize:13, fontFamily:'var(--font)' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tab==='checklist' && <MiniChecklist user={user} onStrategyChange={name=>setActiveStratName(name)} />}
        {tab==='journal' && <MiniJournal user={user} userSettings={userSettings} checklistStrategies={checklistStrategies} activeStrategyName={activeStratName} saveSettings={saveSettings} />}
      </div>
    </div>,
    pipRoot
  ) : null

  return (
    <>
      <button onClick={pipWindow&&!pipWindow.closed?closePiP:openPiP}
        title={pipWindow?'Stäng PiP':'Öppna flytande logg/checklist'}
        style={{ background:pipWindow?'var(--accent-dim)':'none', border:`1px solid ${pipWindow?'rgba(0,212,170,0.4)':'var(--border)'}`, borderRadius:'var(--r)', color:pipWindow?'var(--accent)':'var(--text3)', cursor:'pointer', fontSize:16, padding:'4px 8px', lineHeight:1 }}>
        ⧉
      </button>
      {pipContent}
    </>
  )
}
