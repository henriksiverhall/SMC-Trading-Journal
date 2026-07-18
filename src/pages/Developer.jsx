import { useEffect, useMemo, useState } from 'react'
import { sb } from '../lib/supabase'
import Topbar from '../components/Topbar'

const DOC_SECTIONS = {
  overview: { docType: 'overview', label: 'Overview notes' },
  blueprint: { docType: 'blueprint', label: 'Vision Blueprint' },
  architecture: { docType: 'architecture', label: 'Architecture' },
  schemas: { docType: 'schema', label: 'Schemas' },
  research: { docType: 'research', label: 'Research' },
}

const LIST_SECTIONS = {
  components: {
    label: 'Components', table: 'developer_components', board: false,
    statusField: 'status', statusOptions: ['planned', 'active', 'deprecated', 'retired'],
    statusLabels: { planned: 'Planerad', active: 'Aktiv', deprecated: 'Utfasas', retired: 'Avvecklad' },
    fields: [
      { key: 'name', label: 'Namn', type: 'text', required: true },
      { key: 'kind', label: 'Typ', type: 'select', options: ['service', 'module', 'ui', 'database', 'integration', 'library', 'worker', 'other'] },
      { key: 'description', label: 'Ansvar / beskrivning', type: 'textarea' },
      { key: 'version', label: 'Version', type: 'text' },
    ],
  },
  kanban: {
    label: 'Kanban', table: 'developer_tasks', board: true,
    statusField: 'status', statusOptions: ['todo', 'in_progress', 'review', 'blocked', 'done'],
    statusLabels: { todo: 'Todo', in_progress: 'Pågår', review: 'Review', blocked: 'Blockerad', done: 'Klar' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'description', label: 'Beskrivning', type: 'textarea' },
      { key: 'component_id', label: 'Komponent', type: 'relation', source: 'components' },
      { key: 'milestone_id', label: 'Milestone', type: 'relation', source: 'milestones' },
      { key: 'release_id', label: 'Release', type: 'relation', source: 'releases' },
      { key: 'decision_id', label: 'Beslut', type: 'relation', source: 'decisions' },
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
      { key: 'component_id', label: 'Komponent', type: 'relation', source: 'components' },
      { key: 'context', label: 'Problem / kontext', type: 'textarea' },
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
      { key: 'released_at', label: 'Släppt datum', type: 'date' },
    ],
  },
  debt: {
    label: 'Technical Debt', table: 'developer_technical_debt', board: false,
    statusField: 'status', statusOptions: ['open', 'in_progress', 'resolved', 'wont_fix'],
    statusLabels: { open: 'Öppen', in_progress: 'Pågår', resolved: 'Löst', wont_fix: 'Löses ej' },
    fields: [
      { key: 'title', label: 'Titel', type: 'text', required: true },
      { key: 'component_id', label: 'Komponent', type: 'relation', source: 'components' },
      { key: 'description', label: 'Beskrivning / risk / föreslagen lösning', type: 'textarea' },
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

const NAV_ORDER = ['overview', 'blueprint', 'architecture', 'components', 'kanban', 'roadmap', 'schemas', 'decisions', 'releases', 'debt', 'ideas', 'research']
const NAV_LABELS = {
  overview: 'Overview', blueprint: 'Vision Blueprint', architecture: 'Architecture', components: 'Components',
  kanban: 'Kanban', roadmap: 'Roadmap', schemas: 'Schemas', decisions: 'Decision Log', releases: 'Releases',
  debt: 'Technical Debt', ideas: 'Ideas', research: 'Research',
}
const PRIORITY_COLOR = { low: 'var(--text4)', medium: 'var(--text2)', high: 'var(--amber, #f59e0b)', critical: 'var(--red)' }
const LOOKUP_TABLES = {
  components: { table: 'developer_components', label: r => r.name },
  milestones: { table: 'developer_milestones', label: r => r.title },
  releases: { table: 'developer_releases', label: r => `${r.version}${r.title ? ` · ${r.title}` : ''}` },
  decisions: { table: 'developer_decisions', label: r => r.title },
}

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
      if (data?.length) setProjectId(p => p || data[0].id)
      setLoadingProjects(false)
    })
  }, [])

  const currentProject = projects.find(p => p.id === projectId)

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Developer" subtitle="Projekthantering, arkitektur och teknisk dokumentation" />
      <div className="page-content" style={{ maxWidth: 1400 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Projekt</label>
          {loadingProjects ? <span style={{ fontSize: 13, color: 'var(--text3)' }}>Laddar…</span> : (
            <select className="form-control" style={{ width: 'auto', minWidth: 180 }} value={projectId || ''} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {currentProject?.status && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{currentProject.status}</span>}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {NAV_ORDER.map(id => (
            <button key={id} onClick={() => setSection(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13,
              fontWeight: section === id ? 700 : 500, color: section === id ? 'var(--text)' : 'var(--text3)',
              padding: '10px 14px', borderBottom: `2px solid ${section === id ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap',
            }}>{NAV_LABELS[id]}</button>
          ))}
        </div>

        {!projectId ? <Empty text="Inga projekt hittades." /> : section === 'overview' ? (
          <Overview projectId={projectId} project={currentProject} />
        ) : DOC_SECTIONS[section] ? (
          <DocSection key={section + projectId} projectId={projectId} config={DOC_SECTIONS[section]} />
        ) : (
          <ListSection key={section + projectId} projectId={projectId} config={LIST_SECTIONS[section]} />
        )}
      </div>
    </div>
  )
}

function Overview({ projectId, project }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let active = true
    async function load() {
      const [tasks, debt, components, releases, decisions, research] = await Promise.all([
        sb.from('developer_tasks').select('*').eq('project_id', projectId),
        sb.from('developer_technical_debt').select('*').eq('project_id', projectId),
        sb.from('developer_components').select('*').eq('project_id', projectId),
        sb.from('developer_releases').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        sb.from('developer_decisions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        sb.from('developer_documents').select('*').eq('project_id', projectId).eq('doc_type', 'research').order('updated_at', { ascending: false }),
      ])
      if (!active) return
      setData({ tasks: tasks.data || [], debt: debt.data || [], components: components.data || [], releases: releases.data || [], decisions: decisions.data || [], research: research.data || [] })
    }
    load()
    return () => { active = false }
  }, [projectId])

  if (!data) return <Empty text="Laddar projektstatus…" />
  const openTasks = data.tasks.filter(t => t.status !== 'done')
  const blocked = data.tasks.filter(t => t.status === 'blocked')
  const openDebt = data.debt.filter(d => !['resolved', 'wont_fix'].includes(d.status))
  const nextRelease = data.releases.find(r => r.status === 'planned')
  const lastDecision = data.decisions[0]
  const lastResearch = data.research[0]
  const cards = [
    ['Komponenter', data.components.length], ['Öppna tasks', openTasks.length], ['Blockerade', blocked.length], ['Öppen tech debt', openDebt.length],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card"><div className="card-body">
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{project?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>{project?.description || 'Ingen projektbeskrivning ännu.'}</div>
      </div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12 }}>
        {cards.map(([label, value]) => <div className="card" key={label}><div className="card-body">
          <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 5 }}>{value}</div>
        </div></div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 12 }}>
        <SummaryCard title="Nästa release" primary={nextRelease ? `v${nextRelease.version}` : 'Ingen planerad'} secondary={nextRelease?.title} />
        <SummaryCard title="Senaste beslut" primary={lastDecision?.title || 'Inga beslut'} secondary={lastDecision ? fmtDate(lastDecision.created_at) : null} />
        <SummaryCard title="Senaste research" primary={lastResearch?.title || 'Ingen research'} secondary={lastResearch ? fmtDate(lastResearch.updated_at) : null} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>Overview notes</div>
        <DocSection projectId={projectId} config={DOC_SECTIONS.overview} />
      </div>
    </div>
  )
}

function SummaryCard({ title, primary, secondary }) {
  return <div className="card"><div className="card-body">
    <div style={{ fontSize: 11, color: 'var(--text4)', textTransform: 'uppercase', fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, marginTop: 7 }}>{primary}</div>
    {secondary && <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>{secondary}</div>}
  </div></div>
}

function DocSection({ projectId, config }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', version: '', status: 'draft' })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { load() }, [projectId, config.docType])
  async function load() {
    setLoading(true)
    const { data } = await sb.from('developer_documents').select('*').eq('project_id', projectId).eq('doc_type', config.docType).order('sort_order').order('updated_at', { ascending: false })
    const rows = data || []
    setDocs(rows)
    if (rows.length) selectDoc(rows[0]); else newDoc()
    setLoading(false)
  }
  function selectDoc(d) { setSelectedId(d.id); setForm({ title: d.title || '', content: d.content || '', version: d.version || '', status: d.status || 'draft' }); setDirty(false) }
  function newDoc() { setSelectedId(null); setForm({ title: '', content: '', version: '', status: 'draft' }); setDirty(false) }
  function set(key, value) { setForm(v => ({ ...v, [key]: value })); setDirty(true) }
  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = { project_id: projectId, doc_type: config.docType, title: form.title.trim(), content: form.content, version: form.version || null, status: form.status }
    if (selectedId) await sb.from('developer_documents').update(payload).eq('id', selectedId)
    else await sb.from('developer_documents').insert(payload)
    setSaving(false); setDirty(false); load()
  }
  async function remove() {
    if (!selectedId || !window.confirm('Ta bort detta dokument?')) return
    await sb.from('developer_documents').delete().eq('id', selectedId)
    load()
  }

  return <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
    <div>
      <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }} onClick={newDoc}>+ Nytt dokument</button>
      {loading ? <Empty text="Laddar…" compact /> : docs.length === 0 ? <Empty text="Inga dokument ännu." compact /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{docs.map(d => (
          <button key={d.id} onClick={() => selectDoc(d)} style={{ textAlign: 'left', background: selectedId === d.id ? 'var(--accent-dim)' : 'var(--bg3)', border: `1px solid ${selectedId === d.id ? 'rgba(0,212,170,0.3)' : 'var(--border2)'}`, borderRadius: 'var(--r)', padding: '8px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.title}</div><div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>{d.status}{d.version ? ` · v${d.version}` : ''}</div>
          </button>
        ))}</div>
      )}
    </div>
    <div className="card"><div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Field label="Titel"><input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label="Version"><input className="form-control" value={form.version} onChange={e => set('version', e.target.value)} /></Field>
        <Field label="Status"><select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}><option value="draft">Utkast</option><option value="current">Aktuell</option><option value="archived">Arkiverad</option></select></Field>
      </div>
      <Field label="Innehåll (markdown)"><textarea className="form-control" rows={18} value={form.content} onChange={e => set('content', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6 }} /></Field>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Sparar…' : '💾 Spara'}</button>{selectedId && <button className="btn btn-ghost" onClick={remove}>🗑 Ta bort</button>}{dirty && <span style={{ fontSize: 11, color: 'var(--amber, #f59e0b)', alignSelf: 'center' }}>Osparade ändringar</span>}</div>
    </div></div>
  </div>
}

function ListSection({ projectId, config }) {
  const [rows, setRows] = useState([])
  const [lookups, setLookups] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [projectId, config.table])
  async function load() {
    setLoading(true)
    const relationSources = [...new Set(config.fields.filter(f => f.type === 'relation').map(f => f.source))]
    const [rowsResult, ...lookupResults] = await Promise.all([
      sb.from(config.table).select('*').eq('project_id', projectId).order('sort_order').order('created_at', { ascending: false }),
      ...relationSources.map(source => sb.from(LOOKUP_TABLES[source].table).select('*').eq('project_id', projectId).order('sort_order').order('created_at')),
    ])
    const next = {}
    relationSources.forEach((source, i) => { next[source] = lookupResults[i].data || [] })
    setLookups(next); setRows(rowsResult.data || []); setLoading(false)
  }
  function startNew() {
    const base = { [config.statusField]: config.statusOptions[0] }
    config.fields.forEach(f => { base[f.key] = f.type === 'select' ? (f.options?.[1] || f.options?.[0] || '') : '' })
    setEditingId(null); setForm(base); setShowForm(true)
  }
  function startEdit(row) {
    const next = { [config.statusField]: row[config.statusField] }
    config.fields.forEach(f => { next[f.key] = row[f.key] ?? '' })
    setEditingId(row.id); setForm(next); setShowForm(true)
  }
  async function save() {
    if (config.fields.some(f => f.required && !String(form[f.key] || '').trim())) return
    setSaving(true)
    const payload = { project_id: projectId, [config.statusField]: form[config.statusField] }
    config.fields.forEach(f => { payload[f.key] = form[f.key] === '' ? null : form[f.key] })
    if (editingId) await sb.from(config.table).update(payload).eq('id', editingId)
    else await sb.from(config.table).insert(payload)
    setSaving(false); setShowForm(false); setEditingId(null); load()
  }
  async function remove(id) { if (window.confirm('Ta bort denna post?')) { await sb.from(config.table).delete().eq('id', id); load() } }
  async function quickSetStatus(id, value) { await sb.from(config.table).update({ [config.statusField]: value }).eq('id', id); load() }
  function relationLabel(field, value) {
    if (!value) return null
    const item = (lookups[field.source] || []).find(r => r.id === value)
    return item ? LOOKUP_TABLES[field.source].label(item) : null
  }
  const relationFields = config.fields.filter(f => f.type === 'relation')
  const columns = useMemo(() => config.board ? config.statusOptions.map(s => ({ status: s, items: rows.filter(r => r[config.statusField] === s) })) : [], [rows, config])

  if (loading) return <Empty text="Laddar…" />
  const editor = showForm && <div className="card" style={{ marginBottom: 16 }}><div className="card-header"><div className="card-title">{editingId ? 'Redigera' : 'Ny post'}</div></div><div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {config.fields.map(f => <Field key={f.key} label={f.label} required={f.required}>
      {f.type === 'textarea' ? <textarea className="form-control" rows={3} value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
        : f.type === 'select' ? <select className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === 'relation' ? <select className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}><option value="">— Ingen —</option>{(lookups[f.source] || []).map(r => <option key={r.id} value={r.id}>{LOOKUP_TABLES[f.source].label(r)}</option>)}</select>
        : <input type={f.type === 'date' ? 'date' : 'text'} className="form-control" value={form[f.key] || ''} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />}
    </Field>)}
    <Field label="Status"><select className="form-control" value={form[config.statusField] || ''} onChange={e => setForm(v => ({ ...v, [config.statusField]: e.target.value }))}>{config.statusOptions.map(o => <option key={o} value={o}>{config.statusLabels[o] || o}</option>)}</select></Field>
    <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : '💾 Spara'}</button><button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Avbryt</button></div>
  </div></div>

  if (config.board) return <div><div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn btn-primary btn-sm" onClick={startNew}>+ Nytt kort</button></div>{editor}
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(210px, 1fr))`, gap: 12, alignItems: 'start', overflowX: 'auto' }}>{columns.map(col => <div key={col.status} style={{ background: 'var(--bg3)', borderRadius: 'var(--r2)', padding: 10, minHeight: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>{config.statusLabels[col.status]} ({col.items.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{col.items.map(item => <div key={item.id} className="card" style={{ padding: 10, cursor: 'pointer' }} onClick={() => startEdit(item)}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{item.priority && <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[item.priority] }}>{item.priority}</span>}{relationFields.map(f => relationLabel(f, item[f.key]) && <span key={f.key} style={{ fontSize: 10, color: 'var(--text4)' }}>{relationLabel(f, item[f.key])}</span>)}</div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>{config.statusOptions.filter(s => s !== item[config.statusField]).map(s => <button key={s} onClick={e => { e.stopPropagation(); quickSetStatus(item.id, s) }} style={{ fontSize: 9, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 5px', cursor: 'pointer', color: 'var(--text3)' }}>→ {config.statusLabels[s]}</button>)}<button onClick={e => { e.stopPropagation(); remove(item.id) }} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 10 }}>Ta bort</button></div>
      </div>)}{col.items.length === 0 && <Empty text="Tomt" compact />}</div>
    </div>)}</div>
  </div>

  return <div><div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn btn-primary btn-sm" onClick={startNew}>+ Ny post</button></div>{editor}
    {rows.length === 0 ? <Empty text="Inga poster ännu." /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rows.map(row => <div key={row.id} className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}><div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(row)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{row.title || row.name || row.version}</span><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bg4)', color: 'var(--text3)' }}>{config.statusLabels[row[config.statusField]] || row[config.statusField]}</span>{relationFields.map(f => relationLabel(f, row[f.key]) && <span key={f.key} style={{ fontSize: 10, color: 'var(--text4)' }}>{relationLabel(f, row[f.key])}</span>)}</div>
        {(row.description || row.decision || row.context || row.release_notes) && <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginTop: 5, whiteSpace: 'pre-wrap' }}>{row.description || row.decision || row.context || row.release_notes}</div>}
      </div><select value={row[config.statusField]} onChange={e => quickSetStatus(row.id, e.target.value)} className="form-control" style={{ width: 'auto', fontSize: 11 }}>{config.statusOptions.map(s => <option key={s} value={s}>{config.statusLabels[s] || s}</option>)}</select><button onClick={() => remove(row.id)} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>🗑</button></div>
    </div>)}</div>}
  </div>
}

function Field({ label, required, children }) { return <div className="form-group"><label className="form-label">{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>{children}</div> }
function Empty({ text, compact = false }) { return <div style={{ padding: compact ? 8 : 32, textAlign: 'center', color: 'var(--text4)', fontSize: 12 }}>{text}</div> }
