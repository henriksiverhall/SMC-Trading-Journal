import { useEffect, useState, useMemo } from 'react'
import { sb } from '../lib/supabase'
import Topbar from '../components/Topbar'

// ── Sektionskonfiguration ──────────────────────────────────────────────────
// Varje sektion pekar på en riktig databastabell (inga hårdkodade
// demo-kort). "docs" = fritextdokument (developer_documents, filtrerat på
// doc_type), "board" = kanban grupperat på status, "list" = rak lista med
// inline-formulär. Allt är CRUD mot Supabase, filtrerat på valt projekt.

const DOC_SECTIONS = {
  overview:     { docType: 'overview',     label: 'Overview' },
  blueprint:    { docType: 'blueprint',    label: 'Vision Blueprint' },
  architecture: { docType: 'architecture', label: 'Architecture' },
  schemas:      { docType: 'schema',       label: 'Schemas' },
}

const LIST_SECTIONS = {
  kanban: {
    label: 'Kanban', table: 'developer_tasks', board: true,
    statusField: 'status', statusOptions: ['todo', 'in_progress', 'review', 'blocked', 'done'],
    statusLabels: { todo: 'Todo', in_progress: 'Pågår', review: 'Review', blocked: 'Blockerad', done: 'Klar' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'description', label: 'Beskrivning', type: 'textarea' },
      { key: 'priority', label: 'Prioritet', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { key: 'version', label: 'Version', type: 'text' },
    ],
  },
  roadmap: {
    label: 'Roadmap', table: 'developer_milestones', board: false,
    statusField: 'status', statusOptions: ['planned', 'in_progress', 'done', 'cancelled'],
    statusLabels: { planned: 'Planerad', in_progress: 'Pågår', done: 'Klar', cancelled: 'Avbruten' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'description', label: 'Beskrivning', type: 'textarea' },
      { key: 'target_version', label: 'Målversion', type: 'text' },
      { key: 'due_date', label: 'Deadline', type: 'date' },
    ],
  },
  decisions: {
    label: 'Decision Log', table: 'developer_decisions', board: false,
    statusField: 'status', statusOptions: ['proposed', 'accepted', 'superseded', 'rejected'],
    statusLabels: { proposed: 'Föreslagen', accepted: 'Accepterad', superseded: 'Ersatt', rejected: 'Avvisad' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'context', label: 'Kontext', type: 'textarea' },
      { key: 'decision', label: 'Beslut', type: 'textarea' },
      { key: 'consequences', label: 'Konsekvenser', type: 'textarea' },
      { key: 'version', label: 'Version', type: 'text' },
    ],
  },
  releases: {
    label: 'Releases', table: 'developer_releases', board: false,
    statusField: 'status', statusOptions: ['planned', 'released', 'rolled_back'],
    statusLabels: { planned: 'Planerad', released: 'Släppt', rolled_back: 'Återrullad' },
    fields: [
      { key: 'version', label: 'Version', type: 'text', required: true },
      { key: 'title', label: 'Titel', type: 'text' },
      { key: 'release_notes', label: 'Release notes', type: 'textarea' },
      { key: 'released_at', label: 'Släppt (datum)', type: 'date' },
    ],
  },
  debt: {
    label: 'Technical Debt', table: 'developer_technical_debt', board: false,
    statusField: 'status', statusOptions: ['open', 'in_progress', 'resolved', 'wont_fix'],
    statusLabels: { open: 'Öppen', in_progress: 'Pågår', resolved: 'Löst', wont_fix: 'Löses ej' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'description', label: 'Beskrivning', type: 'textarea' },
      { key: 'severity', label: 'Allvarlighetsgrad', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { key: 'version', label: 'Version', type: 'text' },
    ],
  },
  ideas: {
    label: 'Ideas', table: 'developer_ideas', board: false,
    statusField: 'status', statusOptions: ['new', 'considering', 'accepted', 'rejected', 'implemented'],
    statusLabels: { new: 'Ny', considering: 'Utvärderas', accepted: 'Accepterad', rejected: 'Avvisad', implemented: 'Implementerad' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'description', label: 'Beskrivning', type: 'textarea' },
    ],
  },
}

const NAV_ORDER = ['overview', 'blueprint', 'architecture', 'kanban', 'roadmap', 'schemas', 'decisions', 'releases', 'debt', 'ideas']
const NAV_LABELS = {
  overview: 'Overview', blueprint: 'Vision Blueprint', architecture: 'Architecture', kanban: 'Kanban',
  roadmap: 'Roadmap', schemas: 'Schemas', decisions: 'Decision Log', releases: 'Releases',
  debt: 'Technical Debt', ideas: 'Ideas',
}

