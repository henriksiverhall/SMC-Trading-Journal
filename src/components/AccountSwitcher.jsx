import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

const STATUS_DOT = { eval: 'var(--amber)', funded: 'var(--green)', failed: 'var(--red)', active: 'var(--accent)', archived: 'var(--text4)' }

export default function AccountSwitcher({ onNavigate }) {
  const { accounts, activeAccountId, switchAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!accounts.length) return null
  const active = accounts.find(a => a.id === activeAccountId) || accounts[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)',
        padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text2)',
        maxWidth: 180,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[active?.status] || 'var(--text4)', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active?.name || 'Inget konto'}</span>
        <span style={{ color: 'var(--text4)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 220,
          background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)' }}>Aktivt konto</div>
          {accounts.map(a => (
            <button key={a.id} onClick={() => { switchAccount(a.id); setOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '9px 12px', background: a.id === activeAccountId ? 'var(--accent-dim)' : 'none', border: 'none',
              color: a.id === activeAccountId ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font)',
            }}
              onMouseEnter={e => { if (a.id !== activeAccountId) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (a.id !== activeAccountId) e.currentTarget.style.background = 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[a.status] || 'var(--text4)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              {a.id === activeAccountId && <span style={{ fontSize: 11 }}>✓</span>}
            </button>
          ))}
          <button onClick={() => { setOpen(false); (onNavigate || window.__tlNavigate)?.('profile') }} style={{
            width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderTop: '1px solid var(--border)',
            color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            ⚙ Hantera konton →
          </button>
        </div>
      )}
    </div>
  )
}
