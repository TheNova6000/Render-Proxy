# render-proxy-tracer

Build-time + runtime execution tracer for frontend applications.

Purpose
-------

`render-proxy-tracer` automatically instruments your application's code at build time and provides a tiny runtime SDK that emits structured execution trace events. The goal is to give developers high-signal tracing (user events → functions → network) with minimal changes to the app:

- Install the package
- Add the plugin to your build (Vite or Babel)
- Call `initTracer()` once at app startup

Design principles
-----------------

- Minimal developer effort: no manual wrapping of functions or replacing `useState`.
- Conservative instrumentation: avoid touching third-party libraries or React internals.
- Lightweight runtime: only a few safe monkey-patches (e.g. `fetch`, `setTimeout`) for MVP.
- Safe MVP choices: do NOT patch `Promise.prototype.then` (fragile), do NOT attempt to cover every JSX edge case.

Table of contents
-----------------

- Quick start
- What is instrumented
- How build-time instrumentation works (Babel plugin)
- Runtime SDK and APIs
- Trace model and event format
- Examples (before / after)
- Limitations, privacy & performance
- Build & publish
- Roadmap

Quick start
-----------

1. Install

```bash
npm install render-proxy-tracer
```

2. Add plugin (Vite)

```js
// vite.config.js
// After building the package the plugin is available at `dist/plugin`.
import vitePlugin from 'render-proxy-tracer/dist/plugin/vite-plugin'

export default {
  plugins: [vitePlugin()]
}
```

3. Or add the Babel plugin (JS Babel config)

```js
// babel.config.js
// Load the transpiled plugin from the package dist folder:
module.exports = {
  plugins: [require('render-proxy-tracer/dist/plugin/babel-trace-plugin').default]
}
```

4. Initialize tracer at runtime (app entry)

```js
import { initTracer } from 'render-proxy-tracer'
initTracer()
```

What gets instrumented (MVP)
----------------------------

Build-time instrumentation injects `traceStart(...)` and `traceEnd()` calls into user source code. For MVP we instrument:

- Function declarations
- Arrow / function expressions assigned to variables or object properties (simple assignments)
- React event handlers for the common cases: `onClick`, `onSubmit`, `onChange`
  - Supported JSX handler shapes (MVP):
    - Identifier handlers: `<button onClick={handleClick} />`
    - Inline arrow functions: `<button onClick={() => doStuff()} />`
  - Complex patterns (bound methods, deeply nested member expressions) are intentionally NOT handled in MVP.

Files that are NOT instrumented
--------------------------------

- Anything under `node_modules`
- Built output (`dist`, `.cache`) and files inside the tracer package itself
- React internals and third-party libraries

How the Babel plugin works (high level)
--------------------------------------

- The plugin runs as a pre-transform step during the build.
- For each instrumentable node it:
  1. Ensures an import exists for `traceStart`/`traceEnd` from `render-proxy-tracer`.
  2. Inserts a `traceStart({...})` call at the start of the function body.
  3. Wraps the original body in a `try { ... } finally { traceEnd() }` to ensure end events fire.
  4. For arrow functions with expression bodies, it converts them into a block body to insert the same pattern.
- For JSX event handlers (MVP) the plugin replaces simple handlers with a wrapper that calls `traceStart({type:'EVENT_START', eventName:'onClick'})`, executes the handler, and finally calls `traceEnd()`.

Why this approach
------------------

- Build-time changes keep runtime overhead small — only simple calls are inserted.
- The `try/finally` pattern guarantees `traceEnd()` on synchronous and many asynchronous flows started from instrumented functions (e.g., `fetch` started within function).
- Avoiding `Promise.prototype.then` patching and avoiding deep transformations reduces the risk of breaking third-party code.

Runtime SDK
-----------

Use `initTracer()` to install safe runtime instrumentation and start collecting events. The runtime does a few things:

- Patches `window.fetch` to emit `FETCH_START`, `FETCH_END` and `FETCH_ERROR` events (captures duration & status)
- Patches `setTimeout` so timeout callbacks become traceable (`TIMEOUT_CALLBACK`)
- Subscribes to `window.error` and `unhandledrejection` to capture runtime errors
- Maintains an in-memory event store and a simple parent/child trace stack

API
---

- `initTracer(opts?)` — initialize runtime instrumentation (idempotent)
- `getTraceEvents()` — returns current stored events (shallow copy)
- `clearTraceEvents()` — clears the internal event store
- `subscribeToEvents(cb)` — register callback called with a copy of events on every update; returns an unsubscribe function
- `traceStart(payload?)` and `traceEnd()` — runtime helpers; exposed for advanced/debug usage (the plugin injects calls to these)

Example usage
-------------

```js
import { initTracer, getTraceEvents, subscribeToEvents } from 'render-proxy-tracer'

initTracer()

const unsubscribe = subscribeToEvents(events => {
  console.log('trace events', events)
})

// later
console.log(getTraceEvents())
unsubscribe()
```

Trace model & event format
--------------------------

Every event is a plain object with a few common fields. Core fields:

- `id` — unique string id for the event (e.g. `trace_1`)
- `parentId` — id of the parent event or `null`
- `type` — event kind (see list below)
- `timestamp` — ms Unix epoch returned by `Date.now()`

Typical event `type` values (MVP):

