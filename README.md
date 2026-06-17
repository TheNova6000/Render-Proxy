# Render-proxy

> Automatic execution tracing & visual debugging for frontend applications — no manual instrumentation required.

Render-proxy is a full-stack debugging tool that **automatically injects a tracing plugin** into your frontend application at build time, captures structured execution metadata (function calls, event handlers, network requests, errors, DOM mutations), and visualises everything as an interactive, replayable execution graph inside Chrome DevTools.

---

## The Problem

When debugging a frontend app, understanding the **runtime execution flow** is hard:
- Which function called which?
- What was the chain from a button click to a network request?
- How did state changes propagate?
- What caused that re-render or API call?

Traditional debugging (console.log, breakpoints) gives you snapshots, not a connected story.

---

## What Render-proxy Does

Render-proxy instruments your source code at **build time** (via Babel), injecting minimal tracing calls. At **runtime**, a lightweight SDK collects structured events (function entries/exits, fetch calls, event handlers, errors, timeouts). These events are visualised in a **Chrome DevTools panel** as an interactive execution graph with screenshot replay.

No manual `console.log`, no wrapper functions, no decorators — just add the plugin and call `initTracer()`.

```
User clicks button
  → EVENT_START (onClick handler wraps)
    → FUNCTION_START handleSearch()
      → FETCH_START GET /api/search?q=...
      → FETCH_END (200, 340ms)
    → FUNCTION_END handleSearch (420ms total)
  → EVENT_END
```

---

## Architecture

The project is split into three packages:

```
Render-proxy/
├── render-proxy-tracer/              ← Core tracing library (build-time plugin + runtime SDK)
├── render-proxy-extension/           ← Chrome DevTools extension (visualisation panel)
└── example-apps/
    ├── example-weather-app/          ← React weather search demo
    ├── example-vanilla-app/          ← Vanilla JS demo (no framework)
    ├── example-complex-app/          ← React + React Router demo (multi-page)
    ├── example-nextjs-app/           ← Next.js App Router demo (Babel plugin)
    └── example-vue-app/              ← Vue 3 + Vite demo
```

### 1. `render-proxy-tracer` — The Core Library

A build-time + runtime instrumentation system:

- **Babel plugin** — Automatically transforms your source code at build time, injecting `traceStart(...)` / `traceEnd()` calls into:
  - Function declarations
  - Arrow / function expressions (assigned to variables or object properties)
  - JSX event handlers (`onClick`, `onSubmit`, `onChange`)
  - Skips: `node_modules`, library internals, React components (PascalCase names), the tracer package itself
- **Vite plugin** — Thin wrapper that invokes the Babel plugin during Vite transforms
- **Runtime SDK** — A tiny (~2KB) runtime that:
  - Patches `window.fetch` to emit `FETCH_START` / `FETCH_END` / `FETCH_ERROR` events
  - Patches `window.setTimeout` to trace timeout callbacks
  - Listens for `window.error` and `unhandledrejection`
  - Maintains an in-memory event store with parent-child execution tracking
  - Exposes `initTracer()`, `getTraceEvents()`, `clearTraceEvents()`, `subscribeToEvents()`

### 2. `render-proxy-extension` — Chrome DevTools Extension

A Chrome extension (Manifest V3) that connects to the runtime tracer and visualises traces:

- **`inject.js`** — Injected into the page's JS context; subscribes to tracer events and relays them via `window.postMessage`
- **`content.js`** — Receives trace events, takes DOM screenshots via `html2canvas` (throttled), observes DOM mutations via `MutationObserver`, and forwards everything to the background service worker
- **`background.js`** — Per-tab event store (max 1000 events, 80 screenshots); forwards to the DevTools panel via a persistent port
- **DevTools Panel (React + React Flow)** — Interactive visualisation with:
  - Execution graph (nodes = functions/events, edges = parent-child flow)
  - Colour-coded by category (User, Functions, Fetch, DOM, Error, etc.)
  - Filter bar to toggle event categories
  - Step-by-step playback with timeline slider
  - Screenshot viewer for visual state at each step
  - Raw JSON event inspector

### 3. Example Applications

Five demo apps demonstrating the tracer across different frameworks and build setups:

