import { useState, useMemo, useCallback } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { useAuth } from '../hooks/useAuth'

const ResponsiveGridLayout = WidthProvider(Responsive)

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
const BREAKPOINT_COLS = { lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 }
const MOBILE_BREAKPOINTS = ['xs', 'xxs']
const ROW_HEIGHT = 32

// Rimliga startstorlekar per widget (i rader à ROW_HEIGHT px). Det här är
// bara var widgeten hamnar FÖRSTA gången en användare öppnar sidan efter
// uppdateringen – inget tak. Användaren drar/ändrar storlek fritt efteråt,
// och den justeringen sparas permanent (se buildLayouts/persist nedan).
const DEFAULT_SIZES = {
  // Dashboard
  welcome: { w: 2, h: 4 },
  calendar: { w: 1, h: 7 },
  today: { w: 1, h: 4 },
  stats: { w: 1, h: 5 },
  equity: { w: 1, h: 6 },
  recent: { w: 1, h: 6 },
  streak: { w: 1, h: 5 },
  // Analytics
  grade_emotion: { w: 1, h: 5 },
  strategy: { w: 2, h: 6 },
  mfe: { w: 2, h: 7 },
  sl_opt: { w: 2, h: 6 },
  psych: { w: 2, h: 5 },
  weekday: { w: 2, h: 5 },
  rr: { w: 2, h: 7 },
  custom_fields: { w: 2, h: 5 },
  ai: { w: 2, h: 7 },
}

function sizeFor(widget) {
  return DEFAULT_SIZES[widget.id] || { w: widget.span && widget.span > 1 ? 2 : 1, h: 5 }
}

// y: Infinity är ett dokumenterat react-grid-layout-knep för "placera längst
// ner, låt compact-algoritmen räkna ut var". Används både för förstagångs-
// layout och när en ny widget (t.ex. tillagd i en release) saknar sparad
// position för en given breakpoint.
function generateLayoutItems(widgetList, cols) {
  return widgetList.map(w => {
    const s = sizeFor(w)
    return { i: w.id, x: 0, y: Infinity, w: Math.min(s.w, cols), h: s.h }
  })
}

// Bygger en fullständig layout per breakpoint: återanvänder sparade
// x/y/w/h där de finns (så en användares egen drag/resize aldrig nollställs),
// och fyller på med default-storlek för widgets som saknas i den sparade
// datan – antingen för att de är helt nya, eller för att den sparade datan
// är i det gamla {order,hidden,seenNew}-formatet utan positioner alls.
function buildLayouts(widgets, existingLayouts) {
  const layouts = {}
  for (const [bp, cols] of Object.entries(BREAKPOINT_COLS)) {
    const existing = (existingLayouts?.[bp] || []).filter(item => widgets.some(w => w.id === item.i))
    const existingIds = new Set(existing.map(item => item.i))
    const missing = widgets.filter(w => !existingIds.has(w.id))
    layouts[bp] = [...existing, ...generateLayoutItems(missing, cols)]
  }
  return layouts
}

export default function DragGrid({ pageKey, widgets }) {
  const { userSettings, saveSettings } = useAuth()
  const [showManager, setShowManager] = useState(false)
  const [breakpoint, setBreakpoint] = useState('lg')

  const saved = userSettings?.widgets?.[pageKey]
  const hidden = (saved?.hidden || []).filter(id => widgets.find(w => w.id === id))
  const seenNew = saved?.seenNew || []
  const newWidgets = widgets.filter(w => w.newIn && !seenNew.includes(w.id) && !hidden.includes(w.id))

  const layouts = useMemo(() => buildLayouts(widgets, saved?.layouts), [widgets, saved?.layouts])
  const visible = widgets.filter(w => !hidden.includes(w.id))
  const visibleLayouts = useMemo(() => {
    const out = {}
    for (const bp of Object.keys(layouts)) out[bp] = layouts[bp].filter(item => !hidden.includes(item.i))
    return out
  }, [layouts, hidden])

  async function persist(nextLayouts, hiddenList, seenNewList) {
    const current = userSettings?.widgets || {}
    await saveSettings({ widgets: { ...current, [pageKey]: { layouts: nextLayouts, hidden: hiddenList, seenNew: seenNewList } } })
  }

  const handleLayoutChange = useCallback((_current, allLayouts) => {
    // react-grid-layout ger bara tillbaka layouts för breakpoints den faktiskt
    // renderat den här sessionen. Slå ihop med det vi redan hade sparat så vi
    // inte tappar t.ex. xs-layouten bara för att användaren aldrig öppnat
    // sidan på mobil i just den här sessionen.
    persist({ ...layouts, ...allLayouts }, hidden, seenNew)
  }, [layouts, hidden, seenNew, pageKey])

  function toggleHide(id) {
    const next = hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id]
    persist(layouts, next, seenNew)
  }

  function dismissNew() {
    persist(layouts, hidden, [...seenNew, ...newWidgets.map(w => w.id)])
  }

  const isMobile = MOBILE_BREAKPOINTS.includes(breakpoint)

  return (
    <div>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => setShowManager(m => !m)} className="btn btn-ghost btn-sm">
          {showManager ? '✕ Stäng' : '⊞ Anpassa widgets'}
        </button>
      </div>

      {showManager && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Visa/dölj widgets — dra i kortens hörn och kant nedan för att ändra storlek och placering fritt
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {widgets.map(w => {
              const isHidden = hidden.includes(w.id)
              return (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--r)',
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  opacity: isHidden ? 0.5 : 1,
                }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{w.title}</span>
                  {w.newIn && !seenNew.includes(w.id) && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 20 }}>NY</span>
                  )}
                  <button onClick={() => toggleHide(w.id)}
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

      <ResponsiveGridLayout
        className="drag-grid"
        layouts={visibleLayouts}
        breakpoints={BREAKPOINTS}
        cols={BREAKPOINT_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactType="vertical"
        isDraggable={!isMobile}
        isResizable={!isMobile}
        draggableHandle=".widget-drag-handle"
        onBreakpointChange={setBreakpoint}
        onLayoutChange={handleLayoutChange}
        measureBeforeMount={false}
        useCSSTransforms
      >
        {visible.map(w => (
          <div key={w.id} className="widget-grid-item">
            {!isMobile && <div className="widget-drag-handle" title="Dra för att flytta">⠿⠿</div>}
            <div className="widget-grid-item-inner">{w.content}</div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
