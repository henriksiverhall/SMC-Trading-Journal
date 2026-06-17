import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import { createClient } from '@supabase/supabase-js'

const sbProd = createClient(
  'https://zmtpgnnqtkkdsrswhrzk.supabase.co',
  'sb_publishable_ApF8t4SG9vnJC5_ZYVvRWg_PlS2t7xJ'
)
const PROD_ADMIN_ID = '9ed649b7-8ad8-4ba7-bc89-ec0efa566b9d'

const COLUMNS = [
  { id: 'todo',       label: 'Att göra',  emoji: '📌' },
  { id: 'bugs',       label: 'Buggar',    emoji: '🐛' },
  { id: 'inprogress', label: 'Pågående',  emoji: '🔄' },
  { id: 'waiting',    label: 'Väntar',    emoji: '⏳' },
  { id: 'done',       label: 'Klar',      emoji: '✅' },
  { id: 'parked',     label: 'Parkerad',  emoji: '🅿️' },
]

const TAG_COLORS = {
  '[DEV]':  { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  '[PROD]': { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
  '[IDÉ]':  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
}

const PRIO_COLORS = {
  high:   { color: '#ef4444', label: '🔴' },
  medium: { color: '#f59e0b', label: '🟡' },
  low:    { color: '#22c55e', label: '🟢' },
}

const SORT_OPTIONS = [
  { id: 'manual',     label: 'Manuell ordning' },
  { id: 'priority',   label: 'Prioritet' },
  { id: 'created_at', label: 'Skapdatum' },
  { id: 'title',      label: 'Titel A–Ö' },
]

function getTag(title) {
  for (const tag of Object.keys(TAG_COLORS)) {
    if (title?.startsWith(tag)) return tag
  }
  return null
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(str, max = 90) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str
}

function sortCards(cards, sortBy) {
  if (sortBy === 'manual') return cards
  return [...cards].sort((a, b) => {
    if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 }
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
    }
    if (sortBy === 'created_at') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    if (sortBy === 'title') {
      const ta = getTag(a.title) ? a.title.slice(getTag(a.title).length).trim() : a.title
      const tb = getTag(b.title) ? b.title.slice(getTag(b.title).length).trim() : b.title
      return ta.localeCompare(tb, 'sv')
    }
    return 0
  })
}

function CardTag({ tag }) {
  if (!tag) return null
  const s = TAG_COLORS[tag]
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color, letterSpacing: 0.3, flexShrink: 0 }}>{tag}</span>
}

function Card({ card, colId, onDragStart, onCardClick }) {
  const tag = getTag(card.title)
  const titleClean = tag ? card.title.slice(tag.length).trim() : card.title
  const prio = PRIO_COLORS[card.priority]
  const ingress = truncate(card.desc)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card.id, colId)}
      onClick={() => onCardClick(card, colId)}
      style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '10px 12px',
        cursor: 'pointer', userSelect: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: ingress ? 6 : 0 }}>
        <CardTag tag={tag} />
        {prio && <span title={card.priority} style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>{prio.label}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>{titleClean}</span>
      </div>
      {ingress && (
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, margin: '0 0 6px 0' }}>{ingress}</p>
      )}
      {card.created_at && (
        <div style={{ fontSize: 10, color: 'var(--text4)' }}>{formatDate(card.created_at)}</div>
      )}
    </div>
  )
}

