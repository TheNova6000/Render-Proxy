'use client'

import { initTracer, subscribeToEvents } from 'render-proxy-tracer'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import './globals.css'

export default function RootLayout({ children }) {
  const [eventCount, setEventCount] = useState(0)

  useEffect(() => {
    initTracer({ debug: false })
    const unsub = subscribeToEvents((events) => {
      setEventCount(events.length)
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DevForum — Next.js + Render-Proxy</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="app-header">
          <div className="header-brand">
            <span className="brand-icon">⬡</span>
            <div>
              <span className="brand-name">DevForum</span>
              <span className="brand-sub">Next.js App Router + Render-Proxy Tracer</span>
            </div>
          </div>
          <nav className="nav">
            <Link href="/" className="nav-link">Forum</Link>
            <Link href="/about" className="nav-link">About</Link>
          </nav>
          <span className="event-badge">⬡ {eventCount} events</span>
        </header>
        {children}
      </body>
    </html>
  )
}
