import React, { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { StatCard } from '../components/StatCard'
import { useFetchProjects } from '../utils/api'

export function Dashboard() {
  const { projects, tasks, activities, events } = useApp()
  const { data: users, loading: usersLoading } = useFetchProjects()

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active').length
    const done = tasks.filter((t) => t.status === 'done').length
    const todo = tasks.filter((t) => t.status === 'todo').length
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length
    const highPriority = projects.filter((p) => p.priority === 'critical' || p.priority === 'high').length
    const avgProgress = Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    return { active, done, todo, inProgress, highPriority, avgProgress }
  }, [projects, tasks])

  const upcomingEvents = useMemo(() => {
    const today = new Date()
    return events
      .filter((e) => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 4)
  }, [events])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-desc">Overview of your projects and activity</p>
        </div>
        <div className="page-time">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="stats-grid">
        <StatCard title="Active Projects" value={stats.active} icon={'\uD83D\uDCC1'} trend={12} color="var(--accent-blue)" />
        <StatCard title="Tasks Completed" value={stats.done} icon={'\u2705'} trend={8} color="var(--accent-emerald)" />
        <StatCard title="In Progress" value={stats.inProgress} icon={'\uD83D\uDD04'} trend={-3} color="var(--accent-amber)" />
        <StatCard title="Avg Progress" value={`${stats.avgProgress}%`} icon={'\uD83D\uDCCA'} trend={5} color="var(--accent-purple)" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-list">
            {activities.slice(0, 6).map((a) => (
              <div key={a.id} className="activity-item">
                <div className="activity-avatar">{a.user[0]}</div>
                <div className="activity-body">
                  <p><strong>{a.user}</strong> {a.action} <em>{a.target}</em></p>
                  <span className="activity-time">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Upcoming Events</h2>
          </div>
          <div className="events-list">
            {upcomingEvents.length > 0 ? upcomingEvents.map((e) => (
              <div key={e.id} className={`event-item event-${e.type}`}>
                <div className="event-date-box">
                  <span className="event-date-month">{new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className="event-date-day">{new Date(e.date).getDate()}</span>
                </div>
                <div className="event-info">
                  <span className="event-title">{e.title}</span>
                  <span className="event-meta">{e.time} \u00B7 {e.type}</span>
                </div>
              </div>
            )) : <p className="empty-text">No upcoming events</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