| App | Framework | Build | Plugin |
|---|---|---|---|
| `example-weather-app` | React 19 | Vite | Vite plugin |
| `example-vanilla-app` | Vanilla JS | Vite | Vite plugin |
| `example-complex-app` | React 19 + Router | Vite | Vite plugin |
| `example-nextjs-app` | Next.js 15 (App Router) | Next.js + Babel | Babel plugin |
| `example-vue-app` | Vue 3 | Vite | Vite plugin |

---

## How It Works: End-to-End Flow

```
┌─────────────────── BUILD TIME ───────────────────┐
│                                                   │
│  Source: handleSearch() { fetchData() }           │
│         │                                         │
│         ▼  Babel plugin (build-time transform)    │
│         │                                         │
│  Transformed:                                      │
│    function handleSearch() {                      │
│      traceStart({functionName, fileName, line})   │
│      try { fetchData() }                          │
│      finally { traceEnd() }                       │
│    }                                              │
│                                                   │
└───────────────────────────────────────────────────┘

┌─────────────────── RUNTIME ───────────────────────┐
│                                                   │
│  initTracer():                                    │
│    • Patches window.fetch → FETCH_START/END       │
│    • Patches setTimeout → TIMEOUT_CALLBACK         │
│    • Adds error/unhandledrejection listeners       │
│                                                   │
│  Page Context (__RENDER_PROXY_TRACER__)           │
│    ↕ window.postMessage                           │
│  inject.js (subscribed to tracer events)          │
│    ↕                                              │
│  content.js (relays + screenshots + DOM observer) │
│    ↕ chrome.runtime.sendMessage                   │
│  background.js (per-tab store, max 1000 events)   │
│    ↕ chrome.runtime.Port                          │
│  DevTools Panel (React Flow graph + replay)       │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Metadata Captured

Every trace event carries structured metadata:

| Field | Description | Example |
|---|---|---|
| `id` | Unique event identifier | `fn_search_3` |
| `parentId` | Parent event ID (execution tree) | `event_click_1` |
| `executionId` | Logical user-action grouping | `execution_5` |
| `type` | Event type | `FUNCTION_START` |
| `category` | High-level category | `function`, `fetch`, `user`, `error` |
| `timestamp` | Unix epoch (ms) | 1682700000000 |
| `functionName` | Name of the instrumented function | `handleSearch` |
| `fileName` | Source file path | `App.jsx` |
| `lineNumber` | Source line number | 42 |
| `duration` | Elapsed time in ms (end events) | 340 |
| `eventName` | JSX event name | `onClick`, `onChange` |
| `fetchName` | Normalised fetch URL | `GET /api/search` |
| `status` | HTTP status code | 200 |
| `error` / `reason` | Error message | `NetworkError` |

### Event Types

| Type | Source | Description |
|---|---|---|
| `FUNCTION_START` / `FUNCTION_END` | Babel plugin | Function entry / exit |
| `EVENT_START` | Babel plugin (JSX handlers) | User interaction start |
| `FETCH_START` / `FETCH_END` / `FETCH_ERROR` | Runtime `fetch` patch | Network request lifecycle |
| `TIMEOUT_CALLBACK` | Runtime `setTimeout` patch | Delayed callback |
| `ERROR` / `UNHANDLED_REJECTION` | Global listeners | Runtime exceptions |
| `DOM_MUTATION` | Content script | DOM observer summary |
| `CLEAR` | Manual call | Event store cleared |

---

## Getting Started

### 1. Install the tracer package

```bash
npm install render-proxy-tracer
```

### 2. Add the Vite plugin

```js
// vite.config.js
import vitePlugin from 'render-proxy-tracer/dist/plugin/vite-plugin'

export default {
  plugins: [vitePlugin()]
}
```

Or for Babel:

```js
// babel.config.js
module.exports = {
  plugins: [require('render-proxy-tracer/dist/plugin/babel-trace-plugin').default]
}
```

### 3. Initialise the runtime SDK

```js
// src/main.jsx (app entry point)
import { initTracer } from 'render-proxy-tracer'

initTracer()
```

### 4. (Optional) Install the Chrome Extension

Load the `render-proxy-extension/dist` folder as an unpacked extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist` folder inside `render-proxy-extension`

Open Chrome DevTools → find the **Render-proxy** tab.

---

## Project Structure