function CardDetailModal({ card, colId, columns, onSave, onDelete, onClose, isAdmin }) {
  const tag = getTag(card.title)
  const titleClean = tag ? card.title.slice(tag.length).trim() : card.title
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(titleClean)
  const [desc, setDesc] = useState(card.desc || '')
  const [selTag, setSelTag] = useState(tag || '')
  const [prio, setPrio] = useState(card.priority || 'medium')
  const [targetCol, setTargetCol] = useState(colId)

  function handleSave() {
    const fullTitle = selTag ? `${selTag} ${title.trim()}` : title.trim()
    onSave(card.id, colId, targetCol, { ...card, title: fullTitle, desc: desc.trim(), priority: prio })
    setEditing(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r2)', padding: '28px 32px', width: 640, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <CardTag tag={tag} />
              {card.priority && (
                <span style={{ fontSize: 11, fontWeight: 600, color: PRIO_COLORS[card.priority]?.color, background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20 }}>
                  {PRIO_COLORS[card.priority]?.label} {card.priority}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text4)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 20 }}>
                {columns.find(c => c.id === colId)?.emoji} {columns.find(c => c.id === colId)?.label}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{titleClean}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0, lineHeight: 1 }}>✕</button>
        </div>

        {!editing ? (
          <>
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 20, whiteSpace: 'pre-wrap', background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '16px 18px', minHeight: 80 }}>
              {card.desc || <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>Ingen beskrivning</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 20 }}>
              {card.created_at && <>Skapat: {formatDate(card.created_at)}</>}
              {card.updated_at && <> · Uppdaterat: {formatDate(card.updated_at)}</>}
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditing(true)} style={btnPrimary}>Redigera</button>
                <button onClick={() => onDelete(card.id, colId)} style={btnDanger}>Ta bort</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tagg</label>
                <select value={selTag} onChange={e => setSelTag(e.target.value)} style={inputStyle}>
                  <option value="">Ingen</option>
                  {Object.keys(TAG_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Prioritet</label>
                <select value={prio} onChange={e => setPrio(e.target.value)} style={inputStyle}>
                  <option value="high">🔴 Hög</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Låg</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Titel</label>
              <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Beskrivning</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={8}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font)', lineHeight: 1.7 }} />
            </div>
            <div>
              <label style={labelStyle}>Flytta till kolumn</label>
              <select value={targetCol} onChange={e => setTargetCol(e.target.value)} style={inputStyle}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} style={btnPrimary}>Spara</button>
              <button onClick={() => setEditing(false)} style={btnCancel}>Avbryt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddCardForm({ colId, onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [prio, setPrio] = useState('medium')
  function handleSubmit() {
    if (!title.trim()) return
    onAdd(colId, title.trim(), desc.trim(), prio)
    setTitle(''); setDesc(''); setPrio('medium')
  }
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Titel (t.ex. [DEV] Ny funktion)" style={inputStyle} />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beskrivning (valfritt)" rows={2}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font)' }} />
      <select value={prio} onChange={e => setPrio(e.target.value)} style={inputStyle}>
        <option value="high">🔴 Hög</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Låg</option>
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} style={btnPrimary}>Lägg till</button>
        <button onClick={onCancel} style={btnCancel}>Avbryt</button>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box' }
const btnPrimary = { background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--r)', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }
const btnCancel  = { background: 'var(--bg4)', color: 'var(--text2)', border: 'none', borderRadius: 'var(--r)', padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }
const btnDanger  = { background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 4 }

