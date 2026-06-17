import React from 'react'

export function StatCard({ title, value, icon, trend, color }) {
  return (
    <div className="stat-card" style={{ '--accent': color || 'var(--accent-blue)' }}>
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        {trend != null && (
          <span className={`stat-trend${trend >= 0 ? ' up' : ' down'}`}>
            {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
    </div>
  )
}
