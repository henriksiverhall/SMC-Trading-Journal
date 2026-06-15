import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function DragGrid({ pageKey, widgets, columns = 1 }) {
  const { userSettings, saveSettings } = useAuth()
  const [showManager, setShowManager] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)

  const saved      = userSettings?.widgets?.[pageKey]
  const savedOrder = saved?.order   || widgets.map(w => w.id)
  const savedHidden= saved?.hidden  || []
  const seenNew    = saved?.seenNew || []

  const fullOrder = [
    ...savedOrder.filter(id => widgets.find(w => w.id === id)),
    ...widgets.filter(w => !savedOrder.includes(w.id)).map(w => w.id)
  ]
  const hidden = savedHidden.filter(id => widgets.find(w => w.id === id))
  const newWidgets = widgets.filter(w => w.newIn && !seenNew.includes(w.id) && !hidden.includes(w.id))
  const visible    = fullOrder.filter(id => !hidden.includes(id))

  async function persist(order, hiddenList, seenNewList) {
    const current = userSettings?.widgets || {}
    await saveSettings({ widgets: { ...current, [pageKey]: { order, hidden: hiddenList, seenNew: seenNewList } } })
  }

  function handleDragStart(e, id) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image so we control visuals ourselves
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  function handleDragOver(e, id) {
    e.preventDefault()
    if (id !== draggingId) setDropTargetId(id)
  }

  function handleDragEnd() {
    if (draggingId && dropTargetId && draggingId !== dropTargetId) {
      const order = [...fullOrder]
      const from  = order.indexOf(draggingId)
      const to    = order.indexOf(dropTargetId)
      if (from >= 0 && to >= 0) {
        order.splice(from, 1)
        order.splice(to, 0, draggingId)
        persist(order, hidden, seenNew)
      }
    }
    setDraggingId(null)
    setDropTargetId(null)
  }

  function toggleHide(id) {
    const next = hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id]
    persist(fullOrder, next, seenNew)
  }

  function dismissNew() {
    persist(fullOrder, hidden, [...seenNew, ...newWidgets.map(w => w.id)])
  }

  function moveWidget(id, dir) {
    const order = [...fullOrder]
    const idx   = order.indexOf(id)
    const next  = idx + dir
    if (next < 0 || next >= order.length) return
    ;[order[idx], order[next]] = [order[next], order[idx]]
    persist(order, hidden, seenNew)
  }

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
            ✨ {newWidgets.length === 1 ? `Ny widget: ${newWidgets[0].title}` : `${newWidgets.length} nya widgets tillgängliga`}
          </span>
          <button onClick={() => { setShowManager(true); dismissNew() }}
            style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--r)', padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Lägg till
          </button>
          <button onClick={dismissNew}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, marginLeft: 'auto' }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowManager(m => !m)} className="btn btn-ghost btn-sm">
          {showManager ? '✕ Stäng' : '⊞ Anpassa widgets'}
        </button>
      </div>

      {/* Widget manager */}
      {showManager && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Hantera widgets – använd pilarna för att sortera
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fullOrder.map((id, idx) => {
              const w = widgets.find(w => w.id === id)
              if (!w) return null
              const isHidden = hidden.includes(id)
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--r)',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  opacity: isHidden ? 0.5 : 1,
                }}>
                  {/* Move arrows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => moveWidget(id, -1)} disabled={idx === 0}
                      style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 10, padding: '0 4px', lineHeight: 1, fontFamily: 'var(--font)' }}>▲</button>
                    <button onClick={() => moveWidget(id, 1)} disabled={idx === fullOrder.length - 1}
                      style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 10, padding: '0 4px', lineHeight: 1, fontFamily: 'var(--font)' }}>▼</button>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{w.title}</span>
                  {w.newIn && !seenNew.includes(id) && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 20 }}>NY</span>
                  )}
                  <button onClick={() => toggleHide(id)}
                    style={{
                      border: `1px solid ${isHidden ? 'var(--border2)' : 'rgba(0,212,170,0.3)'}`,
                      background: isHidden ? 'var(--bg4)' : 'var(--accent-dim)',
                      color: isHidden ? 'var(--text4)' : 'var(--accent)',
                      borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'var(--font)'
                    }}>
                    {isHidden ? '+ Lägg till' : '✓ Aktiv'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Widget list – single column with drag */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visible.map(id => {
          const w = widgets.find(w => w.id === id)
          if (!w) return null
          const isDragging   = draggingId   === id
          const isDropTarget = dropTargetId === id

          return (
            <div key={id}
              draggable
              onDragStart={e => handleDragStart(e, id)}
              onDragOver={e => handleDragOver(e, id)}
              onDragEnd={handleDragEnd}
              style={{
                position: 'relative',
                opacity: isDragging ? 0.35 : 1,
                transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                transition: 'opacity 0.15s, transform 0.15s',
                outline: isDropTarget ? '2px dashed var(--accent)' : '2px solid transparent',
                outlineOffset: 4,
                borderRadius: 'var(--r2)',
              }}
            >
              {/* Drop indicator */}
              {isDropTarget && (
                <div style={{
                  position: 'absolute', top: -10, left: 0, right: 0, height: 3,
                  background: 'var(--accent)', borderRadius: 3, zIndex: 10,
                  boxShadow: '0 0 8px rgba(0,212,170,0.6)',
                }} />
              )}
              {/* Drag handle overlay */}
              <div style={{
                position: 'absolute', top: 12, right: 14, zIndex: 5,
                color: 'var(--text4)', fontSize: 14, cursor: 'grab',
                opacity: 0.4, userSelect: 'none',
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                title="Dra för att flytta"
              >⠿⠿</div>
              {w.content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
