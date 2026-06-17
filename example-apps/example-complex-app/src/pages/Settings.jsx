import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

export function Settings() {
  const { settings, updateSettings, addToast } = useApp()
  const [form, setForm] = useState({ ...settings })
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState('general')

  function validate() {
    const errs = {}
    if (form.name && form.name.trim().length < 2) errs.name = 'Name too short'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    updateSettings({
      theme: form.theme,
      notifications: form.notifications,
      emailDigest: form.emailDigest,
      timezone: form.timezone,
    })
    addToast('Settings saved successfully', 'success')
  }

  const tabs = [
    { id: 'general', label: 'General', icon: '\u2699' },
    { id: 'notifications', label: 'Notifications', icon: '\uD83D\uDD14' },
    { id: 'team', label: 'Team', icon: '\uD83D\uDC65' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-desc">Manage your preferences</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={`settings-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="card settings-card">
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
              <div className="settings-section">
                <h3>Profile</h3>
                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    value={form.name || ''}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="John Doe"
                    className={errors.name ? 'input-error' : ''}
                  />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@example.com"
                    className={errors.email ? 'input-error' : ''}
                  />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
              </div>

              <div className="settings-section">
                <h3>Preferences</h3>
                <div className="form-group">
                  <label>Theme</label>
                  <select value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern (EST)</option>
                    <option value="America/Chicago">Central (CST)</option>
                    <option value="America/Los_Angeles">Pacific (PST)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>
              </div>

              <div className="settings-section">
                <h3>Danger Zone</h3>
                <div className="danger-zone">
                  <div className="danger-text">
                    <strong>Delete account</strong>
                    <p>Permanently remove your account and all data</p>
                  </div>
                  <button type="button" className="btn btn-danger" onClick={() => addToast('This is a demo - no account to delete', 'info')}>Delete</button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Changes</button>
            </form>
          )}

          {activeTab === 'notifications' && (
            <form onSubmit={handleSave}>
              <div className="settings-section">
                <h3>Notification Preferences</h3>
                <label className="toggle-row">
                  <span>Push notifications</span>
                  <input type="checkbox" checked={form.notifications} onChange={(e) => setForm((f) => ({ ...f, notifications: e.target.checked }))} />
                  <span className="toggle-switch" />
                </label>
                <div className="form-group">
                  <label>Email Digest</label>
                  <select value={form.emailDigest} onChange={(e) => setForm((f) => ({ ...f, emailDigest: e.target.value }))}>
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Changes</button>
            </form>
          )}

          {activeTab === 'team' && (
            <div className="settings-section">
              <h3>Team Members</h3>
              <p className="settings-hint">Team management coming soon</p>
              {['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].map((name) => (
                <div key={name} className="team-row">
                  <div className="team-avatar">{name[0]}</div>
                  <div className="team-info">
                    <strong>{name}</strong>
                    <span>{name.toLowerCase()}@company.com</span>
                  </div>
                  <span className="team-role">Member</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
