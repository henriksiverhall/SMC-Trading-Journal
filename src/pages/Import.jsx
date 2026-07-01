import { useState, useRef } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

// ── Parsers ───────────────────────────────────────────────────────────────────────────────

function parseTVBacktest(text) {
  const lines = text.trim().split('\n')
  if (!lines.length) return { error: 'Tom fil' }
  const headerIdx = lines.findIndex(l => /trade\s*#|trade type|signal/i.test(l))
  if (headerIdx === -1) return { error: 'Okänt TradingView-format – ingen header-rad hittades.' }
  const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    if (cols.length < 3) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').replace(/^"|"$/g, '').trim() })
    rows.push(row)
  }
  const trades = []
  for (const row of rows) {
    const type = row['type'] || row['trade type'] || row['signal'] || ''
    const symbol   = row['symbol'] || row['ticker'] || ''
    const dateStr  = row['date/time'] || row['entry date'] || row['date'] || row['entry time'] || ''
    const exitDate = row['exit date'] || row['exit date/time'] || ''
    const entry    = parseFloat(row['entry'] || row['entry price'] || row['price'] || '')
    const exitP    = parseFloat(row['exit'] || row['exit price'] || row['close price'] || '')
    const contracts= parseFloat(row['qty'] || row['quantity'] || row['size'] || row['contracts'] || '1') || 1
    const profitRaw= row['profit'] || row['net profit'] || row['p&l'] || row['pnl'] || ''
    const profit   = parseFloat(profitRaw.replace(/[$,%]/g, '')) || null
    const direction= /short/i.test(type) ? 'Short' : /long|buy/i.test(type) ? 'Long' : ''
    const runup    = parseFloat(row['max runup'] || '') || null
    const drawdown = parseFloat(row['max drawdown'] || '') || null
    if (!entry && !exitP) continue
    trades.push({
      date: formatDateStr(dateStr), exit_date: exitDate ? formatDateStr(exitDate) : null,
      symbol, direction,
      entry: isNaN(entry) ? null : entry, actual_exit: isNaN(exitP) ? null : exitP,
      contracts, outcome: profit != null ? (profit > 0 ? 'W' : profit < 0 ? 'L' : 'BE') : '',
      pnl: profit, _runup: runup, _drawdown: drawdown, _source: 'tv_backtest',
    })
  }
  if (!trades.length) return { error: 'Inga trades parsades – kontrollera att filen är en TradingView Strategy Tester-export.' }
  return { trades }
}

function parseMetaTrader(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()) || []
  const hasMTHeaders = headers.some(h => /ticket|order|open time|close time|type|lots|s\/l|t\/p/i.test(h))
  if (!hasMTHeaders) return { error: 'Okänt MetaTrader-format. Exportera som "Report" CSV från MT4/MT5.' }
  const trades = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    if (cols.length < 5) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').replace(/^"|"$/g, '').trim() })
    const type = (row['type'] || '').toLowerCase()
    if (!/buy|sell/.test(type)) continue
    const symbol = row['symbol'] || row['item'] || ''
    const openTime = row['open time'] || row['time'] || ''
    const closeTime = row['close time'] || ''
    const lots = parseFloat(row['lots'] || row['volume'] || '1') || 1
    const openPrice = parseFloat(row['open price'] || row['price'] || '')
    const closePrice = parseFloat(row['close price'] || row['close'] || '')
    const sl = parseFloat(row['s/l'] || row['sl'] || '') || null
    const tp = parseFloat(row['t/p'] || row['tp'] || '') || null
    const profit = parseFloat(row['profit'] || row['p&l'] || '') || null
    const direction = /buy/.test(type) ? 'Long' : 'Short'
    trades.push({
      date: formatDateStr(openTime), exit_date: closeTime ? formatDateStr(closeTime) : null,
      symbol, direction,
      entry: isNaN(openPrice) ? null : openPrice, actual_exit: isNaN(closePrice) ? null : closePrice,
      sl, tp, contracts: lots,
      outcome: profit != null ? (profit > 0 ? 'W' : profit < 0 ? 'L' : 'BE') : '',
      pnl: profit, _source: 'metatrader',
    })
  }
  if (!trades.length) return { error: 'Inga trades parsades från MetaTrader-filen.' }
  return { trades }
}

