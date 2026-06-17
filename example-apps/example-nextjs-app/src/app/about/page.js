'use client'

import { useState } from 'react'

export default function AboutPage() {
  const [testResult, setTestResult] = useState(null)

  function runTraceTest() {
    const start = performance.now()
    let sum = 0
    for (let i = 0; i < 1_000_000; i++) sum += i
    const elapsed = (performance.now() - start).toFixed(2)
    setTestResult(`Computed sum of 1M numbers: ${sum.toLocaleString()} in ${elapsed}ms`)
  }

  return (
    <div className="about-page">
      <h1>About DevForum</h1>
      <p className="sub">A Next.js App Router demo app built with render-proxy-tracer</p>
      <div className="about-cards">
        <div className="about-card">
          <h2>What is this?</h2>
          <p>
            DevForum is a developer forum UI powered by the free JSONPlaceholder API.
            It demonstrates how <strong>render-proxy-tracer</strong> instruments a Next.js
            application at build time — every function call, fetch request, and timer
            fires a trace event visible in the Render-Proxy Chrome DevTools panel.
          </p>
        </div>
        <div className="about-card">
          <h2>How tracing works here</h2>
          <ul>
            <li>The <code>.babelrc</code> injects the render-proxy Babel plugin into Next.js compilation</li>
            <li>Every function in <code>page.js</code> and <code>layout.js</code> gets wrapped with traceStart/traceEnd</li>
            <li><code>window.fetch</code> is patched by <code>initTracer()</code> in the root layout</li>
            <li>The DevTools panel shows live call graphs and fetch timelines</li>
          </ul>
        </div>
        <div className="about-card">
          <h2>Try generating trace events</h2>
          <p>Click the button below to run a CPU-bound calculation. Watch the function trace appear in the Render-Proxy DevTools panel.</p>
          <button className="btn-trace-test" onClick={runTraceTest}>
            Run calculation trace
          </button>
          {testResult && <p style={{ marginTop: '10px', color: '#34d399' }}>{testResult}</p>}
        </div>
      </div>
    </div>
  )
}
