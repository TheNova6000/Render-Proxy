import type { TraceEvent, TracerOptions, TracerAPI } from '../types.d'

interface TracerState {
  counter: number
  events: TraceEvent[]
  subscribers: Array<(event: TraceEvent) => void>
  executionStack: string[]
  currentExecutionId: string | null
  executionCounter: number
  initialized: boolean
  activeTracePayloads: Record<string, Record<string, unknown>>
  startTimes: Record<string, number>
  startTimeExpiry: Record<string, number>
  traceExecutionMap: Record<string, string | null>
  lastEventTimestamps: Record<string, number>
  options: TracerOptions
}

function getGlobalState(): TracerState {
  const g = globalThis as Record<string, unknown>
  if (!g.__RENDER_PROXY_TRACER__) {
    g.__RENDER_PROXY_TRACER__ = {
      counter: 1,
      events: [] as TraceEvent[],
      subscribers: [] as Array<(event: TraceEvent) => void>,
      executionStack: [] as string[],
      currentExecutionId: null as string | null,
      executionCounter: 1,
      initialized: false,
      activeTracePayloads: {} as Record<string, Record<string, unknown>>,
      startTimes: {} as Record<string, number>,
      startTimeExpiry: {} as Record<string, number>,
      traceExecutionMap: {} as Record<string, string | null>,
      lastEventTimestamps: {} as Record<string, number>,
      options: {} as TracerOptions
    }
  }
  return g.__RENDER_PROXY_TRACER__ as TracerState
}

function now(): number {
  return Date.now()
}

function notifySubscribers(state: TracerState, latestEvent: TraceEvent): void {
  for (const subscriber of state.subscribers) {
    try {
      subscriber(latestEvent)
    } catch {
      // subscriber errors must not crash the tracer
    }
  }
}

