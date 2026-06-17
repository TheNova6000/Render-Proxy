import React from 'react'
import { useApp } from '../context/AppContext'

export function Header() {
  const { addToast } = useApp()

  return (
    <header className="header">
      <div className="header-search">
        <span className="header-search-icon">{'\u2315'}</span>
        <input type="text" placeholder="Search anything..." spellCheck={false} />
        <span className="header-search-hint">Ctrl+K</span>
      </div>
      <div className="header-actions">
        <button className="header-btn" title="Notifications" onClick={() => addToast('No new notifications', 'info')}>
          {'\uD83D\uDD14'}
          <span className="header-badge">3</span>
        </button>
        <button className="header-btn" title="Help">{'\u2753'}</button>
        <div className="header-avatar" title="Profile">JD</div>
      </div>
    </header>
  )
}
