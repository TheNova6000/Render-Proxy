import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'

const AppContext = createContext(null)

const INITIAL_PROJECTS = [
  { id: 'p1', name: 'Frontend Redesign', desc: 'Modernize the UI with new design system', status: 'active', priority: 'high', progress: 65, members: 4, deadline: '2026-07-15' },
  { id: 'p2', name: 'API Gateway', desc: 'Build unified API gateway for microservices', status: 'active', priority: 'critical', progress: 30, members: 3, deadline: '2026-06-30' },
  { id: 'p3', name: 'Mobile App v2', desc: 'React Native rewrite with new features', status: 'planning', priority: 'medium', progress: 10, members: 5, deadline: '2026-09-01' },
  { id: 'p4', name: 'CI/CD Pipeline', desc: 'Automate deployment pipeline', status: 'completed', priority: 'high', progress: 100, members: 2, deadline: '2026-05-01' },
]

const INITIAL_TASKS = [
  { id: 't1', project: 'p1', title: 'Design system colors', status: 'done', assignee: 'Alice', priority: 'high' },
  { id: 't2', project: 'p1', title: 'Component library setup', status: 'in-progress', assignee: 'Bob', priority: 'high' },
  { id: 't3', project: 'p1', title: 'Typography audit', status: 'todo', assignee: 'Alice', priority: 'medium' },
  { id: 't4', project: 'p2', title: 'Rate limiting middleware', status: 'in-progress', assignee: 'Carol', priority: 'critical' },
  { id: 't5', project: 'p2', title: 'Authentication service', status: 'todo', assignee: 'Dave', priority: 'high' },
  { id: 't6', project: 'p2', title: 'API documentation', status: 'todo', assignee: 'Carol', priority: 'medium' },
  { id: 't7', project: 'p3', title: 'Navigation architecture', status: 'in-progress', assignee: 'Eve', priority: 'high' },
  { id: 't8', project: 'p3', title: 'Offline-first sync', status: 'todo', assignee: 'Frank', priority: 'medium' },
  { id: 't9', project: 'p4', title: 'Docker compose setup', status: 'done', assignee: 'Grace', priority: 'high' },
]

const INITIAL_EVENTS = [
  { id: 'e1', date: '2026-06-16', title: 'Sprint planning', type: 'meeting', time: '10:00' },
  { id: 'e2', date: '2026-06-17', title: 'Design review', type: 'review', time: '14:00' },
  { id: 'e3', date: '2026-06-18', title: 'API Gateway demo', type: 'milestone', time: '11:00' },
  { id: 'e4', date: '2026-06-20', title: 'Frontend sync', type: 'meeting', time: '09:30' },
  { id: 'e5', date: '2026-06-22', title: 'Release v2.1', type: 'milestone', time: '17:00' },
]

const ACTIVITIES = [
  { id: 'a1', user: 'Alice', action: 'completed task', target: 'Design system colors', time: '2m ago', project: 'p1' },
  { id: 'a2', user: 'Bob', action: 'started task', target: 'Component library setup', time: '15m ago', project: 'p1' },
  { id: 'a3', user: 'Carol', action: 'updated', target: 'Rate limiting middleware', time: '1h ago', project: 'p2' },
  { id: 'a4', user: 'Dave', action: 'created task', target: 'Authentication service', time: '2h ago', project: 'p2' },
  { id: 'a5', user: 'Eve', action: 'joined project', target: 'Mobile App v2', time: '3h ago', project: 'p3' },
]

export function AppProvider({ children }) {
  const [projects, setProjects] = useState(INITIAL_PROJECTS)
  const [tasks, setTasks] = useState(INITIAL_TASKS)
  const [events, setEvents] = useState(INITIAL_EVENTS)
  const [activities, setActivities] = useState(ACTIVITIES)
  const [toasts, setToasts] = useState([])
  const [settings, setSettings] = useState({
    theme: 'dark',
    notifications: true,
    emailDigest: 'daily',
    timezone: 'UTC',
  })

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString(36)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const addActivity = useCallback((user, action, target, projectId) => {
    const activity = {
      id: `act_${Date.now()}`,
      user, action, target,
      project: projectId,
      time: 'just now',
    }
    setActivities((prev) => [activity, ...prev].slice(0, 20))
  }, [])

  const addProject = useCallback((project) => {
    setProjects((prev) => [...prev, { ...project, id: `p_${Date.now()}` }])
    addActivity('You', 'created project', project.name, project.id)
    addToast(`Project "${project.name}" created`, 'success')
  }, [addActivity, addToast])

  const updateProject = useCallback((id, data) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p))
    addToast('Project updated', 'success')
  }, [addToast])

  const deleteProject = useCallback((id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setTasks((prev) => prev.filter((t) => t.project !== id))
    addToast('Project deleted', 'info')
  }, [addToast])

  const addTask = useCallback((task) => {
    setTasks((prev) => [...prev, { ...task, id: `t_${Date.now()}` }])
    addActivity('You', 'created task', task.title, task.project)
    addToast(`Task "${task.title}" created`, 'success')
  }, [addActivity, addToast])

  const updateTask = useCallback((id, data) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t))
  }, [])

  const deleteTask = useCallback((id) => {
    const task = tasks.find((t) => t.id === id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    if (task) addToast(`Task "${task.title}" deleted`, 'info')
  }, [tasks, addToast])

  const addEvent = useCallback((event) => {
    setEvents((prev) => [...prev, { ...event, id: `e_${Date.now()}` }])
    addToast(`Event "${event.title}" added`, 'success')
  }, [addToast])

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    addToast('Event deleted', 'info')
  }, [addToast])

  const updateSettings = useCallback((data) => {
    setSettings((prev) => ({ ...prev, ...data }))
    addToast('Settings saved', 'success')
  }, [addToast])

  const value = {
    projects, tasks, events, activities, toasts, settings,
    addProject, updateProject, deleteProject,
    addTask, updateTask, deleteTask,
    addEvent, deleteEvent,
    addToast, updateSettings,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
