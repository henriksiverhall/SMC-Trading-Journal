import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'
import { createClient } from '@supabase/supabase-js'

// Kanban alltid mot PROD – en gemensam roadmap oavsett miljö
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
  '[DEV]':  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  '[PROD]': { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  '[IDÉ]':  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
}

function getTag(title) {
  for (const tag of Object.keys(TAG_COLORS)) {
    if (title?.startsWith(tag)) return tag
  }
  return null
}

function CardTag({ tag }) {
  if (!tag) return null
  const style = TAG_COLORS[tag]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px',
      borderRadius: 4, background: style.bg, color: style.color,
      letterSpacing: 0.3, flexShrink: 0
    }}>{tag}</span>
  )
}

function Card({ card, colId, onDragStart, onEdit, onDelete, isAdmin }) {
  const tag = getTag(card.title)
  const titleClean = tag ? card.title.slice(tag.length).trim() : card.title

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id, colId)}
      style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '10px 12px',
        cursor: 'grab', userSelect: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border2)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: card.desc ? 6 : 0 }}>
        <CardTag tag={tag} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
          {titleClean}
        </span>
      </div>
      {card.desc && (
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 8 }}>
          {card.desc}
        </p>
      )}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={() => onEdit(card, colId)} style={btnStyle('var(--text4)')}>Redigera</button>
          <button onClick={() => onDelete(card.id, colId)} style={btnStyle('#ef4444')}>Ta bort</button>
        </div>
      )}
    </div>
  )
}

function btnStyle(color) {
  return {
    background: 'none', border: 'none', color, fontSize: 11,
    fontWeight: 600, cursor: 'pointer', padding: '2px 0',
    fontFamily: 'var(--font)'
  }
}

function AddCardForm({ colId, onAdd, onCancel }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  function handleSubmit() {
    if (!title.trim()) return
    onAdd(colId, title.trim(), desc.trim())
    setTitle(''); setDesc('')
  }

  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border2)',
      borderRadius: 'var(--r)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Titel (t.ex. [DEV] Ny funktion)"
        style={inputStyle}
      />
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Beskrivning (valfritt)"
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} style={primaryBtn}>Lägg till</button>
        <button onClick={onCancel} style={cancelBtn}>Avbryt</button>
      </div>
    </div>
  )
}