- `FUNCTION_START` / `FUNCTION_END`
- `EVENT_START` (root user event like click)
- `FETCH_START` / `FETCH_END` / `FETCH_ERROR`
- `TIMEOUT_CALLBACK`
- `ERROR` / `UNHANDLED_REJECTION`

Example events

```json
{
  "id": "trace_1",
  "parentId": "click_1",
  "type": "FUNCTION_START",
  "functionName": "handleSearch",
  "fileName": "Search.jsx",
  "lineNumber": 12,
  "timestamp": 1682700000000
}

{
  "id": "fetch_5",
  "parentId": "trace_1",
  "type": "FETCH_START",
  "timestamp": 1682700000100,
  "args": ["/api/search?q=...", {"method":"GET"}]
}

{
  "id": "fetch_end_6",
  "parentId": "fetch_5",
  "type": "FETCH_END",
  "timestamp": 1682700000500,
  "status": 200
}
```

How parent-child relationships work
-----------------------------------

The runtime keeps a small stack (`currentStack`) of active trace ids. When the plugin inserts `traceStart()` at the top of a function it:

- Creates a unique id, records an event with `parentId` = current stack top
- Pushes the id to the stack
- `traceEnd()` pops the id and records a `FUNCTION_END` event with the popped id as a parent reference

This produces proper nesting for user events → functions → network calls that happen while a trace is active.

Concrete before/after examples
------------------------------

Function declaration

Before:

```js
function handleSearch() {
  fetchData()
}
```

After (approximate):

```js
function handleSearch() {
  traceStart({ functionName: 'handleSearch', fileName: 'Search.jsx', lineNumber: 12 })
  try {
    fetchData()
  } finally {
    traceEnd()
  }
}
```

Arrow function assigned to variable

Before:

```js
const doWork = () => compute()
```

After:

```js
const doWork = () => {
  traceStart({ functionName: 'doWork', fileName: 'App.jsx', lineNumber: 42 })
  try {
    return compute()
  } finally {
    traceEnd()
  }
}
```

JSX event handlers (MVP)

Before (identifier handler):

```jsx
<button onClick={handleClick}>Go</button>
```

After (wrapped):

```jsx
<button onClick={(e) => { traceStart({ type: 'EVENT_START', eventName: 'onClick' }); try { return handleClick(e) } finally { traceEnd() } }}>Go</button>
```

Before (inline arrow):

```jsx
<button onClick={() => doStuff()}>Go</button>
```

After (wrapped):

```jsx
<button onClick={(e) => { traceStart({ type: 'EVENT_START', eventName: 'onClick' }); try { return (() => doStuff())(e) } finally { traceEnd() } }}>Go</button>
```

Runtime patches and scope
------------------------

The runtime patches are intentionally small and conservative for the MVP:

- `fetch` — captures start, end, errors, response status
- `setTimeout` — wraps callbacks so they become traceable
- global `error` and `unhandledrejection` listeners — collect runtime failures

Why we DO NOT patch Promises for MVP
-------------------------------------

Patching `Promise.prototype.then` is powerful but fragile — it can break third-party libraries, React internals, and complex async chains. For MVP we avoid that risk and rely on function-level instrumentation + `fetch` instrumentation to capture common flows.

Limitations & known edge-cases
-----------------------------

- Does NOT instrument class instance methods or every possible function shape.
- JSX event handler instrumentation only handles simple identifier handlers and inline arrow functions for the MVP. Complex expressions, `bind`, or deeply nested member references are skipped.
- The plugin inserts `import { traceStart, traceEnd } from 'render-proxy-tracer'` into files. If your build resolves packages in a non-standard way, configure module resolution accordingly.
- The in-memory event store can grow; consider periodically shipping or sampling events for production use.

Performance & privacy
---------------------

- The runtime is designed to be low-overhead. `traceStart`/`traceEnd` are small function calls and the plugin only instruments developer source.
- For privacy, the tracer does not automatically capture DOM state or user inputs. Avoid sending raw events to external servers without filtering sensitive data.

Build & development
-------------------

The package includes simple build scripts. From the package root run:

```bash
npm run build
```

This produces compiled outputs under `dist/` (ESM and CJS bundles and plugin files).

Babel plugin usage notes
------------------------

- Babel config must be a JS file to import a plugin function (e.g. `babel.config.js`) — `.babelrc` JSON does not support passing plugin functions directly.
- Example (JS config):

```js
// babel.config.js
module.exports = {
  plugins: [require('render-proxy-tracer').babelPlugin]
}
```

Vite plugin usage notes
-----------------------

- Use the Vite plugin in `vite.config.js` as shown in Quick Start. The plugin runs during transform, skipping `node_modules`.

Troubleshooting
---------------

- If instrumentation isn't appearing, ensure the plugin runs before other transforms and that the files are standard JS/TS/JSX/TSX files (not precompiled).
- If you see runtime errors from third-party code, disable the plugin and inspect the transformed source to find the generated wrapper that could be incompatible.

Roadmap (possible next steps)
-----------------------------

- Add optional config to control include/exclude patterns and sampling
- Expand instrumentation to class methods and more JSX patterns (careful, only after thorough testing)
- Add a small example app and automated tests
- Add streaming export for large-scale usage (server-side collector)

Contributing
------------

Contributions welcome — open issues and PRs. Keep changes small and focused: this project prioritizes safety and minimal runtime impact.

License
-------

MIT