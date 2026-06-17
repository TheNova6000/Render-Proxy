import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '\u2302' },
  { to: '/projects', label: 'Projects', icon: '\u2630' },
  { to: '/tasks', label: 'Tasks', icon: '\u2611' },
  { to: '/calendar', label: 'Calendar', icon: '\u2637' },
  { to: '/settings', label: 'Settings', icon: '\u2699' },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">P</span>
        <span className="sidebar-name">Projex</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">JD</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">John Doe</span>
            <span className="sidebar-user-role">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
