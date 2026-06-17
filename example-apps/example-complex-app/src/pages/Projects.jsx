import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/Modal'

const PRIORITY_COLORS = { critical: '#fb7185', high: '#fb923c', medium: '#38bdf8', low: '#64748b' }
const STATUS_COLORS = { active: '#34d399', planning: '#fbbf24', completed: '#64748b' }

export function Projects() {
  const { projects, tasks, addProject, updateProject, deleteProject } = useApp()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', desc: '', priority: 'medium', deadline: '' })

  const filtered = useMemo(() => {
    if (filter === 'all') return projects
    return projects.filter((p) => p.status === filter)
  }, [projects, filter])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    addProject({ ...form, status: 'active', progress: 0, members: 1 })
    setForm({ name: '', desc: '', priority: 'medium', deadline: '' })
    setModal(null)
  }

  const taskCounts = useMemo(() => {
    const counts = {}
    tasks.forEach((t) => {
      if (!counts[t.project]) counts[t.project] = { total: 0, done: 0 }
      counts[t.project].total++
      if (t.status === 'done') counts[t.project].done++
    })
    return counts
  }, [tasks])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-desc">{projects.length} total projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ New Project</button>
      </div>

      <div className="filter-tabs">
        {['all', 'active', 'planning', 'completed'].map((f) => (
          <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="projects-grid">
        {filtered.map((p) => {
          const tc = taskCounts[p.id] || { total: 0, done: 0 }
          return (
            <div key={p.id} className={`project-card priority-${p.priority}`}>
              <div className="project-card-top">
                <span className="project-priority" style={{ background: PRIORITY_COLORS[p.priority] }}>{p.priority}</span>
                <span className="project-status" style={{ background: STATUS_COLORS[p.status], color: '#000' }}>{p.status}</span>
                <button className="project-delete" onClick={() => deleteProject(p.id)} title="Delete">{'\u2715'}</button>
              </div>
              <h3 className="project-name">{p.name}</h3>
              <p className="project-desc">{p.desc}</p>
              <div className="project-meta">
                <span>{'\uD83D\uDC65'} {p.members}</span>
                <span>{'\uD83D\uDCC5'} {p.deadline}</span>
              </div>
              <div className="project-progress">
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${p.progress}%` }} />
                </div>
                <span className="progress-label">{p.progress}%</span>
              </div>
              <div className="project-tasks">
                <span>{tc.done}/{tc.total} tasks</span>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="New Project">
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Project Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Project" />
          <label>Description</label>
          <textarea value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} placeholder="Short description" rows={3} />
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <label>Deadline</label>
          <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
