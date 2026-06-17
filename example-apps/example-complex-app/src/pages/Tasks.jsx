import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/Modal'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }

export function Tasks() {
  const { tasks, projects, addTask, updateTask, deleteTask } = useApp()
  const [modal, setModal] = useState(null)
  const [view, setView] = useState('board')
  const [filterProject, setFilterProject] = useState('all')
  const [form, setForm] = useState({ title: '', project: '', assignee: '', priority: 'medium', status: 'todo' })

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (filterProject !== 'all') list = list.filter((t) => t.project === filterProject)
    return list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [tasks, filterProject])

  const columns = useMemo(() => {
    const colMap = { todo: [], 'in-progress': [], done: [] }
    filtered.forEach((t) => { if (colMap[t.status]) colMap[t.status].push(t) })
    return colMap
  }, [filtered])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.project) return
    addTask(form)
    setForm({ title: '', project: '', assignee: '', priority: 'medium', status: 'todo' })
    setModal(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-desc">{tasks.length} total tasks</p>
        </div>
        <div className="page-header-actions">
          <select className="filter-select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="view-toggle">
            <button className={`view-btn${view === 'board' ? ' active' : ''}`} onClick={() => setView('board')}>{'\u25A6'}</button>
            <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>{'\u2630'}</button>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Task</button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="board">
          {['todo', 'in-progress', 'done'].map((col) => (
            <div key={col} className="board-col">
              <div className="board-col-header">
                <span>{STATUS_LABELS[col]}</span>
                <span className="board-count">{columns[col].length}</span>
              </div>
              <div className="board-cards">
                {columns[col].map((t) => {
                  const proj = projects.find((p) => p.id === t.project)
                  return (
                    <div key={t.id} className={`task-card priority-${t.priority}`}>
                      <div className="task-card-top">
                        <span className="task-priority" style={{ background: t.priority === 'critical' ? '#fb7185' : t.priority === 'high' ? '#fb923c' : t.priority === 'medium' ? '#38bdf8' : '#64748b' }}>{t.priority}</span>
                        <button className="task-delete" onClick={() => deleteTask(t.id)}>{'\u2715'}</button>
                      </div>
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        <span className="task-project">{proj?.name || 'Unknown'}</span>
                        <span className="task-assignee">{'\uD83D\uDC64'} {t.assignee}</span>
                      </div>
                      <div className="task-actions">
                        {t.status !== 'todo' && <button className="task-move" onClick={() => updateTask(t.id, { status: t.status === 'done' ? 'in-progress' : 'todo' })}>{'\u25C0'}</button>}
                        {t.status !== 'done' && <button className="task-move" onClick={() => updateTask(t.id, { status: t.status === 'todo' ? 'in-progress' : 'done' })}>{'\u25B6'}</button>}
                      </div>
                    </div>
                  )
                })}
                {columns[col].length === 0 && <p className="board-empty">No tasks</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="task-table">
          <div className="task-table-header">
            <span>Title</span>
            <span>Project</span>
            <span>Assignee</span>
            <span>Priority</span>
            <span>Status</span>
            <span></span>
          </div>
          {filtered.map((t) => {
            const proj = projects.find((p) => p.id === t.project)
            return (
              <div key={t.id} className="task-table-row">
                <span className="task-table-title">{t.title}</span>
                <span>{proj?.name || 'Unknown'}</span>
                <span>{t.assignee}</span>
                <span><span className="priority-badge" style={{ background: t.priority === 'critical' ? '#fb7185' : t.priority === 'high' ? '#fb923c' : t.priority === 'medium' ? '#38bdf8' : '#64748b' }}>{t.priority}</span></span>
                <span><span className="status-badge" style={{ background: t.status === 'done' ? '#14532d' : t.status === 'in-progress' ? '#1e3a5f' : '#292524', color: t.status === 'done' ? '#34d399' : t.status === 'in-progress' ? '#38bdf8' : '#a8a29e' }}>{STATUS_LABELS[t.status]}</span></span>
                <span><button className="task-table-delete" onClick={() => deleteTask(t.id)}>{'\u2715'}</button></span>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="New Task">
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Task Title</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" />
          <label>Project</label>
          <select required value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}>
            <option value="">Select project...</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label>Assignee</label>
          <input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="Team member name" />
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