function EditCardModal({ card, colId, columns, onSave, onClose }) {
  const tag = getTag(card.title)
  const titleClean = tag ? card.title.slice(tag.length).trim() : card.title
  const [title, setTitle] = useState(titleClean)
  const [desc, setDesc]   = useState(card.desc || '')
  const [selTag, setSelTag] = useState(tag || '')
  const [targetCol, setTargetCol] = useState(colId)

  function handleSave() {
    const fullTitle = selTag ? `${selTag} ${title.trim()}` : title.trim()
    onSave(card.id, colId, targetCol, { ...card, title: fullTitle, desc: desc.trim() })
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Redigera kort</div>

        <label style={labelStyle}>Tagg</label>
        <select value={selTag} onChange={e => setSelTag(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">Ingen</option>
          {Object.keys(TAG_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label style={labelStyle}>Titel</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />

        <label style={labelStyle}>Beskrivning</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font)', marginBottom: 10 }} />

        <label style={labelStyle}>Flytta till kolumn</label>
        <select value={targetCol} onChange={e => setTargetCol(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
          {columns.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSave} style={primaryBtn}>Spara</button>
          <button onClick={onClose} style={cancelBtn}>Avbryt</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 'var(--r)', padding: '8px 10px', color: 'var(--text)',
  fontSize: 13, fontFamily: 'var(--font)', outline: 'none'
}
const primaryBtn = {
  background: 'var(--accent)', color: '#000', border: 'none',
  borderRadius: 'var(--r)', padding: '7px 16px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)'
}
const cancelBtn = {
  background: 'var(--bg4)', color: 'var(--text2)', border: 'none',
  borderRadius: 'var(--r)', padding: '7px 16px', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)'
}
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 4 }
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
}
const modalBox = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 'var(--r2)', padding: 24, width: 400, maxWidth: '90vw'
}

export default function Roadmap() {
  const { isAdmin } = useAuth()
  const emptyTasks = Object.fromEntries(COLUMNS.map(c => [c.id, []]))
  const [tasks, setTasks] = useState(emptyTasks)
  const [addingIn, setAddingIn] = useState(null)
  const [editCard, setEditCard] = useState(null)
  const dragCard = useRef(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await sbProd
        .from('user_settings')
        .select('settings')
        .eq('user_id', PROD_ADMIN_ID)
        .single()
      if (data?.settings?.roadmapTasks) {
        const rt = data.settings.roadmapTasks
        if (typeof rt === 'object' && !Array.isArray(rt)) setTasks(rt)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function persist(newTasks) {
    setTasks(newTasks)
    setSaving(true)
    const { data } = await sbProd
      .from('user_settings')
      .select('settings')
      .eq('user_id', PROD_ADMIN_ID)
      .single()
    const merged = { ...(data?.settings || {}), roadmapTasks: newTasks }
    await sbProd.from('user_settings').upsert({
      user_id: PROD_ADMIN_ID,
      settings: merged,
      updated_at: new Date().toISOString()
    })
    setSaving(false)
  }

  function handleDragStart(e, cardId, fromCol) {
    dragCard.current = { id: cardId, fromCol }
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    setDragOverCol(colId)
  }

  function handleDrop(e, toCol) {
    e.preventDefault()
    setDragOverCol(null)
    if (!dragCard.current) return
    const { id, fromCol } = dragCard.current
    if (fromCol === toCol) return
    const updated = { ...tasks }
    const card = (updated[fromCol] || []).find(c => c.id === id)
    if (!card) return
    updated[fromCol] = (updated[fromCol] || []).filter(c => c.id !== id)
    updated[toCol] = [...(updated[toCol] || []), card]
    persist(updated)
    dragCard.current = null
  }

  function handleAdd(colId, title, desc) {
    const newCard = { id: crypto.randomUUID(), title, desc }
    const updated = { ...tasks, [colId]: [...(tasks[colId] || []), newCard] }
    persist(updated)
    setAddingIn(null)
  }

  function handleDelete(cardId, colId) {
    const updated = { ...tasks, [colId]: (tasks[colId] || []).filter(c => c.id !== cardId) }
    persist(updated)
  }

  function handleEditSave(cardId, fromCol, toCol, updated) {
    const newTasks = { ...tasks }
    newTasks[fromCol] = (newTasks[fromCol] || []).filter(c => c.id !== cardId)
    newTasks[toCol] = [...(newTasks[toCol] || []), updated]
    persist(newTasks)
    setEditCard(null)
  }

  const totalCards = Object.values(tasks).flat().length

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Laddar roadmap…
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Topbar title="Roadmap" subtitle={`${totalCards} kort${saving ? ' · Sparar…' : ''}`} />

      <div style={{ flex: 1, padding: '20px 24px', overflowX: 'auto' }}>
        <div style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          minWidth: COLUMNS.length * 260 + (COLUMNS.length - 1) * 14
        }}>
          {COLUMNS.map(col => {
            const cards = tasks[col.id] || []
            const isDragTarget = dragOverCol === col.id
            return (
              <div
                key={col.id}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{col.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{col.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text4)',
                      background: 'var(--bg4)', borderRadius: 20,
                      padding: '1px 7px', minWidth: 20, textAlign: 'center'
                    }}>{cards.length}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setAddingIn(addingIn === col.id ? null : col.id)}
                      title="Lägg till kort"
                      style={{
                        background: 'none', border: 'none', color: 'var(--text4)',
                        cursor: 'pointer', fontSize: 18, lineHeight: 1,
                        padding: '0 2px', fontFamily: 'var(--font)'
                      }}
                    >+</button>
                  )}
                </div>

                {cards.map(card => (
                  <Card
                    key={card.id}
                    card={card}
                    colId={col.id}
                    onDragStart={handleDragStart}
                    onEdit={(c, cid) => setEditCard({ card: c, colId: cid })}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
                  />
                ))}

                {addingIn === col.id && (
                  <AddCardForm colId={col.id} onAdd={handleAdd} onCancel={() => setAddingIn(null)} />
                )}

                {cards.length === 0 && addingIn !== col.id && (
                  <div style={{
                    border: '1px dashed var(--border)', borderRadius: 'var(--r)',
                    padding: '16px 12px', textAlign: 'center',
                    color: 'var(--text4)', fontSize: 12
                  }}>Tom</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {editCard && (
        <EditCardModal
          card={editCard.card}
          colId={editCard.colId}
          columns={COLUMNS}
          onSave={handleEditSave}
          onClose={() => setEditCard(null)}
        />
      )}
    </div>
  )
}