const PRIORITY_COLOR = { low: 'var(--text4)', medium: 'var(--text2)', high: 'var(--amber, #f59e0b)', critical: 'var(--red)' }
const SEVERITY_COLOR = PRIORITY_COLOR

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sv-SE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Developer() {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState(null)
  const [section, setSection] = useState('overview')
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    sb.from('developer_projects').select('*').order('sort_order').then(({ data }) => {
      setProjects(data || [])
      if (data && data.length > 0) setProjectId(p => p || data[0].id)
      setLoadingProjects(false)
    })
  }, [])

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Developer" subtitle="Projekthantering, roadmap och dokumentation för Vision / TradeLog / FM Coach" />
      <div className="page-content" style={{ maxWidth: 1300 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Projekt</label>
          {loadingProjects ? (
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Laddar…</span>
          ) : (
            <select className="form-control" style={{ width: 'auto', minWidth: 180 }} value={projectId || ''} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {NAV_ORDER.map(id => (
            <button key={id} onClick={() => setSection(id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13,
                fontWeight: section === id ? 700 : 500, color: section === id ? 'var(--text)' : 'var(--text3)',
                padding: '10px 14px', borderBottom: `2px solid ${section === id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1, whiteSpace: 'nowrap',
              }}>
              {NAV_LABELS[id]}
            </button>
          ))}
        </div>

        {!projectId ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Inga projekt hittades. Skapa ett i tabellen <code>developer_projects</code> för att komma igång.
          </div>
        ) : DOC_SECTIONS[section] ? (
          <DocSection key={section + projectId} projectId={projectId} config={DOC_SECTIONS[section]} />
        ) : (
          <ListSection key={section + projectId} projectId={projectId} config={LIST_SECTIONS[section]} />
        )}
      </div>
    </div>
  )
}

// ── Dokument-sektioner: Overview / Vision Blueprint / Architecture / Schemas ──
function DocSection({ projectId, config }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState('draft')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { load() }, [projectId, config.docType])

  async function load() {
    setLoading(true)
    const { data } = await sb.from('developer_documents').select('*')
      .eq('project_id', projectId).eq('doc_type', config.docType)
      .order('sort_order').order('updated_at', { ascending: false })
    setDocs(data || [])
    if (data && data.length > 0) selectDoc(data[0])
    else { setSelectedId(null); setTitle(''); setContent(''); setVersion(''); setStatus('draft') }
    setLoading(false)
  }

  function selectDoc(d) {
    setSelectedId(d.id); setTitle(d.title || ''); setContent(d.content || '')
    setVersion(d.version || ''); setStatus(d.status || 'draft'); setDirty(false)
  }

  function newDoc() {
    setSelectedId(null); setTitle(''); setContent(''); setVersion(''); setStatus('draft'); setDirty(false)
  }

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const payload = { project_id: projectId, doc_type: config.docType, title: title.trim(), content, version: version || null, status }
    if (selectedId) {
      await sb.from('developer_documents').update(payload).eq('id', selectedId)
    } else {
      const { data } = await sb.from('developer_documents').insert(payload).select().single()
      if (data) setSelectedId(data.id)
    }
    setDirty(false); setSaving(false); load()
  }

  async function remove(id) {
    if (!window.confirm('Ta bort detta dokument?')) return
    await sb.from('developer_documents').delete().eq('id', id)
    newDoc(); load()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
      <div>
        <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }} onClick={newDoc}>+ Nytt dokument</button>
        {loading ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>Laddar…</div> : docs.length === 0 ? (
          <div style={{ color: 'var(--text4)', fontSize: 12 }}>Inga dokument ännu.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {docs.map(d => (
              <button key={d.id} onClick={() => selectDoc(d)}
                style={{
                  textAlign: 'left', background: selectedId === d.id ? 'var(--accent-dim)' : 'var(--bg3)',
                  border: `1px solid ${selectedId === d.id ? 'rgba(0,212,170,0.3)' : 'var(--border2)'}`,
                  borderRadius: 'var(--r)', padding: '8px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12.5,
                }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>{d.status}{d.version ? ` · v${d.version}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Titel</label>
              <input className="form-control" value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }} placeholder={`${config.label} – titel`} />
            </div>
            <div className="form-group">
              <label className="form-label">Version</label>
              <input className="form-control" value={version} onChange={e => { setVersion(e.target.value); setDirty(true) }} placeholder="valfritt" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={status} onChange={e => { setStatus(e.target.value); setDirty(true) }}>
                <option value="draft">Utkast</option>
                <option value="current">Aktuell</option>
                <option value="archived">Arkiverad</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Innehåll (markdown)</label>
            <textarea className="form-control" rows={20} value={content} onChange={e => { setContent(e.target.value); setDirty(true) }}
              style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6 }}
              placeholder={`Skriv ${config.label.toLowerCase()} här…`} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()}>{saving ? 'Sparar…' : '💾 Spara'}</button>
            {selectedId && <button onClick={() => remove(selectedId)} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 'var(--r)', padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>🗑 Ta bort</button>}
            {dirty && <span style={{ fontSize: 11, color: 'var(--amber, #f59e0b)', alignSelf: 'center' }}>Osparade ändringar</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lista/Kanban-sektioner: Kanban, Roadmap, Decision Log, Releases, Debt, Ideas ──
function ListSection({ projectId, config }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [projectId, config.table])

  async function load() {
    setLoading(true)
    const { data } = await sb.from(config.table).select('*').eq('project_id', projectId).order('sort_order').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    const base = { [config.statusField]: config.statusOptions[0] }
    config.fields.forEach(f => { base[f.key] = f.type === 'select' ? (f.options?.[1] || f.options?.[0] || '') : '' })
    setForm(base)
    setShowNew(true)
  }

  function startEdit(row) {
    setEditingId(row.id)
    const next = { [config.statusField]: row[config.statusField] }
    config.fields.forEach(f => { next[f.key] = row[f.key] ?? '' })
    setForm(next)
    setShowNew(true)
  }

  async function save() {
    const requiredMissing = config.fields.some(f => f.required && !String(form[f.key] || '').trim())
    if (requiredMissing) return
    setSaving(true)
    const payload = { project_id: projectId, [config.statusField]: form[config.statusField] }
    config.fields.forEach(f => { payload[f.key] = form[f.key] === '' ? null : form[f.key] })
    if (editingId) {
      await sb.from(config.table).update(payload).eq('id', editingId)
    } else {
      await sb.from(config.table).insert(payload)
    }
    setSaving(false); setShowNew(false); setEditingId(null); load()
  }

  async function remove(id) {
    if (!window.confirm('Ta bort denna post?')) return
    await sb.from(config.table).delete().eq('id', id)
    load()
  }

  async function quickSetStatus(id, value) {
    await sb.from(config.table).update({ [config.statusField]: value }).eq('id', id)
    load()
  }

  const renderForm = () => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header"><div className="card-title">{editingId ? 'Redigera' : 'Ny post'}</div></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {config.fields.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
            {f.type === 'textarea' ? (
              <textarea className="form-control" rows={3} value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} style={{ resize: 'vertical' }} />
            ) : f.type === 'select' ? (
              <select className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'date' ? (
              <input type="date" className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            ) : (
              <input className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-control" value={form[config.statusField] || ''} onChange={e => setForm(v => ({ ...v, [config.statusField]: e.target.value }))}>
            {config.statusOptions.map(o => <option key={o} value={o}>{config.statusLabels[o] || o}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : '💾 Spara'}</button>
          <button className="btn btn-ghost" onClick={() => { setShowNew(false); setEditingId(null) }}>Avbryt</button>
        </div>
      </div>
    </div>
  )

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Laddar…</div>

  if (config.board) {
    const columns = config.statusOptions.map(s => ({ status: s, items: rows.filter(r => r[config.statusField] === s) }))
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={startNew}>+ Nytt kort</button>
        </div>
        {showNew && renderForm()}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 12, alignItems: 'start' }}>
          {columns.map(col => (
            <div key={col.status} style={{ background: 'var(--bg3)', borderRadius: 'var(--r2)', padding: 10, minHeight: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {config.statusLabels[col.status] || col.status} <span style={{ color: 'var(--text4)' }}>({col.items.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.items.map(item => (
                  <div key={item.id} className="card" style={{ padding: 10, cursor: 'pointer' }} onClick={() => startEdit(item)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
                    {item.priority && <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[item.priority] }}>{item.priority}</span>}
                    {item.version && <span style={{ fontSize: 10, color: 'var(--text4)', marginLeft: 8 }}>v{item.version}</span>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {config.statusOptions.filter(s => s !== item[config.statusField]).map(s => (
                        <button key={s} onClick={e => { e.stopPropagation(); quickSetStatus(item.id, s) }}
                          style={{ fontSize: 10, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: 'var(--text3)' }}>
                          → {config.statusLabels[s] || s}
                        </button>
                      ))}
                      <button onClick={e => { e.stopPropagation(); remove(item.id) }} style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', marginLeft: 'auto' }}>Ta bort</button>
                    </div>
                  </div>
                ))}
                {col.items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text4)' }}>Tomt</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={startNew}>+ Ny post</button>
      </div>
      {showNew && renderForm()}
      {rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Inga poster ännu.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(row => (
            <div key={row.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(row)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{row.title || row.version}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--bg4)', color: 'var(--text3)' }}>
                      {config.statusLabels[row[config.statusField]] || row[config.statusField]}
                    </span>
                    {row.severity && <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_COLOR[row.severity] }}>{row.severity}</span>}
                    {row.version && row.title && <span style={{ fontSize: 11, color: 'var(--text4)' }}>v{row.version}</span>}
                    {row.due_date && <span style={{ fontSize: 11, color: 'var(--text4)' }}>📅 {fmtDate(row.due_date)}</span>}
                    {row.released_at && <span style={{ fontSize: 11, color: 'var(--text4)' }}>📅 {fmtDate(row.released_at)}</span>}
                  </div>
                  {(row.description || row.context || row.decision || row.release_notes) && (
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {row.description || row.decision || row.context || row.release_notes}
                    </div>
                  )}
                </div>
                <select value={row[config.statusField]} onChange={e => quickSetStatus(row.id, e.target.value)} className="form-control" style={{ width: 'auto', fontSize: 11, flexShrink: 0 }}>
                  {config.statusOptions.map(s => <option key={s} value={s}>{config.statusLabels[s] || s}</option>)}
                </select>
                <button onClick={() => remove(row.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