function sanitize(name: string): string {
  return String(name).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function makeId(state: TracerState, prefix: string, name?: string): string {
  const c = state.counter++
  if (name) {
    const s = sanitize(name).toLowerCase().slice(0, 32)
    return `${prefix}_${s}_${c}`
  }
  return `${prefix}_${c}`
}

function pushEvent(state: TracerState, ev: TraceEvent): void {
  const maxEvents = state.options.maxEvents ?? 1000
  state.events.push(ev)
  if (state.events.length > maxEvents) {
    state.events.shift()
  }
  notifySubscribers(state, ev)
}

function expireStaleStartTimes(state: TracerState): void {
  const STALE_AFTER_MS = 5 * 60 * 1000
  const cutoff = now() - STALE_AFTER_MS
  for (const id of Object.keys(state.startTimeExpiry)) {
    if (state.startTimeExpiry[id] < cutoff) {
      delete state.startTimes[id]
      delete state.startTimeExpiry[id]
      delete state.traceExecutionMap[id]
    }
  }
}

export function getTraceEvents(): TraceEvent[] {
  return getGlobalState().events.slice()
}

export function clearTraceEvents(): void {
  const state = getGlobalState()
  state.events = []
  const clearEv = {
    id: makeId(state, 'clear'),
    parentId: null,
    executionId: null,
    type: 'CLEAR' as const,
    category: 'other' as const,
    timestamp: now()
  }
  notifySubscribers(state, clearEv)
}

export function subscribeToEvents(cb: (event: TraceEvent) => void): () => void {
  const state = getGlobalState()
  state.subscribers.push(cb)
  return () => {
    state.subscribers = state.subscribers.filter((s) => s !== cb)
  }
}

export function getExecutionTree(executionId: string): TraceEvent[] {
  const state = getGlobalState()
  const items = state.events.filter((e) => e.executionId === executionId)
  const map: Record<string, TraceEvent & { children: TraceEvent[] }> = {}
  items.forEach((it) => {
    map[it.id] = { ...it, children: [] }
  })
  const roots: TraceEvent[] = []
  items.forEach((it) => {
    const mapped = map[it.id]
    if (it.parentId && map[it.parentId]) {
      map[it.parentId].children.push(mapped)
    } else {
      roots.push(mapped)
    }
  })
  return roots
}

export function traceStart(payload: Record<string, unknown> = {}): string | null {
  const state = getGlobalState()
  const timestamp = now()

  // Drop interval callbacks — too noisy by default
  if (payload.type === 'INTERVAL_CALLBACK') return null

  // Throttle onChange events (default 1000ms, configurable)
  if (payload.type === 'EVENT_START' && payload.eventName === 'onChange') {
    const throttleMs = state.options.onChangeThrottleMs ?? 1000
    const last = state.lastEventTimestamps['onChange'] || 0
    if (timestamp - last < throttleMs) return null
    state.lastEventTimestamps['onChange'] = timestamp
  }

  // Throttle PascalCase functions that slipped past the Babel plugin
  if (payload.functionName && /^[A-Z]/.test(String(payload.functionName))) {
    const key = `PascalCase_${payload.functionName}`
    const last = state.lastEventTimestamps[key] || 0
    if (timestamp - last < 500) return null
    state.lastEventTimestamps[key] = timestamp
  }

  // New user-interaction → new execution grouping
  let createdExecution: string | null = null
  if (payload.type === 'EVENT_START') {
    createdExecution = `execution_${state.executionCounter++}`
    state.currentExecutionId = createdExecution
  }

  let idPrefix = 'trace'
  let nameForId: string | undefined
  if (payload.type === 'FETCH_START') {
    idPrefix = 'fetch'
    nameForId = payload.args && Array.isArray(payload.args) ? String(payload.args[0]) : undefined
  } else if (payload.type === 'EVENT_START') {
    idPrefix = 'event'
    nameForId = String(payload.eventName || '')
  } else if (payload.functionName) {
    idPrefix = 'fn'
    nameForId = String(payload.functionName)
  }

  const id = makeId(state, idPrefix, nameForId)
  const parent = state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null

  const category =
    payload.category ||
    (payload.type === 'FETCH_START' ? 'fetch' :
     payload.type === 'EVENT_START' ? 'user' : 'function')

  const ev: TraceEvent = {
    id,
    executionId: state.currentExecutionId,
    parentId: parent,
    type: String(payload.type || 'FUNCTION_START') as TraceEvent['type'],
    category: String(category) as TraceEvent['category'],
    timestamp,
    ...payload
  } as TraceEvent

  state.activeTracePayloads[id] = payload
  state.startTimes[id] = timestamp
  state.startTimeExpiry[id] = timestamp
  state.traceExecutionMap[id] = state.currentExecutionId

  state.executionStack.push(id)
  pushEvent(state, ev)
  expireStaleStartTimes(state)
  return id
}

export function traceEnd(): void {
  const state = getGlobalState()
  const timestamp = now()
  const popped = state.executionStack.pop()
  if (!popped) return

  const startTime = state.startTimes[popped]
  const duration = startTime != null ? Math.max(0, timestamp - startTime) : null
  const execId = state.traceExecutionMap[popped] ?? state.currentExecutionId

  const endEv: TraceEvent = {
    id: makeId(state, 'end', popped),
    executionId: execId,
    parentId: popped,
    type: 'FUNCTION_END',
    category: 'function',
    timestamp,
    duration
  } as TraceEvent
  pushEvent(state, endEv)

  const payload = state.activeTracePayloads[popped]
  if (payload && payload.type === 'EVENT_START') {
    state.currentExecutionId = null
  }

  delete state.activeTracePayloads[popped]
  delete state.startTimes[popped]
  delete state.startTimeExpiry[popped]
  delete state.traceExecutionMap[popped]
}

function wrapFetch(state: TracerState): void {
  if (typeof window === 'undefined' || !window.fetch) return
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const parent = state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null
    const rawUrl = args[0] ? String(args[0]) : ''
    const method = ((args[1] as RequestInit | undefined)?.method || 'GET').toUpperCase()
    let fetchName = rawUrl
    try {
      const parsed = new URL(rawUrl, location.href)
      fetchName = `${method} ${parsed.pathname}`
    } catch {
      fetchName = `${method} ${rawUrl}`
    }

    const startId = makeId(state, 'fetch', 'api')
    const ts = now()
    state.startTimes[startId] = ts
    state.startTimeExpiry[startId] = ts
    state.traceExecutionMap[startId] = state.currentExecutionId

    pushEvent(state, {
      id: startId,
      executionId: state.currentExecutionId,
      parentId: parent,
      type: 'FETCH_START',
      category: 'fetch',
      timestamp: ts,
      fetchName,
      args: args as unknown[]
    } as TraceEvent)

    try {
      const res = await nativeFetch(...args)
      const endTs = now()
      const dur = state.startTimes[startId] != null ? endTs - state.startTimes[startId] : null
      pushEvent(state, {
        id: makeId(state, 'fetch_end', 'api'),
        executionId: state.traceExecutionMap[startId] ?? state.currentExecutionId,
        parentId: startId,
        type: 'FETCH_END',
        category: 'fetch',
        timestamp: endTs,
        duration: dur,
        fetchName,
        status: res?.status
      } as TraceEvent)
      delete state.startTimes[startId]
      delete state.startTimeExpiry[startId]
      delete state.traceExecutionMap[startId]
      return res
    } catch (err) {
      const endTs = now()
      const dur = state.startTimes[startId] != null ? endTs - state.startTimes[startId] : null
      pushEvent(state, {
        id: makeId(state, 'fetch_error', 'api'),
        executionId: state.traceExecutionMap[startId] ?? state.currentExecutionId,
        parentId: startId,
        type: 'FETCH_ERROR',
        category: 'error',
        timestamp: endTs,
        duration: dur,
        fetchName,
        error: String(err)
      } as TraceEvent)
      delete state.startTimes[startId]
      delete state.startTimeExpiry[startId]
      delete state.traceExecutionMap[startId]
      throw err
    }
  }
}