├── example-apps/
│   ├── example-weather-app/        # React weather search demo
│   │   ├── src/
│   │   │   ├── main.jsx            # Entry — calls initTracer()
│   │   │   └── App.jsx             # Weather search UI
│   │   └── vite.config.js          # Uses render-proxy-tracer plugin
│   │
│   ├── example-vanilla-app/        # Vanilla JS demo (no framework)
│   │   ├── index.html              # HTML with inline buttons
│   │   ├── src/
│   │   │   └── main.js             # Entry — functions, timers, fetch
│   │   └── vite.config.js          # Uses render-proxy-tracer plugin
│   │
│   ├── example-complex-app/        # React multi-page demo
│   │   ├── src/
│   │   │   ├── main.jsx            # Entry — Router + Context + initTracer
│   │   │   ├── App.jsx             # Route definitions
│   │   │   ├── pages/              # Dashboard, Projects, Tasks, etc.
│   │   │   ├── components/         # Layout, Sidebar, modals
│   │   │   ├── context/            # AppContext provider
│   │   │   └── utils/              # API helpers
│   │   └── vite.config.js
│   │
│   ├── example-nextjs-app/         # Next.js 15 App Router demo
│   │   ├── .babelrc                # Custom Babel config with tracer plugin
│   │   ├── next.config.mjs
│   │   └── src/app/
│   │       ├── layout.js           # Root layout — calls initTracer()
│   │       ├── page.js             # Home (counter, fetch, intervals)
│   │       └── about/page.js       # About page
│   │
│   ├── example-vue-app/            # Vue 3 + Vite demo
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.js             # Entry — calls initTracer()
│   │   │   └── App.vue             # Counter, fetch, timers
│   │   └── vite.config.js          # Uses Vue plugin + tracer
│   │
├── render-proxy-extension/         # Chrome DevTools extension
│   ├── extension/
│   │   ├── manifest.json           # Chrome Extension Manifest V3
│   │   ├── background.js           # Service worker / event hub
│   │   ├── content.js              # DOM observer + screenshot capture
│   │   ├── inject.js               # Page-context tracer bridge
│   │   ├── devtools.html/js        # DevTools panel entry
│   │   ├── panel.html              # Panel shell
│   │   └── src/
│   │       ├── MainApp.jsx         # Panel root component
│   │       └── components/
│   │           ├── traceGraph.jsx  # React Flow graph builder
│   │           ├── FilterBar.jsx   # Category filter chips
│   │           ├── PlaybackControls.jsx  # Step-by-step replay
│   │           └── ScreenshotViewer.jsx  # Screenshot + metadata
│   └── dist/                       # Built extension (load into Chrome)
│
└── render-proxy-package-gen/       # Core tracer library source
    └── render-proxyV1/
        ├── src/
        │   ├── index.ts            # Package entry / exports
        │   ├── types.d.ts          # TraceEvent type definitions
        │   ├── runtime/
        │   │   └── tracer.ts       # Runtime SDK (initTracer, etc.)
        │   └── plugin/
        │       ├── babel-trace-plugin.ts  # Babel AST transform
        │       └── vite-plugin.ts         # Vite integration wrapper
        ├── scripts/                # Manual test scripts
        ├── examples/               # Sample transform input
        └── dist/                   # Compiled output (ESM + CJS)
```

---

## Performance & Safety

- **Max 500 events** in-memory in the runtime tracer
- **Max 1000 events, 80 screenshots** per tab in the extension background
- **Throttling**: `onChange` events limited to 1/second; React component renders throttled to 1/500ms; `setInterval` callbacks silently dropped; screenshots limited to 1/700ms
- **No `Promise.prototype.then` patching** — avoids breaking third-party libraries
- **Components (PascalCase) are intentionally skipped** — they add noise, not signal
- **`try/finally` guarantees** that `traceEnd()` always fires

---

## Limitations

- Does not instrument class instance methods or complex JSX patterns (bound methods, nested member expressions)
- Event handlers only cover `onClick`, `onSubmit`, `onChange`
- In-memory event store — not designed for production long-running traces without a shipping layer
- No sampling configuration yet (planned)
- Only works with Vite (or direct Babel) builds

---

## Roadmap

- [ ] Configurable include/exclude patterns and sampling rates
- [ ] Class method instrumentation
- [ ] More JSX handler patterns
- [ ] Streaming export / server-side collector
- [ ] Automated test suite
- [ ] Source map–aware file paths

---

## License

MIT
