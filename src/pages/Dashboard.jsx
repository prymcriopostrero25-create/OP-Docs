import { fetchDocuments, fetchActivityLogs, updateDocumentStatus, editDocument, deleteDocument } from '../lib/appsScriptApi'
import LiveOverview from '../components/LiveOverview'
import { canAccessPage, permissionsFor } from '../lib/permissions'
import { DocumentContext } from '../lib/documentContext'
import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import CreateDocument from '../components/CreateDocument'
import DocumentsPage from './DocumentsPage'
import ArchivePage from './ArchivePage'
import ActivityLogPage from './ActivityLogPage'
import UserManagementPage from './UserManagementPage'
import UserLogsPage from './UserLogsPage'
import SettingsPage from './SettingsPage'
import './Dashboard.css'

export default function Dashboard({ user, onLogout }) {
  const [selectedPage, setActive] = useState('Overview')
  const active = canAccessPage(user, selectedPage) ? selectedPage : 'Overview'
  const permissions = permissionsFor(user)
  const [files, setFiles] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [drafts, setDrafts] = useState([])
  useEffect(() => {
    let active = true
    Promise.all([fetchDocuments(), fetchActivityLogs()]).then(([documents, activities]) => { if (active) { setFiles(documents); setActivityLogs(activities) } })
      .catch(error => { if (active) setLoadError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const records = [...drafts, ...files.map(file => ({ ...file, title: file.subject, reference: file.id, owner: '', updated: file.date, status: file.status || 'For Review' }))]

  async function changeStatus(reference, status) {
    if (!permissions.changeStatus || records.find(record => record.reference === reference)?.status === 'Out') return
    if (status === 'Out' && !window.confirm('Mark this document OUT? Further editing will be locked.')) return
    const draft = drafts.find(record => record.reference === reference)
    if (draft) { setDrafts(current => current.map(record => record.reference === reference ? { ...record, status } : record)); return }
    const record = await updateDocumentStatus(reference, status)
    setFiles(current => current.map(file => file.id === reference ? record : file))
    setActivityLogs(current => [...current, { ...record, activity: `Status changed to ${status}`, date: new Date().toISOString() }])
  }

  function createDocument(form) {
    setDrafts((current) => [{ ...form, type: form.type === 'Certification of Travel Abroad' ? 'Certificate of Travel' : form.type === 'Travel Authority Abroad' ? 'Authority to Travel Abroad' : form.type, status: permissions.changeStatus ? form.status : 'Draft', updated: new Date().toLocaleDateString() }, ...current])
    setActive('Documents')
  }
  async function editRecord(reference, title) {
    if (!permissions.changeStatus || records.find(record => record.reference === reference)?.status === 'Out') throw new Error('This document cannot be edited.')
    if (drafts.some(record => record.reference === reference)) {
      setDrafts(current => current.map(record => record.reference === reference ? { ...record, title } : record))
      return
    }
    const updated = await editDocument(reference, title)
    setFiles(current => current.map(file => file.id === reference ? updated : file))
  }

  async function deleteRecord(reference) {
    if (!permissions.changeStatus || records.find(record => record.reference === reference)?.status === 'Out') throw new Error('This document cannot be deleted.')
    if (drafts.some(record => record.reference === reference)) {
      setDrafts(current => current.filter(record => record.reference !== reference))
      return
    }
    await deleteDocument(reference)
    setFiles(current => current.filter(file => file.id !== reference))
    const deleted = records.find(record => record.reference === reference)
    setActivityLogs(current => [...current, { ...deleted, activity: 'Deleted', date: new Date().toISOString(), subject: deleted?.title }])
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen && !createOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setCreateOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen, createOpen])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 851px)')
    const closeMenu = (event) => { if (event.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeMenu)
    return () => desktop.removeEventListener('change', closeMenu)
  }, [])


  return (
    <DocumentContext.Provider value={{ records, files, setFiles, activityLogs, loading, loadError, changeStatus, editRecord, deleteRecord, permissions }}>
    <div className="dashboard-shell">
      <Sidebar
        active={active}
        isOpen={menuOpen}
        onNavigate={(label) => {
          if (canAccessPage(user, label)) setActive(label)
          setMenuOpen(false)
        }}
        onLogout={onLogout}
        onCreateDocument={() => { setMenuOpen(false); setCreateOpen(true) }}
        onClose={() => setMenuOpen(false)}
        user={user}
      />

      <div className="dashboard-main" inert={menuOpen || createOpen}>
        <Navbar isMenuOpen={menuOpen} onToggleMenu={() => setMenuOpen((isOpen) => !isOpen)} />

        {active === 'Documents' ? <DocumentsPage onCreateDocument={() => { setMenuOpen(false); setCreateOpen(true) }} />
          : active === 'Archive' ? <ArchivePage />
          : active === 'Activity log' ? <ActivityLogPage />
          : active === 'User management' ? <UserManagementPage />
          : active === 'User logs' ? <UserLogsPage />
          : active === 'Settings' ? <SettingsPage />
          : <LiveOverview user={user} onDocuments={() => setActive('Documents')} />}
      </div>
      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <CreateDocument isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreate={createDocument} canChangeStatus={permissions.changeStatus} />
    </div>
    </DocumentContext.Provider>
  )
}
