import { useAuth } from '../hooks/useAuth'

export default function Topbar({ title, actions }) {
  const { user, userSettings } = useAuth()
  const initial = (userSettings?.displayName || user?.email || 'U')[0].toUpperCase()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      <div className="topbar-right">
        <div className="avatar" title={user?.email}>{initial}</div>
      </div>
    </header>
  )
}
