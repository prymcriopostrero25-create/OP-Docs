export default function Navbar({ isMenuOpen, onToggleMenu }) {
  return (
    <header className="dashboard-header">
      <button className="mobile-menu" onClick={onToggleMenu} aria-controls="main-sidebar" aria-expanded={isMenuOpen} aria-label="Toggle menu">☰</button>
      <div className="search"><span>⌕</span><input name="globalSearch" aria-label="Search" placeholder="Search documents, reference numbers..." /></div>
      <div className="header-actions">
        <button className="notification" aria-label="Notifications">♢<i /></button>
        <div className="header-divider" />
        <div className="office-label"><small>Current office</small><strong>Office of the President⌄</strong></div>
      </div>
    </header>
  )
}