function parseTradovate(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()) || []
  const hasTVHeaders = headers.some(h => /fill id|account|contract|side|filled/i.test(h))
  if (!hasTVHeaders) return { error: 'Okänt Tradovate-format. Exportera Orders.csv från Tradovate.' }
  const fills = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    if (cols.length < 4) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').replace(/^"|"$/g, '').trim() })
    const side = (row['side'] || row['b/s'] || row['buy/sell'] || '').toLowerCase()
    if (!/buy|sell|b|s/.test(side)) continue
    fills.push({
      date: row['fill time'] || row['time'] || row['timestamp'] || '',
      symbol: row['contract'] || row['symbol'] || '',
      side: /buy|b/.test(side) ? 'Buy' : 'Sell',
      price: parseFloat(row['fill price'] || row['price'] || ''),
      qty: parseFloat(row['filled'] || row['qty'] || row['quantity'] || '1') || 1,
    })
  }
  const bySymbol = {}
  for (const f of fills) {
    if (!bySymbol[f.symbol]) bySymbol[f.symbol] = { buys: [], sells: [] }
    bySymbol[f.symbol][f.side === 'Buy' ? 'buys' : 'sells'].push(f)
  }
  const trades = []
  for (const [symbol, { buys, sells }] of Object.entries(bySymbol)) {
    const pairs = Math.min(buys.length, sells.length)
    for (let i = 0; i < pairs; i++) {
      const buy = buys[i], sell = sells[i]
      const isLong = new Date(buy.date) < new Date(sell.date)
      const entry = isLong ? buy.price : sell.price
      const exitP = isLong ? sell.price : buy.price
      const profit = isLong ? (exitP - entry) : (entry - exitP)
      trades.push({
        date: formatDateStr(isLong ? buy.date : sell.date),
        exit_date: formatDateStr(isLong ? sell.date : buy.date),
        symbol, direction: isLong ? 'Long' : 'Short', entry, actual_exit: exitP,
        contracts: buy.qty, outcome: profit > 0 ? 'W' : profit < 0 ? 'L' : 'BE',
        pnl: null, _source: 'tradovate',
      })
    }
  }
  if (!trades.length) return { error: 'Inga trades parsades från Tradovate-filen.' }
  return { trades }
}

function parseNinjaTrader(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()) || []
  const hasNT = headers.some(h => /instrument|market pos|entry time|exit time|entry price|exit price|profit/i.test(h))
  if (!hasNT) return { error: 'Okänt NinjaTrader-format. Exportera "Performance" → "Trades" som CSV.' }
  const trades = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    if (cols.length < 5) continue
    const row = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').replace(/^"|"$/g, '').trim() })
    const symbol = row['instrument'] || row['symbol'] || ''
    const pos = (row['market pos.'] || row['market pos'] || row['position'] || '').toLowerCase()
    const direction = /long/.test(pos) ? 'Long' : /short/.test(pos) ? 'Short' : ''
    const entryDate = row['entry time'] || row['entry date'] || ''
    const exitDate = row['exit time'] || row['exit date'] || ''
    const entry = parseFloat(row['entry price'] || '')
    const exitP = parseFloat(row['exit price'] || '')
    const qty = parseFloat(row['quantity'] || row['qty'] || '1') || 1
    const profitRaw = row['profit'] || row['net profit'] || ''
    const profit = parseFloat(profitRaw.replace(/[$,]/g, '')) || null
    if (!symbol || isNaN(entry)) continue
    trades.push({
      date: formatDateStr(entryDate), exit_date: exitDate ? formatDateStr(exitDate) : null,
      symbol, direction, entry: isNaN(entry) ? null : entry, actual_exit: isNaN(exitP) ? null : exitP,
      contracts: qty, outcome: profit != null ? (profit > 0 ? 'W' : profit < 0 ? 'L' : 'BE') : '',
      pnl: profit, _source: 'ninjatrader',
    })
  }
  if (!trades.length) return { error: 'Inga trades parsades från NinjaTrader-filen.' }
  return { trades }
}

function splitCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

function formatDateStr(raw) {
  if (!raw) return new Date().toISOString().split('T')[0]
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  const m1 = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
  if (m1) { const y = m1[3].length===2?'20'+m1[3]:m1[3]; return `${y}-${m1[1].padStart(2,'0')}-${m1[2].padStart(2,'0')}` }
  return new Date().toISOString().split('T')[0]
}

