export type TraceEventType =
  | 'FUNCTION_START'
  | 'FUNCTION_END'
  | 'EVENT_START'
  | 'FETCH_START'
  | 'FETCH_END'
  | 'FETCH_ERROR'
  | 'TIMEOUT_CALLBACK'
  | 'INTERVAL_CALLBACK'
  | 'DOM_MUTATION'
  | 'ERROR'
  | 'UNHANDLED_REJECTION'
  | 'CLEAR'
  | string

export type TraceCategory =
  | 'function'
  | 'user'
  | 'form'
  | 'fetch'
  | 'state'
  | 'render'
  | 'dom'
  | 'error'
  | 'other'

export interface BaseTraceEvent {
  id: string
  parentId: string | null
  executionId: string | null
  type: TraceEventType
  category: TraceCategory
  timestamp: number
}

export interface FunctionStartEvent extends BaseTraceEvent {
  type: 'FUNCTION_START'
  functionName: string
  fileName: string | null
  lineNumber: number | null
}

export interface FunctionEndEvent extends BaseTraceEvent {
  type: 'FUNCTION_END'
  duration: number | null
}

export interface EventStartEvent extends BaseTraceEvent {
  type: 'EVENT_START'
  eventName: string
}

export interface FetchStartEvent extends BaseTraceEvent {
  type: 'FETCH_START'
  fetchName: string
  args: unknown[]
}

export interface FetchEndEvent extends BaseTraceEvent {
  type: 'FETCH_END'
  fetchName: string
  status: number
  duration: number | null
}

export interface FetchErrorEvent extends BaseTraceEvent {
  type: 'FETCH_ERROR'
  fetchName: string
  error: string
  duration: number | null
}

export interface TimeoutCallbackEvent extends BaseTraceEvent {
  type: 'TIMEOUT_CALLBACK'
}

export interface DomMutationEvent extends BaseTraceEvent {
  type: 'DOM_MUTATION'
  mutationType: string
  mutationCount: number
  targets: string[]
}

export interface ErrorEvent extends BaseTraceEvent {
  type: 'ERROR'
  error: string
}

export interface UnhandledRejectionEvent extends BaseTraceEvent {
  type: 'UNHANDLED_REJECTION'
  reason: string
}

export interface ClearEvent extends BaseTraceEvent {
  type: 'CLEAR'
}

export type TraceEvent =
  | FunctionStartEvent
  | FunctionEndEvent
  | EventStartEvent
  | FetchStartEvent
  | FetchEndEvent
  | FetchErrorEvent
  | TimeoutCallbackEvent
  | DomMutationEvent
  | ErrorEvent
  | UnhandledRejectionEvent
  | ClearEvent
  | (BaseTraceEvent & { [k: string]: unknown })

export interface TracerOptions {
  debug?: boolean
  maxEvents?: number
  onChangeThrottleMs?: number
}

export interface TracerAPI {
  getTraceEvents(): TraceEvent[]
  clearTraceEvents(): void
  subscribeToEvents(cb: (event: TraceEvent) => void): () => void
  getExecutionTree(executionId: string): TraceEvent[]
}
