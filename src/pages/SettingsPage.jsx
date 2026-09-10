import { useState } from 'react'
import './Administration.css'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({ office: 'Office of the President', email: 'op@jhcsc.edu.ph', prefix: 'OP', autoArchive: true, emailAlerts: true, signatureAlerts: true, weeklyReport: false, sessionTimeout: '30' })

  function update(key, value) {
    setSaved(false)
    setSettings({ ...settings, [key]: value })
  }

  function save(event) {
    event.preventDefault()
    window.localStorage.setItem('op-dms-settings', JSON.stringify(settings))
    setSaved(true)
  }

  return <main className="dashboard-content admin-page">
    <div className="admin-title"><div><p className="eyebrow">Administration</p><h1>Settings</h1><p>Configure your office workspace, records, and security preferences.</p></div>{saved && <span className="saved-message">✓ Changes saved locally</span>}</div>
    <form className="settings-layout" onSubmit={save}>
      <div className="settings-main">
        <section className="settings-card"><div className="settings-card-title"><span>01</span><div><h2>Office information</h2><p>Details displayed across official records.</p></div></div><div className="settings-fields"><label>Office name<input name="office" value={settings.office} onChange={(e) => update('office', e.target.value)} /></label><label>Official email<input name="email" type="email" value={settings.email} onChange={(e) => update('email', e.target.value)} /></label><label>Document reference prefix<input name="referencePrefix" value={settings.prefix} onChange={(e) => update('prefix', e.target.value.toUpperCase())} maxLength="6" /></label></div></section>
        <section className="settings-card"><div className="settings-card-title"><span>02</span><div><h2>Document preferences</h2><p>Default behavior for records and archiving.</p></div></div><div className="setting-row"><div><strong>Automatically archive approved records</strong><small>Move completed documents into the archive after 30 days.</small></div><button type="button" className={`toggle ${settings.autoArchive ? 'on' : ''}`} onClick={() => update('autoArchive', !settings.autoArchive)}><i /></button></div></section>
        <section className="settings-card"><div className="settings-card-title"><span>03</span><div><h2>Notifications</h2><p>Choose which workspace updates you receive.</p></div></div>{[['emailAlerts','Document status updates','Receive an alert when a document changes status.'],['signatureAlerts','Signature reminders','Be notified when records are waiting for signature.'],['weeklyReport','Weekly activity report','Receive a weekly summary of office records.']].map(([key,title,text]) => <div className="setting-row" key={key}><div><strong>{title}</strong><small>{text}</small></div><button type="button" className={`toggle ${settings[key] ? 'on' : ''}`} onClick={() => update(key, !settings[key])}><i /></button></div>)}</section>
      </div>
      <aside className="settings-side"><section className="settings-card"><div className="settings-card-title"><span>04</span><div><h2>Security</h2><p>Local access controls.</p></div></div><label>Session timeout<select name="sessionTimeout" value={settings.sessionTimeout} onChange={(e) => update('sessionTimeout', e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select></label><div className="security-note"><strong>Local authentication</strong><p>This portal uses accounts stored within the application. No external database is connected.</p></div></section><button className="save-settings primary-action">Save settings</button></aside>
    </form>
  </main>
}
