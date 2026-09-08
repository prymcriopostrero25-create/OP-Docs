import { canAccessPage } from '../lib/permissions'

const navItems = [
  ['Overview', '▦'], ['Documents', '▤'], ['Archive', '▣'], ['Activity log', '⌁'],
  ['User management', '♙'], ['User logs', '◷'], ['Settings', '⚙'],
]

export default function Sidebar({ active, isOpen, onNavigate, onLogout, onCreateDocument, onClose, user }) {
  const name = user.name || 'User'
  const initials = name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside id="main-sidebar" className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">?</button>
      <div className="brand">
        <img src="/jhcsclogo.png" alt="JHCSC seal" />
        <div><strong>OP-DMS</strong><small>Document Management</small></div>
      </div>
      <button className="new-document" onClick={onCreateDocument}><span>＋</span><span className="new-document-label">New document</span></button>
      <nav className="main-nav" aria-label="Main navigation">
        <p>Workspace</p>
        {navItems.map(([label, icon], index) => canAccessPage(user, label) && <div key={label}>
          {index === 4 && <p>Administration</p>}
          <button className={active === label ? 'active' : ''} onClick={() => onNavigate(label)}>
            <i>{icon}</i><span>{label}</span>{label === 'Documents'}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-help"><span>?</span><div><strong>Need assistance?</strong><small>Contact the IT Service Desk</small></div></div>
      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div><strong>{name}</strong><small>{user.email}</small></div>
        <button onClick={onLogout} title="Sign out" aria-label="Sign out">↪</button>
      </div>
    </aside>
  )
}
