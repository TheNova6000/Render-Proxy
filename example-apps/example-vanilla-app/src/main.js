import { initTracer, subscribeToEvents, traceStart, traceEnd } from 'render-proxy-tracer'

// ─── Bootstrap tracer ───────────────────────────────────────────────────────
initTracer()

const traceBadge = document.getElementById('trace-badge')
let eventCount = 0
subscribeToEvents(() => {
  eventCount++
  if (traceBadge) traceBadge.textContent = `⬡ ${eventCount} events`
})

// ─── State ──────────────────────────────────────────────────────────────────
let state = {
  tasks: [],
  filter: 'all'
}
let idCounter = 1

const STATUSES = ['todo', 'doing', 'done']

// ─── Storage ─────────────────────────────────────────────────────────────────
function saveToStorage() {
  try {
    localStorage.setItem('taskboard_v1', JSON.stringify({ tasks: state.tasks, idCounter }))
  } catch {
    // storage unavailable — ignore silently
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('taskboard_v1')
    if (!raw) return
    const saved = JSON.parse(raw)
    state.tasks = saved.tasks || []
    idCounter = saved.idCounter || state.tasks.length + 1
  } catch {
    state.tasks = []
  }
}

// ─── Business logic ──────────────────────────────────────────────────────────
function generateId() {
  return `task_${Date.now()}_${idCounter++}`
}

function validateTask(title) {
  const trimmed = title.trim()
  if (!trimmed) return { valid: false, message: 'Task cannot be empty.' }
  if (trimmed.length > 120) return { valid: false, message: 'Task too long (120 chars max).' }
  return { valid: true, value: trimmed }
}

function addTask(title, priority = 'medium') {
  const validation = validateTask(title)
  if (!validation.valid) {
    showError(validation.message)
    return null
  }
  const task = {
    id: generateId(),
    title: validation.value,
    priority,
    status: 'todo',
    createdAt: Date.now()
  }
  state.tasks = [...state.tasks, task]
  saveToStorage()
  renderBoard()
  updateStats()
  return task
}

function moveTask(taskId, direction) {
  const task = findTask(taskId)
  if (!task) return
  const currentIndex = STATUSES.indexOf(task.status)
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= STATUSES.length) return
  task.status = STATUSES[nextIndex]
  saveToStorage()
  renderBoard()
  updateStats()
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((t) => t.id !== taskId)
  saveToStorage()
  renderBoard()
  updateStats()
}

function clearDone() {
  state.tasks = state.tasks.filter((t) => t.status !== 'done')
  saveToStorage()
  renderBoard()
  updateStats()
}

function setFilter(priority) {
  state.filter = priority
  updateFilterChips()
  renderBoard()
}

function findTask(id) {
  return state.tasks.find((t) => t.id === id)
}

function getFilteredTasks() {
  if (state.filter === 'all') return state.tasks
  return state.tasks.filter((t) => t.priority === state.filter)
}

// ─── Rendering ───────────────────────────────────────────────────────────────
const PRIORITY_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' }
const PRIORITY_CLASSES = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }

function buildTaskCard(task) {
  const card = document.createElement('div')
  card.className = `task-card priority-${task.priority}`
  card.setAttribute('data-id', task.id)

  const canMoveLeft = STATUSES.indexOf(task.status) > 0
  const canMoveRight = STATUSES.indexOf(task.status) < STATUSES.length - 1

  card.innerHTML = `
    <div class="task-body">
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-priority ${PRIORITY_CLASSES[task.priority]}">${PRIORITY_LABELS[task.priority]}</span>
    </div>
    <div class="task-actions">
      <button class="task-btn btn-move-left" data-id="${task.id}" title="Move left" ${canMoveLeft ? '' : 'disabled'}>←</button>
      <button class="task-btn btn-move-right" data-id="${task.id}" title="Move right" ${canMoveRight ? '' : 'disabled'}>→</button>
      <button class="task-btn btn-delete" data-id="${task.id}" title="Delete task">✕</button>
    </div>
  `
  return card
}

function renderColumn(status) {
  const list = document.getElementById(`list-${status}`)
  const empty = document.getElementById(`empty-${status}`)
  const countEl = document.getElementById(`count-${status}`)
  if (!list) return

  const filtered = getFilteredTasks()
  const tasks = filtered.filter((t) => t.status === status)

  list.innerHTML = ''
  tasks.forEach((task) => {
    list.appendChild(buildTaskCard(task))
  })

  countEl.textContent = tasks.length
  if (empty) empty.style.display = tasks.length === 0 ? 'block' : 'none'
}

function renderBoard() {
  STATUSES.forEach(renderColumn)
}

function updateStats() {
  const total = state.tasks.length
  const done = state.tasks.filter((t) => t.status === 'done').length
  document.getElementById('stat-total').textContent = `${total} task${total !== 1 ? 's' : ''}`
  document.getElementById('stat-done').textContent = `${done} done`
}

function updateFilterChips() {
  document.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === state.filter)
  })
}

function showError(message) {
  const input = document.getElementById('task-input')
  if (!input) return
  input.classList.add('input-error')
  input.placeholder = message
  setTimeout(() => {
    input.classList.remove('input-error')
    input.placeholder = 'Describe a new task…'
  }, 2000)
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
document.getElementById('btn-add').addEventListener('click', () => {
  const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
  try {
    const input = document.getElementById('task-input')
    const priority = document.getElementById('priority-select').value
    const title = input.value
    const result = addTask(title, priority)
    if (result) input.value = ''
  } finally {
    if (id !== null) traceEnd()
  }
})

document.getElementById('task-input').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  const id = traceStart({ type: 'EVENT_START', eventName: 'onKeyDown' })
  try {
    const priority = document.getElementById('priority-select').value
    const result = addTask(e.target.value, priority)
    if (result) e.target.value = ''
  } finally {
    if (id !== null) traceEnd()
  }
})

document.getElementById('btn-clear-done').addEventListener('click', () => {
  const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
  try { clearDone() } finally { if (id !== null) traceEnd() }
})

document.querySelector('.filter-row').addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip')
  if (!chip) return
  const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
  try { setFilter(chip.dataset.filter) } finally { if (id !== null) traceEnd() }
})

// Delegated click handler for task cards
document.querySelector('.board').addEventListener('click', (e) => {
  const moveLeft = e.target.closest('.btn-move-left')
  const moveRight = e.target.closest('.btn-move-right')
  const deleteBtn = e.target.closest('.btn-delete')

  if (moveLeft) {
    const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
    try { moveTask(moveLeft.dataset.id, -1) } finally { if (id !== null) traceEnd() }
  } else if (moveRight) {
    const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
    try { moveTask(moveRight.dataset.id, 1) } finally { if (id !== null) traceEnd() }
  } else if (deleteBtn) {
    const id = traceStart({ type: 'EVENT_START', eventName: 'onClick' })
    try { deleteTask(deleteBtn.dataset.id) } finally { if (id !== null) traceEnd() }
  }
})

// ─── Init ─────────────────────────────────────────────────────────────────────
loadFromStorage()
renderBoard()
updateStats()
