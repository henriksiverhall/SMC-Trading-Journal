// TvOnboarding.jsx – TradingView Integration-tab i Profile
import { useState, useEffect, useRef } from 'react'
import { sb } from '../lib/supabase'
import { WORKER_URL } from '../lib/constants'

export default function TvOnboarding({ user, userSettings, saveSettings }) {
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [pingStatus, setPingStatus] = useState(null)
  const [regen, setRegen] = useState(false)
  const [step, setStep] = useState(1)
  const pingChannelRef = useRef(null)

  useEffect(() => { setToken(userSettings?.tv_webhook_token || '') }, [userSettings?.tv_webhook_token])

  const webhookUrl = token ? `${WORKER_URL}/tv-webhook/${token}` : ''

  async function copyUrl() {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function regenToken() {
    if (!confirm('Återskapa webhook-URL? Din gamla URL slutar fungera direkt.')) return
    setRegen(true)
    const { data } = await sb.auth.getSession()
    const tok = data?.session?.access_token
    const res = await fetch(`${WORKER_URL}/tv-webhook-regen`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } })
    const json = await res.json()
    if (json.success) { setToken(json.token); await saveSettings({ tv_webhook_token: json.token }) }
    setRegen(false)
  }

  async function testPing() {
    if (!token) return
    setPingStatus('waiting'); setStep(5)
    const channel = sb.channel(`tv-ping-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tv_pending', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new?.payload?._type === 'ping') { setPingStatus('ok'); channel.unsubscribe() }
      })
      .subscribe()
    pingChannelRef.current = channel
    try {
      const res = await fetch(`${WORKER_URL}/tv-webhook-ping/${token}`, { method: 'POST' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
    } catch { setPingStatus('error'); channel.unsubscribe(); return }
    setTimeout(() => { if (pingStatus === 'waiting') { setPingStatus('error'); channel.unsubscribe() } }, 8000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 'var(--r2)', padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🔗 TradingView-integration</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>Anslut dina TradingView-charts till TradeLog. När du markerar en trade i TradingView fylls formuläret i automatiskt med entry, SL, TP, symbol, riktning och tidsstämpel. Fungerar vid backtesting och live trading.</div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Installationsguide</div></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>1</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Din webhook-URL är redo</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{webhookUrl || 'Genererar…'}</div>
                <button className="btn btn-primary btn-sm" onClick={copyUrl} style={{ flexShrink: 0 }}>{copied ? '✓ Kopierad' : '📋 Kopiera'}</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 6 }}>Håll URL:en hemlig.
                <button onClick={regenToken} disabled={regen} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11, padding: '0 0 0 8px', fontFamily: 'var(--font)' }}>{regen ? 'Återskapar…' : '↺ Återskapa ny URL'}</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= 2 ? 'var(--accent)' : 'var(--bg3)', color: step >= 2 ? 'var(--bg)' : 'var(--text4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>2</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Öppna TradingView</div>
              <a href="https://www.tradingview.com/chart/" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" onClick={() => setStep(s => Math.max(s, 3))}>Öppna TradingView →</a>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= 3 ? 'var(--accent)' : 'var(--bg3)', color: step >= 3 ? 'var(--bg)' : 'var(--text4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>3</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Lägg till TradeLog Connector</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>1. Klicka på <strong style={{ color: 'var(--text)' }}>Indicators</strong> högst upp i TradingView<br />2. Sök på <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>TradeLog Connector</strong><br />3. Klicka och välj <strong style={{ color: 'var(--text)' }}>Add to chart</strong></div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setStep(s => Math.max(s, 4))}>Klart →</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= 4 ? 'var(--accent)' : 'var(--bg3)', color: step >= 4 ? 'var(--bg)' : 'var(--text4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>4</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Klistra in din URL i indikatorn</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>1. Klicka kugghjulet ⚙ på TradeLog Connector-raden<br />2. Under <strong style={{ color: 'var(--text)' }}>Inputs</strong> – fältet <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>Webhook URL</strong><br />3. Klistra in URL:en (Ctrl+V) och klicka <strong style={{ color: 'var(--text)' }}>OK</strong></div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setStep(s => Math.max(s, 5))}>Klart →</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: pingStatus === 'ok' ? 'var(--green)' : step >= 5 ? 'var(--accent)' : 'var(--bg3)', color: step >= 5 ? 'var(--bg)' : 'var(--text4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{pingStatus === 'ok' ? '✓' : '5'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Testa anslutningen</div>
              {pingStatus === 'ok' && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>✅ Anslutningen fungerar! TradeLog och TradingView är nu länkade.</div>}
              {pingStatus === 'error' && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>❌ Fick inget svar. Kontrollera att URL:en är korrekt inklistrad.</div>}
              {pingStatus === 'waiting' && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>⏳ Väntar på svar…</div>}
              <button className="btn btn-primary btn-sm" onClick={testPing} disabled={pingStatus === 'waiting' || !token}>{pingStatus === 'waiting' ? 'Väntar…' : pingStatus === 'ok' ? '↺ Testa igen' : '🔌 Skicka testping'}</button>
            </div>
          </div>

        </div>
      </div>

      {pingStatus === 'ok' && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--r2)', padding: '14px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>🎉 Integration aktiv</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Gå till Journal och börja handla/backtesta i TradingView. Entry, SL, TP och mer fylls i automatiskt.</div>
        </div>
      )}
    </div>
  )
}
