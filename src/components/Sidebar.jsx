import { useRef } from 'react'
import { canAccessPage } from '../lib/permissions'

const navItems = [
  ['Overview', '▦'], ['Documents', '▤'], ['Email', '✉'], ['Activity log', '⌁'],
  ['Verification', '✓'], ['User management', '♙'], ['User logs', '◷'], ['Settings', '⚙'],
]

export default function Sidebar({ active, isOpen, onNavigate, onLogout, onClose, user }) {
  const logoutDialog = useRef(null)
  const name = user.name || 'User'
  const initials = name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
    <aside id="main-sidebar" className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">?</button>
      <div className="brand">
        <img src="/jhcsclogo.png" alt="JHCSC seal" />
        <div><strong>OP-DMS</strong><small>Document Management</small></div>
      </div>
      <nav className="main-nav" aria-label="Main navigation">
        <p>Workspace</p>
        {navItems.map(([label, icon]) => canAccessPage(user, label) && <div key={label}>
          {label === 'User management' && <p>Administration</p>}
          <button className={active === label ? 'active' : ''} onClick={() => onNavigate(label)}>
            <i>{icon}</i><span>{label}</span>{label === 'Documents'}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-help"><span>?</span><div><strong>Need assistance?</strong><small>Contact the IT Service Desk</small></div></div>
      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div><strong>{name}</strong><small>{user.email}</small></div>
        <button className="sidebar-logout" type="button" onClick={() => logoutDialog.current.showModal()} title="Log out" aria-label="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H5v14h4M9 12h12m-4-4 4 4-4 4" /></svg>
          <span>Log out</span>
        </button>
      </div>
    </aside>
    <dialog ref={logoutDialog} className="logout-confirmation" aria-labelledby="logout-confirmation-title" aria-describedby="logout-confirmation-description">
      <h2 id="logout-confirmation-title">Log out of OP-DMS?</h2>
      <p id="logout-confirmation-description">Are you sure you want to log out? You will need to sign in again to access your workspace.</p>
      <div className="logout-confirmation-actions">
        <button type="button" autoFocus onClick={() => logoutDialog.current.close()}>Cancel</button>
        <button type="button" className="logout-confirm" onClick={() => { logoutDialog.current.close(); onLogout() }}>Log out</button>
      </div>
    </dialog>
    </>
  )
}