const PLATFORMS = [
  { id: 'tv_backtest', label: 'TradingView Backtesting', desc: 'Strategy Tester → List of Trades → Export to CSV', accept: '.csv', parse: parseTVBacktest },
  { id: 'tradovate',   label: 'Tradovate',               desc: 'Orders → Export CSV (Orders.csv). Används av TopStep, Apex, Tradeify m.fl.', accept: '.csv', parse: parseTradovate },
  { id: 'metatrader', label: 'MetaTrader 4 / 5',        desc: 'Account History → Report (exportera som CSV från MT4/MT5)', accept: '.csv', parse: parseMetaTrader },
  { id: 'ninjatrader',label: 'NinjaTrader 7 / 8',       desc: 'Control Center → Account Performance → Trades → Export to CSV', accept: '.csv', parse: parseNinjaTrader },
]

export default function Import() {
  const { user } = useAuth()
  const [platform, setPlatform] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState('')
  const [selected, setSelected] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [strategy, setStrategy] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function handleFile(file) {
    if (!file || !platform) return
    const reader = new FileReader()
    reader.onload = e => {
      const result = platform.parse(e.target.result)
      if (result.error) { setParseError(result.error); setParsed(null); setSelected([]) }
      else { setParsed(result.trades); setSelected(result.trades.map((_,i)=>i)); setParseError(''); setImportResult(null) }
    }
    reader.readAsText(file, 'utf-8')
  }

  function toggleAll() { selected.length===parsed.length ? setSelected([]) : setSelected(parsed.map((_,i)=>i)) }
  function toggleRow(i) { setSelected(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i]) }

  async function handleImport() {
    if (!parsed || !selected.length || !user) return
    setImporting(true); setImportResult(null)
    let ok=0,skip=0,fail=0
    for (const t of selected.map(i=>parsed[i])) {
      const trade = {
        user_id: user.id,
        date: t.date || new Date().toISOString().split('T')[0],
        symbol: t.symbol||null, direction: t.direction||null,
        entry: t.entry||null, sl: t.sl||null, tp: t.tp||null,
        outcome: t.outcome||null, result: null, strategy: strategy||null,
        notes: null, checklist_pct: 0,
        custom_data: {
          _imported: true, _source: t._source,
          ...(t.actual_exit ? {_actual_exit:t.actual_exit} : {}),
          ...(t.exit_date   ? {_exit_date:t.exit_date}     : {}),
          ...(t.contracts   ? {_totalContracts:t.contracts}: {}),
          ...(t.pnl!=null   ? {_imported_pnl:t.pnl}       : {}),
          ...(t._runup      ? {_runup:t._runup}            : {}),
          ...(t._drawdown   ? {_drawdown:t._drawdown}      : {}),
        },
      }
      const { error } = await sb.from('trades').insert(trade)
      if (error) { if (error.code==='23505') skip++; else fail++ } else ok++
    }
    setImporting(false); setImportResult({ok,skip,fail})
  }

  function reset() { setPlatform(null);setParsed(null);setSelected([]);setParseError('');setImportResult(null);setStrategy('') }

  const lbl = { fontSize:11, fontWeight:700, color:'var(--text4)', textTransform:'uppercase', letterSpacing:.5, marginBottom:4, display:'block' }

  return (
    <div style={{ flex:1 }}>
      <Topbar title="Import" subtitle="Importera trades från externa plattformar" />
      <div className="page-content" style={{ maxWidth:900 }}>

        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-header">
            <div className="card-title">1 · Välj plattform</div>
            {platform && <button className="btn btn-ghost btn-sm" onClick={reset}>↺ Börja om</button>}
          </div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={()=>{setPlatform(p);setParsed(null);setParseError('');setImportResult(null)}}
                  style={{ background:platform?.id===p.id?'var(--accent-dim)':'var(--bg2)', border:`1px solid ${platform?.id===p.id?'rgba(0,212,170,0.5)':'var(--border)'}`, borderRadius:'var(--r2)', padding:'14px 16px', cursor:'pointer', textAlign:'left', fontFamily:'var(--font)' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:platform?.id===p.id?'var(--accent)':'var(--text)', marginBottom:4 }}>{p.label}</div>
                  <div style={{ fontSize:11, color:'var(--text4)', lineHeight:1.5 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {platform && !parsed && (
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header"><div className="card-title">2 · Ladda upp CSV-fil</div></div>
            <div className="card-body">
              <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0])}}
                onClick={()=>fileInputRef.current?.click()}
                style={{ border:`2px dashed ${dragOver?'var(--accent)':'var(--border2)'}`, borderRadius:'var(--r2)', padding:'40px 24px', textAlign:'center', cursor:'pointer', background:dragOver?'var(--accent-dim)':'var(--bg3)', transition:'all .15s' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📂</div>
                <div style={{ fontSize:14, color:'var(--text)', fontWeight:600, marginBottom:4 }}>Dra och släpp CSV-filen här</div>
                <div style={{ fontSize:12, color:'var(--text4)' }}>eller klicka för att bläddra</div>
                <input ref={fileInputRef} type="file" accept={platform.accept} style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />
              </div>
              {parseError && <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'var(--r)', fontSize:13, color:'var(--red)' }}>⚠ {parseError}</div>}
            </div>
          </div>
        )}

        {parsed && (
          <>
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-header">
                <div className="card-title">3 · Granska och välj trades ({selected.length} av {parsed.length} valda)</div>
                <button className="btn btn-ghost btn-sm" onClick={toggleAll}>{selected.length===parsed.length?'Avmarkera alla':'Markera alla'}</button>
              </div>
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <span style={lbl}>Strategi (valfritt – sätts på alla importerade trades)</span>
                <input className="form-control" style={{ maxWidth:320 }} placeholder="T.ex. ICT Unicorn, Backtest 2025…" value={strategy} onChange={e=>setStrategy(e.target.value)} />
              </div>
              <div style={{ overflowX:'auto' }}>
                <table className="journal-table">
                  <thead><tr>
                    <th style={{ width:36 }}><input type="checkbox" checked={selected.length===parsed.length} onChange={toggleAll} style={{ accentColor:'var(--accent)', cursor:'pointer' }} /></th>
                    <th>Datum</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Kontrakt</th><th>Utfall</th><th>P&amp;L</th>
                  </tr></thead>
                  <tbody>
                    {parsed.map((t,i) => (
                      <tr key={i} onClick={()=>toggleRow(i)} style={{ cursor:'pointer', opacity:selected.includes(i)?1:0.4 }}>
                        <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected.includes(i)} onChange={()=>toggleRow(i)} style={{ accentColor:'var(--accent)', cursor:'pointer' }} /></td>
                        <td className="mono">{t.date}</td>
                        <td><strong style={{ color:'var(--text)' }}>{t.symbol||'—'}</strong></td>
                        <td>{t.direction?<span className={`badge badge-${t.direction}`}>{t.direction}</span>:'—'}</td>
                        <td className="mono">{t.entry??'—'}</td>
                        <td className="mono">{t.actual_exit??'—'}</td>
                        <td className="mono">{t.contracts??'—'}</td>
                        <td>{t.outcome?<span className={`badge badge-${t.outcome}`}>{t.outcome}</span>:'—'}</td>
                        <td className={t.pnl>0?'r-pos':t.pnl<0?'r-neg':'r-neu'}>{t.pnl!=null?`${t.pnl>0?'+':''}$${Math.abs(t.pnl).toFixed(2)}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-body">
                {importResult ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Import klar</div>
                    <div style={{ display:'flex', gap:16 }}>
                      <div style={{ padding:'10px 16px', background:'var(--green-dim)', border:'1px solid var(--green)', borderRadius:'var(--r)', textAlign:'center' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'var(--green)' }}>{importResult.ok}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>Importerade</div>
                      </div>
                      {importResult.skip>0 && <div style={{ padding:'10px 16px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r)', textAlign:'center' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'var(--text3)' }}>{importResult.skip}</div>
                        <div style={{ fontSize:11, color:'var(--text4)' }}>Dubbletter</div>
                      </div>}
                      {importResult.fail>0 && <div style={{ padding:'10px 16px', background:'rgba(239,68,68,0.08)', border:'1px solid var(--red)', borderRadius:'var(--r)', textAlign:'center' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:'var(--red)' }}>{importResult.fail}</div>
                        <div style={{ fontSize:11, color:'var(--red)' }}>Fel</div>
                      </div>}
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:4 }}>
                      <button className="btn btn-ghost" onClick={reset}>Importera fler</button>
                      <button className="btn btn-primary" onClick={()=>window.__tlNavigate?.('journal')}>Gå till Journal →</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <button className="btn btn-primary" disabled={importing||!selected.length} onClick={handleImport} style={{ minWidth:180 }}>
                      {importing?'Importerar…':`📥 Importera ${selected.length} trade${selected.length!==1?'s':''}`}
                    </button>
                    <div style={{ fontSize:12, color:'var(--text4)' }}>
                      Importeras från <strong style={{ color:'var(--text3)' }}>{platform.label}</strong>. Fält som saknas (grade, noteringar) kan fyllas i via Redigera i Journal.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
