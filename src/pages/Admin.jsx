import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Topbar from '../components/Topbar'

export default function Admin() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    loadUsers()
  }, [isAdmin])

  async function loadUsers() {
    const { data } = await sb.from('admin_users').select('*').order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    const userIds = data.map(u => u.user_id)
    const [settingsRes, tradesRes, flagsRes] = await Promise.all([
      sb.from('user_settings').select('user_id, settings').in('user_id', userIds),
      sb.from('trades').select('user_id').in('user_id', userIds),
      sb.from('admin_flags').select('user_id, is_admin').in('user_id', userIds),
    ])

    const settingsMap = {}
    settingsRes.data?.forEach(s => settingsMap[s.user_id] = s.settings)
    const tradeCount = {}
    tradesRes.data?.forEach(t => tradeCount[t.user_id] = (tradeCount[t.user_id] || 0) + 1)
    const flagMap = {}
    flagsRes.data?.forEach(f => flagMap[f.user_id] = f.is_admin)

    setUsers(data.map(u => ({
      ...u,
      settings: settingsMap[u.user_id] || {},
      trade_count: tradeCount[u.user_id] || 0,
      is_admin: flagMap[u.user_id] || false,
    })))
    setLoading(false)
  }

  async function toggleAI(userId, current) {
    await sb.rpc('admin_set_user_setting', {
      target_user_id: userId,
      setting_key: 'ai_enabled',
      setting_value: !current
    })
    loadUsers()
  }

  if (!isAdmin) return (
    <div style={{ flex: 1 }}>
      <Topbar title="Administration" />
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>Access denied</div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1 }}>
      <Topbar title="Administration" />
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Users ({users.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            ) : (
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Trades</th>
                    <th>Confirmed</th>
                    <th>Admin</th>
                    <th>AI</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id}>
                      <td style={{ color: 'var(--text)' }}>
                        {u.email}
                        {u.user_id === user?.id && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 3 }}>you</span>
                        )}
                      </td>
                      <td className="mono">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{u.trade_count}</td>
                      <td>
                        <span style={{ fontSize: 11, color: u.confirmed_at ? 'var(--green)' : 'var(--text4)' }}>
                          {u.confirmed_at ? '✓ Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: u.is_admin ? 'var(--accent)' : 'var(--text4)' }}>
                          {u.is_admin ? '✓ Admin' : '—'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.settings?.ai_enabled ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => toggleAI(u.user_id, u.settings?.ai_enabled)}
                          disabled={u.user_id === user?.id}
                        >
                          {u.settings?.ai_enabled ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
