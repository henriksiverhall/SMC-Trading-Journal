function CustomFieldsWidget({ trades }) {
  const INTERNAL_KEYS = new Set([
    '_mfe','_mae','_mfe_fetched_at','_actual_exit','_exit_date','_exit_time',
    '_scaleIns','_targets','_totalContracts','_weightedEntry','_risk_pct',
    '_account_size','_futures','backtest','result_unit','rr_target','strategy_type',
    // Backtest-specifika fält
    'risk_pts','box_size','box_low','box_high','tp_rr2','tp_rr3','tp_rr',
    'entry_price','exit_price','trade_id','session','bar_index',
  ])

  // Filtrera även bort fält som ser ut som tekniska (versaler + underscores, eller börjar med _)
  function isInternalKey(key) {
    if (INTERNAL_KEYS.has(key.toLowerCase())) return true
    if (key.startsWith('_')) return true
    // Nyckel som är VERSALER_MED_UNDERSCORE = sannolikt backtest-data
    if (/^[A-Z][A-Z0-9_]+$/.test(key)) return true
    return false
  }

  const fieldMap = {}
  for (const t of trades) {
    const cd = t.custom_data
    if (!cd || typeof cd !== 'object') continue
    for (const [key, val] of Object.entries(cd)) {
      if (isInternalKey(key)) continue
      if (val == null || val === '') continue
      const strVal = String(val).trim()
      if (!fieldMap[key]) fieldMap[key] = {}
      if (!fieldMap[key][strVal]) fieldMap[key][strVal] = { w: 0, l: 0, be: 0, r: 0 }
      const bucket = fieldMap[key][strVal]
      if (t.outcome === 'W') bucket.w++; else if (t.outcome === 'L') bucket.l++; else if (t.outcome === 'BE') bucket.be++
      if (t.result != null) bucket.r += t.result
    }
  }
  const fields = Object.keys(fieldMap)
  if (!fields.length) return (
    <div className="card">
      <div className="card-header"><div className="card-title">🔖 Egna fält – analysdimension</div></div>
      <div className="card-body"><p style={{ fontSize: 13, color: 'var(--text3)' }}>Lägg till egna fält i Journal-formuläret för att se breakdown här.</p></div>
    </div>
  )
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">🔖 Egna fält – analysdimension</div></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {fields.map(field => {
            const values = Object.entries(fieldMap[field]).map(([val, d]) => { const total = d.w + d.l + d.be; const wr = total > 0 ? parseFloat((d.w / (d.w + d.l || 1) * 100).toFixed(1)) : null; return { val, ...d, total, wr, netR: parseFloat(d.r.toFixed(2)) } }).filter(v => v.total > 0).sort((a, b) => b.netR - a.netR)
            const maxAbsR = Math.max(...values.map(v => Math.abs(v.netR)), 0.01)
            return (
              <div key={field}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{field}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="journal-table">
                    <thead><tr><th>Värde</th><th>Trades</th><th>WR</th><th>Netto R</th><th style={{ width: 140 }}>R-fördelning</th></tr></thead>
                    <tbody>
                      {values.map(v => (
                        <tr key={v.val}>
                          <td style={{ color: 'var(--text)', fontWeight: 500 }}>{v.val}</td>
                          <td className="mono">{v.w}V / {v.l}F{v.be > 0 ? ` / ${v.be}BE` : ''}</td>
                          <td className="mono" style={{ color: v.wr >= 50 ? 'var(--green)' : v.wr !== null ? 'var(--red)' : 'var(--text4)' }}>{v.wr !== null ? v.wr + '%' : '—'}</td>
                          <td className="mono" style={{ color: v.netR > 0 ? 'var(--green)' : v.netR < 0 ? 'var(--red)' : 'var(--text3)' }}>{v.netR > 0 ? '+' : ''}{v.netR}R</td>
                          <td><div style={{ position: 'relative', height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>{v.netR >= 0 ? <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: (v.netR / maxAbsR * 50) + '%', background: 'var(--green)', borderRadius: '0 4px 4px 0' }} /> : <div style={{ position: 'absolute', right: '50%', top: 0, height: '100%', width: (Math.abs(v.netR) / maxAbsR * 50) + '%', background: 'var(--red)', borderRadius: '4px 0 0 4px' }} />}<div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border2)' }} /></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}