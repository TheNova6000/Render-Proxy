import React from 'react'
import { useApp } from '../context/AppContext'

const ICONS = {
  success: '\u2705',
  error: '\u274C',
  info: '\u2139\uFE0F',
}

export function ToastContainer() {
  const { toasts } = useApp()

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{ICONS[t.type] || ICONS.info}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
