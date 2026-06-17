import React, { useState, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/Modal'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TYPE_COLORS = { meeting: '#6366f1', review: '#34d399', milestone: '#fb923c' }

export function Calendar() {
  const { events, addEvent, deleteEvent } = useApp()
  const [modal, setModal] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [form, setForm] = useState({ title: '', type: 'meeting', time: '12:00' })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [firstDay, daysInMonth])

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }

  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  function handleDayClick(day) {
    if (!day) return
    setSelectedDate(dateStr(day))
    setForm({ title: '', type: 'meeting', time: '12:00' })
    setModal('add')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !selectedDate) return
    addEvent({ ...form, date: selectedDate })
    setModal(null)
  }

  const dayEvents = useCallback((day) => {
    if (!day) return []
    return events.filter((e) => e.date === dateStr(day))
  }, [events, year, month])

  const today = new Date()
  const todayStr = dateStr(today.getDate())

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="page-desc">{MONTHS[month]} {year}</p>
        </div>
        <div className="calendar-nav">
          <button className="btn" onClick={prevMonth}>{'\u25C0'}</button>
          <button className="btn" onClick={() => setViewDate(new Date())}>Today</button>
          <button className="btn" onClick={nextMonth}>{'\u25B6'}</button>
        </div>
      </div>

      <div className="card">
        <div className="calendar-grid">
          {DAYS.map((d) => <div key={d} className="calendar-day-header">{d}</div>)}
          {calendarDays.map((day, i) => {
            const evs = dayEvents(day)
            const isToday = day && dateStr(day) === todayStr
            return (
              <div key={i} className={`calendar-cell${day ? ' has-day' : ''}${isToday ? ' today' : ''}`} onClick={() => handleDayClick(day)}>
                {day && <span className="calendar-day">{day}</span>}
                <div className="calendar-events">
                  {evs.slice(0, 2).map((e) => (
                    <div key={e.id} className="cal-event-dot" style={{ background: TYPE_COLORS[e.type] || '#64748b' }} title={e.title} />
                  ))}
                  {evs.length > 2 && <span className="cal-event-more">+{evs.length - 2}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-header"><h2>All Events</h2></div>
        <div className="events-list">
          {events.length > 0 ? events.sort((a, b) => new Date(a.date) - new Date(b.date)).map((e) => (
            <div key={e.id} className={`event-item event-${e.type}`}>
              <div className="event-date-box">
                <span className="event-date-month">{new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                <span className="event-date-day">{new Date(e.date).getDate()}</span>
              </div>
              <div className="event-info">
                <span className="event-title">{e.title}</span>
                <span className="event-meta">{e.time} \u00B7 {e.type}</span>
              </div>
              <button className="event-delete" onClick={() => deleteEvent(e.id)}>{'\u2715'}</button>
            </div>
          )) : <p className="empty-text">No events</p>}
        </div>
      </div>

      <Modal open={modal === 'add'} onClose={() => setModal(null)} title={`Add Event - ${selectedDate || ''}`}>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Title</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Event name" />
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="meeting">Meeting</option>
            <option value="review">Review</option>
            <option value="milestone">Milestone</option>
          </select>
          <label>Time</label>
          <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Event</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