function wrapSetTimeout(state: TracerState): void {
  if (typeof window === 'undefined') return
  const nativeSetTimeout = window.setTimeout.bind(window)
  ;(window as Window).setTimeout = function (cb: TimerHandler, ms?: number, ...rest: unknown[]) {
    const active = state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null
    const wrapped = function (...a: unknown[]) {
      if (active) state.executionStack.push(active)
      try {
        const id = traceStart({ type: 'TIMEOUT_CALLBACK' })
        try {
          return typeof cb === 'function' ? cb(...a) : undefined
        } finally {
          if (id !== null) traceEnd()
        }
      } finally {
        if (active) state.executionStack.pop()
      }
    }
    return nativeSetTimeout(wrapped as TimerHandler, ms, ...rest)
  } as typeof window.setTimeout
}

function wrapSetInterval(state: TracerState): void {
  if (typeof window === 'undefined') return
  const nativeSetInterval = window.setInterval.bind(window)
  ;(window as Window).setInterval = function (cb: TimerHandler, ms?: number, ...rest: unknown[]) {
    const active = state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null
    const wrapped = function (...a: unknown[]) {
      if (active) state.executionStack.push(active)
      try {
        const id = traceStart({ type: 'INTERVAL_CALLBACK' })
        try {
          return typeof cb === 'function' ? cb(...a) : undefined
        } finally {
          if (id !== null) traceEnd()
        }
      } finally {
        if (active) state.executionStack.pop()
      }
    }
    return nativeSetInterval(wrapped as TimerHandler, ms, ...rest)
  } as typeof window.setInterval
}

function wrapGlobalErrors(state: TracerState): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (ev) => {
    pushEvent(state, {
      id: makeId(state, 'error'),
      executionId: state.currentExecutionId,
      parentId: state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null,
      type: 'ERROR',
      category: 'error',
      timestamp: now(),
      error: ev?.message || String(ev)
    } as TraceEvent)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    pushEvent(state, {
      id: makeId(state, 'unhandled'),
      executionId: state.currentExecutionId,
      parentId: state.executionStack.length ? state.executionStack[state.executionStack.length - 1] : null,
      type: 'UNHANDLED_REJECTION',
      category: 'error',
      timestamp: now(),
      reason: String((ev as PromiseRejectionEvent).reason)
    } as TraceEvent)
  })
}

export function initTracer(opts: TracerOptions = {}): TracerAPI {
  const state = getGlobalState()
  if (state.initialized) return { getTraceEvents, clearTraceEvents, subscribeToEvents, getExecutionTree }
  state.initialized = true
  state.options = opts
  if (opts.debug) {
    ;(globalThis as Record<string, unknown>).__RPT_DEBUG__ = true
  }
  wrapFetch(state)
  wrapSetTimeout(state)
  wrapSetInterval(state)
  wrapGlobalErrors(state)
  return { getTraceEvents, clearTraceEvents, subscribeToEvents, getExecutionTree }
}