export default function Roadmap() {
  const { isAdmin } = useAuth()
  const [tasks, setTasks] = useState(Object.fromEntries(COLUMNS.map(c => [c.id, []])))
  const [addingIn, setAddingIn] = useState(null)
  const [detailCard, setDetailCard] = useState(null)
  const dragCard = useRef(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('manual')
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    async function load() {
      const { data } = await sbProd.from('user_settings').select('settings').eq('user_id', PROD_ADMIN_ID).single()
      if (data?.settings?.roadmapTasks) {
        const rt = data.settings.roadmapTasks
        if (typeof rt === 'object' && !Array.isArray(rt)) setTasks(rt)
      }
      setLoading(false)
    }
    load()
  }, [])

  // persist() always re-reads the CURRENT server state right before applying
  // the change, then writes that back. This is critical: if it instead applied
  // `tasks` (React's in-memory copy from page-load) as the base, any change made
  // elsewhere since page-load (another tab, an admin SQL edit, etc.) would get
  // silently overwritten - the exact bug where moved/edited cards "reverted" on
  // refresh. `updaterFn` describes the change as a pure function so it can be
  // re-applied against fresh data instead of a stale local snapshot.
  async function persist(updaterFn) {
    setSaving(true)
    const { data } = await sbProd.from('user_settings').select('settings').eq('user_id', PROD_ADMIN_ID).single()
    const freshSettings = data?.settings || {}
    const rt = freshSettings.roadmapTasks
    const freshTasks = (rt && typeof rt === 'object' && !Array.isArray(rt)) ? rt : tasks
    const newTasks = updaterFn(freshTasks)
    setTasks(newTasks)
    const merged = { ...freshSettings, roadmapTasks: newTasks }
    await sbProd.from('user_settings').upsert({ user_id: PROD_ADMIN_ID, settings: merged, updated_at: new Date().toISOString() })
    setSaving(false)
  }

  function toggleCollapse(colId) { setCollapsed(c => ({ ...c, [colId]: !c[colId] })) }

  function handleDragStart(e, cardId, fromCol) { dragCard.current = { id: cardId, fromCol }; e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, colId) { e.preventDefault(); setDragOverCol(colId) }
  function handleDrop(e, toCol) {
    e.preventDefault(); setDragOverCol(null)
    if (!dragCard.current) return
    const { id, fromCol } = dragCard.current
    dragCard.current = null
    if (fromCol === toCol) return
    persist(freshTasks => {
      const updated = { ...freshTasks }
      const card = (updated[fromCol] || []).find(c => c.id === id)
      if (!card) return freshTasks
      updated[fromCol] = (updated[fromCol] || []).filter(c => c.id !== id)
      updated[toCol] = [...(updated[toCol] || []), card]
      return updated
    })
  }

  function handleAdd(colId, title, desc, priority) {
    const newCard = { id: crypto.randomUUID(), title, desc, priority, created_at: new Date().toISOString(), updated_at: '' }
    persist(freshTasks => ({ ...freshTasks, [colId]: [...(freshTasks[colId] || []), newCard] }))
    setAddingIn(null)
  }

  function handleDelete(cardId, colId) {
    persist(freshTasks => ({ ...freshTasks, [colId]: (freshTasks[colId] || []).filter(c => c.id !== cardId) }))
    setDetailCard(null)
  }

  function handleEditSave(cardId, fromCol, toCol, updated) {
    persist(freshTasks => {
      const newTasks = { ...freshTasks }
      newTasks[fromCol] = (newTasks[fromCol] || []).filter(c => c.id !== cardId)
      newTasks[toCol] = [...(newTasks[toCol] || []), { ...updated, updated_at: new Date().toISOString() }]
      return newTasks
    })
    setDetailCard(null)
  }

  const totalCards = Object.values(tasks).flat().length

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar roadmap…</div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Topbar title="Roadmap" subtitle={`${totalCards} kort${saving ? ' · Sparar…' : ''}`} />

      <div style={{ flex: 1, padding: '16px 24px', overflowX: 'auto' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Sortera:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text2)', fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font)' }}>
            {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>

        {/* Board */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {COLUMNS.map(col => {
            const isCollapsed = collapsed[col.id]
            const cards = sortCards(tasks[col.id] || [], sortBy)
            const isDragTarget = dragOverCol === col.id
            return (
              <div key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, col.id)}
                style={{
                  width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
                  background: isDragTarget ? 'rgba(0,212,170,0.04)' : 'var(--bg2)',
                  border: `1px solid ${isDragTarget ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--r2)', padding: 12,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? 0 : 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{col.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{col.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text4)', background: 'var(--bg4)', borderRadius: 20, padding: '1px 7px' }}>{cards.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {isAdmin && !isCollapsed && (
                      <button onClick={() => setAddingIn(addingIn === col.id ? null : col.id)} title="Lägg till kort"
                        style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', fontFamily: 'var(--font)' }}>+</button>
                    )}
                    <button onClick={() => toggleCollapse(col.id)} title={isCollapsed ? 'Expandera' : 'Minimera'}
                      style={{ background: 'none', border: 'none', color: 'var(--text4)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                      ▼
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    {cards.map(card => (
                      <Card key={card.id} card={card} colId={col.id}
                        onDragStart={handleDragStart}
                        onCardClick={(c, cid) => setDetailCard({ card: c, colId: cid })}
                      />
                    ))}
                    {addingIn === col.id && <AddCardForm colId={col.id} onAdd={handleAdd} onCancel={() => setAddingIn(null)} />}
                    {cards.length === 0 && addingIn !== col.id && (
                      <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--r)', padding: '16px 12px', textAlign: 'center', color: 'var(--text4)', fontSize: 12 }}>Tom</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {detailCard && (
        <CardDetailModal card={detailCard.card} colId={detailCard.colId} columns={COLUMNS}
          onSave={handleEditSave} onDelete={handleDelete}
          onClose={() => setDetailCard(null)} isAdmin={isAdmin} />
      )}
    </div>
  )
}
