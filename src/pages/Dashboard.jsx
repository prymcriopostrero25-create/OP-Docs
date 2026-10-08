import { lockBodyScroll } from '../lib/scrollLock'
import LoadingModal from '../components/LoadingModal'
import { fetchDocuments, fetchActivityLogs, updateDocumentStatus, editDocument, deleteDocument, createDocument as saveCreatedDocument } from '../lib/appsScriptApi'
import LiveOverview from '../components/LiveOverview'
import { canAccessPage, permissionsFor } from '../lib/permissions'
import { DocumentContext } from '../lib/documentContext'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchOverview } from '../lib/appsScriptApi'
import { usePageData } from '../lib/usePageData'
import Sidebar from '../components/Sidebar'
import PageLoadBoundary from '../components/PageLoadBoundary'
import './Dashboard.css'

const CreateDocument = lazy(() => import('../components/CreateDocument'))
const DocumentsPage = lazy(() => import('./DocumentsPage'))
const ArchivePage = lazy(() => import('./ArchivePage'))
const ActivityLogPage = lazy(() => import('./ActivityLogPage'))
const UserManagementPage = lazy(() => import('./UserManagementPage'))
const UserLogsPage = lazy(() => import('./UserLogsPage'))
const SettingsPage = lazy(() => import('./SettingsPage'))
const emptyFiles = []

export default function Dashboard({ user, onLogout }) {
  const [selectedPage, setActive] = useState('Overview')
  const [documentType, setDocumentType] = useState(null)
  const active = selectedPage === 'Create document' || canAccessPage(user, selectedPage) ? selectedPage : 'Overview'
  const permissions = permissionsFor(user)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [summaryAttempt, setSummaryAttempt] = useState(0)
  const [drafts, setDrafts] = useState([])
  const loadDocuments = useCallback((refresh = loadAttempt > 0) => fetchDocuments(refresh), [loadAttempt])
  const documents = usePageData(['Documents', 'Archive'].includes(active), loadDocuments, loadAttempt, ['Documents', 'Archive'].includes(active) ? 30000 : 0)
  const activities = usePageData(active === 'Activity log' && permissions.fullAccess, fetchActivityLogs, loadAttempt + summaryAttempt)
  const loadOverview = useCallback(() => fetchOverview(loadAttempt + summaryAttempt > 0), [loadAttempt, summaryAttempt])
  const overview = usePageData(active === 'Overview', loadOverview, loadAttempt + summaryAttempt)
  const files = documents.data || emptyFiles
  const activityLogs = permissions.fullAccess ? activities.data || [] : []
  const pageData = active === 'Overview' ? overview : active === 'Activity log' ? activities : documents
  const loading = pageData.loading
  const loadError = pageData.error
  function setFiles(update) {
    documents.setData(update)
    setSummaryAttempt(attempt => attempt + 1)
  }
  const setActivityLogs = activities.setData
  const records = useMemo(() => [...drafts, ...files.map(file => ({ ...file, title: file.subject, reference: file.id, owner: file.owner || '', updated: file.updated || file.date, status: file.status || 'For Review' }))], [drafts, files])

  async function changeStatus(reference, status) {
    if (!permissions.changeStatus || records.find(record => record.reference === reference)?.status === 'Out') return
    if (status === 'Out' && !window.confirm('Mark this document OUT? Further editing will be locked.')) return
    const draft = drafts.find(record => record.reference === reference)
    if (draft) { setDrafts(current => current.map(record => record.reference === reference ? { ...record, status } : record)); return }
    const record = await updateDocumentStatus(reference, status, records.find(record => record.reference === reference)?.type)
    setFiles(current => current.map(file => file.id === reference ? record : file))
    setActivityLogs(current => [...current, { ...record, activity: `Status changed to ${status}`, date: new Date().toISOString() }])
  }

  async function createDocument(form) {
    const type = form.type === 'Certification of Travel Abroad' ? 'Certificate of Travel' : form.type === 'Travel Authority Abroad' ? 'Authority to Travel Abroad' : form.type
    const record = await saveCreatedDocument({ ...form, type })
    setFiles(current => [record, ...current.filter(file => file.id !== record.id)])
    return record
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
  useEffect(() => {
    if (!menuOpen) return
    const unlockScroll = lockBodyScroll()

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      unlockScroll()
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 851px)')
    const closeMenu = (event) => { if (event.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeMenu)
    return () => desktop.removeEventListener('change', closeMenu)
  }, [])


  return (
    <DocumentContext.Provider value={{ records, files, setFiles, summary: overview.data, activityLogs, loading, loadError, changeStatus, editRecord, deleteRecord, permissions, refreshRecords: () => setLoadAttempt(attempt => attempt + 1) }}>
    <div className="dashboard-shell">
      <Sidebar
        active={active === 'Create document' ? 'Documents' : active}
        isOpen={menuOpen}
        onNavigate={(label) => {
          if (label === 'Verification') {
            const url = new URL(window.location.href)
            url.searchParams.set('verify', '')
            url.hash = ''
            window.location.assign(url.href)
            return
          }
          if (canAccessPage(user, label)) setActive(label)
          setMenuOpen(false)
        }}
        onLogout={onLogout}
        onClose={() => setMenuOpen(false)}
        user={user}
      />

      <div className="dashboard-main" inert={menuOpen}>
        <button type="button" className="dashboard-navigation-toggle" onClick={() => setMenuOpen(isOpen => !isOpen)} aria-controls="main-sidebar" aria-expanded={menuOpen} aria-label="Open navigation"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span>Menu</span></button>

        <PageLoadBoundary key={active}><Suspense fallback={<LoadingModal title="Loading page..." />}>
        {active === 'Create document' ? <main className="dashboard-content create-document-page"><CreateDocument isOpen page onClose={() => setActive('Documents')} onCreate={createDocument} onViewCreated={record => { setDocumentType(record.type); setActive('Documents') }} canChangeStatus={permissions.changeStatus} /></main>
          : active === 'Documents' ? <DocumentsPage initialType={documentType} onCreateDocument={() => { setMenuOpen(false); setActive('Create document') }} />
          : active === 'Archive' ? <ArchivePage />
          : active === 'Activity log' ? <ActivityLogPage />
          : active === 'User management' ? <UserManagementPage />
          : active === 'User logs' ? <UserLogsPage />
          : active === 'Settings' ? <SettingsPage />
          : <LiveOverview user={user} onDocuments={() => setActive('Documents')} onCreate={() => { setMenuOpen(false); setActive('Create document') }} />}
        </Suspense></PageLoadBoundary>
      </div>
      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </div>
    </DocumentContext.Provider>
  )
}
