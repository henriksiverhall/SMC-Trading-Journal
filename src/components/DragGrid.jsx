import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

// ── DragGrid ──────────────────────────────────────────────────────────────────
// Props:
//   pageKey   – string key for userSettings.widgets.{pageKey}
//   widgets   – [{ id, title, content, defaultVisible, newIn? }]
//   columns   – 1 | 2 (default 1)

export default function DragGrid({ pageKey, widgets, columns = 1 }) {
  const { userSettings, saveSettings } = useAuth()
  const [showManager, setShowManager] = useState(false)
  const dragId = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const saved = userSettings?.widgets?.[pageKey]
  const savedOrder = saved?.order || widgets.map(w => w.id)
  const savedHidden = saved?.hidden || []
  const seenNew = saved?.seenNew || []

  // Merge: add new widget ids not yet in saved order
  const fullOrder = [
    ...savedOrder.filter(id => widgets.find(w => w.id === id)),
    ...widgets.filter(w => !savedOrder.includes(w.id)).map(w => w.id)
  ]
  const hidden = savedHidden.filter(id => widgets.find(w => w.id === id))

  // New widgets user hasn't seen yet
  const newWidgets = widgets.filter(w => w.newIn && !seenNew.includes(w.id) && !savedHidden.includes(w.id))

  async function persist(order, hiddenList, seenNewList) {
    const current = userSettings?.widgets || {}
    await saveSettings({
      widgets: {
        ...current,
        [pageKey]: { order, hidden: hiddenList, seenNew: seenNewList }
      }
    })
  }

  function handleDragStart(e, id) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    setDragOver(null)
    if (!dragId.current || dragId.current === targetId) return
    const order = [...fullOrder]
    const from = order.indexOf(dragId.current)
    const to = order.indexOf(targetId)
    if (from < 0 || to < 0) return
    order.splice(from, 1)
    order.splice(to, 0, dragId.current)
    persist(order, hidden, seenNew)
    dragId.current = null
  }

  function toggleHide(id) {
    const next = hidden.includes(id)
      ? hidden.filter(h => h !== id)
      : [...hidden, id]
    persist(fullOrder, next, seenNew)
  }

  function dismissNew() {
    const nextSeen = [...seenNew, ...newWidgets.map(w => w.id)]
    persist(fullOrder, hidden, nextSeen)
  }

  const visible = fullOrder.filter(id => !hidden.includes(id))

  return (
    <div>
      {/* New widget banner */}
      {newWidgets.length > 0 && (
        <div style={{
          marginBottom: 16, padding: '10px 16px',
          background: 'var(--accent-dim)', border: '1px solid rgba(0,212,170,0.25)',
          borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            ✨ {newWidgets.length === 1
              ? `Ny widget tillgänglig: ${newWidgets[0].title}`
              : `${newWidgets.length} nya widgets tillgängliga`}
          </span>
          <button onClick={() => setShowManager(true)}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Lägg till
          </button>
          <button onClick={dismissNew}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 'auto' }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => { setShowManager(m => !m); if (newWidgets.length) dismissNew() }}
          className="btn btn-ghost btn-sm">
          {showManager ? '✕ Stäng' : '⊞ Anpassa widgets'}
        </button>
      </div>

      {/* Widget manager */}
      {showManager && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--r2)', padding: 16, marginBottom: 16
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Välj widgets – dra för att sortera
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fullOrder.map(id => {
              const w = widgets.find(w => w.id === id)
              if (!w) return null
              const isHidden = hidden.includes(id)
              return (
                <div key={id}
                  draggable
                  onDragStart={e => handleDragStart(e, id)}
                  onDragOver={e => { e.preventDefault(); setDragOver(id) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 'var(--r)',
                    background: dragOver === id ? 'var(--accent-dim)' : 'var(--bg3)',
                    border: `1px solid ${dragOver === id ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
                    cursor: 'grab', transition: 'background 0.1s',
                    opacity: isHidden ? 0.5 : 1,
                  }}>
                  <span style={{ color: 'var(--text4)', fontSize: 14, userSelect: 'none' }}>⠿</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{w.title}</span>
                  {w.newIn && !seenNew.includes(id) && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 20 }}>NY</span>
                  )}
                  <button onClick={() => toggleHide(id)}
                    style={{
                      background: isHidden ? 'var(--bg4)' : 'var(--accent-dim)',
                      border: `1px solid ${isHidden ? 'var(--border2)' : 'rgba(0,212,170,0.3)'}`,
                      color: isHidden ? 'var(--text4)' : 'var(--accent)',
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'var(--font)'
                    }}>
                    {isHidden ? 'Dold' : 'Aktiv'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Widget grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: columns === 2 ? '1fr 1fr' : '1fr',
        gap: 16
      }}>
        {visible.map(id => {
          const w = widgets.find(w => w.id === id)
          if (!w) return null
          return (
            <div key={id}
              draggable={!showManager}
              onDragStart={e => !showManager && handleDragStart(e, id)}
              onDragOver={e => { if (!showManager) { e.preventDefault(); setDragOver(id) } }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => !showManager && handleDrop(e, id)}
              style={{
                outline: dragOver === id ? '2px solid rgba(0,212,170,0.4)' : 'none',
                borderRadius: 'var(--r2)',
                gridColumn: w.span === 2 ? 'span 2' : undefined,
              }}>
              {w.content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
