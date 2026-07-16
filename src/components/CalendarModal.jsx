import { useState, useRef, useEffect } from 'react'
import { HOURS, MINUTES, TIME_OF_DAY } from '../constants'
import { todayISO, getMonthGrid, formatMonthYear, formatDayHeading, formatEventTime, getProductStatus } from '../utils/dateUtils'
import EmojiPicker from './EmojiPicker'

// dirLabels spell the order out on the active chip, since bare arrows are
// read two opposite ways; the arrow itself follows the spreadsheet
// convention (↑ = ascending)
const SORT_OPTIONS = [
  { key: 'time',     label: 'Time',     dirLabels: { asc: 'early→late', desc: 'late→early' } },
  { key: 'name',     label: 'Name',     dirLabels: { asc: 'A→Z',        desc: 'Z→A' } },
  { key: 'duration', label: 'Duration', dirLabels: { asc: '1→9',        desc: '9→1' } },
]

// Each mode falls back to time as a stable tiebreaker (except time itself,
// which falls back to name) so equal-ranked events don't jump around
// unpredictably between renders.
function compareEvents(a, b, sortBy) {
  const byTime = (a.time || '99:99').localeCompare(b.time || '99:99')
  const byName = (a.name || '').localeCompare(b.name || '')
  const byDuration = (a.duration ?? Infinity) - (b.duration ?? Infinity)

  if (sortBy === 'name') return byName || byTime
  if (sortBy === 'duration') return byDuration || byTime
  return byTime || byName
}

export default function CalendarModal({ events, products = [], categories = [], types = [], addEvent, updateEvent, deleteEvent, jumpTo, onClose }) {
  const today = todayISO()
  const now = new Date()
  const jumpDate = jumpTo?.date ? new Date(jumpTo.date + 'T00:00:00') : null
  const [viewYear, setViewYear] = useState(() => jumpDate ? jumpDate.getFullYear() : now.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => jumpDate ? jumpDate.getMonth() : now.getMonth())
  const [selectedDate, setSelectedDate] = useState(() => jumpTo?.date || today)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [duration, setDuration] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [time, setTime] = useState('')
  const [timeHour, timeMinute] = time ? time.split(':') : ['', '']

  function handleHourChange(e) {
    const h = e.target.value
    setTime(h ? `${h}:${timeMinute || '00'}` : '')
  }

  function handleMinuteChange(e) {
    const m = e.target.value
    setTime(m ? `${timeHour || '00'}:${m}` : '')
  }

  const [productId, setProductId] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterTypeId, setFilterTypeId] = useState('')
  const [hideExpired, setHideExpired] = useState(false)
  const [sortBy, setSortBy] = useState('time')
  const [sortDir, setSortDir] = useState('asc')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimerRef = useRef(null)
  const emojiRef = useRef(null)

  const sortedProducts = [...products].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  )

  const filterTypes = types.filter(t => t.categoryId === filterCategoryId)

  // Always keep the currently-selected product visible even if it wouldn't
  // otherwise pass the filters, so picking a filter never silently clears
  // an existing selection out from under the user.
  const filteredProducts = sortedProducts.filter(p => {
    if (p.id === productId) return true
    if (filterCategoryId && (p.categoryId || '') !== filterCategoryId) return false
    if (filterTypeId && (p.typeId || '') !== filterTypeId) return false
    if (hideExpired && getProductStatus(p).type === 'expired') return false
    return true
  })

  useEffect(() => {
    function handle(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])

  // Opened via a product's "Linked dates" link — open that event for editing.
  // Mount-only: the modal is fully unmounted/remounted each time it's shown
  // (App.jsx conditionally renders it), so this only ever runs once per open.
  useEffect(() => {
    if (jumpTo?.eventId) {
      const ev = events.find(e => e.id === jumpTo.eventId)
      if (ev) openEditForm(ev)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const eventsByDate = {}
  events.forEach(e => {
    ;(eventsByDate[e.date] ??= []).push(e)
  })
  Object.values(eventsByDate).forEach(list =>
    list.sort((a, b) => {
      const result = compareEvents(a, b, sortBy)
      return sortDir === 'desc' ? -result : result
    })
  )

  const grid = getMonthGrid(viewYear, viewMonth)
  const dayEvents = eventsByDate[selectedDate] || []

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(dateStr) {
    setSelectedDate(dateStr)
    setShowForm(false)
    setEditingId(null)
  }

  function resetForm() {
    setName('')
    setEmoji('')
    setDuration('')
    setTimeOfDay('')
    setTime('')
    setProductId('')
    setShowEmojiPicker(false)
  }

  function openNewForm() {
    resetForm()
    setEditingId(null)
    setShowForm(true)
  }

  function openEditForm(ev) {
    setName(ev.name || '')
    setEmoji(ev.emoji || '')
    setDuration(ev.duration ? String(ev.duration) : '')
    setTimeOfDay(ev.timeOfDay || '')
    setTime(ev.time || '')
    setProductId(ev.productId || '')
    setEditingId(ev.id)
    setShowForm(true)
  }

  function submitForm() {
    if (!name.trim()) return
    const payload = {
      name: name.trim(),
      emoji,
      date: selectedDate,
      duration: duration ? parseInt(duration) : null,
      timeOfDay: timeOfDay || null,
      time: time || null,
      productId: productId || null,
    }
    if (editingId) {
      updateEvent(editingId, payload)
    } else {
      addEvent(payload)
    }
    resetForm()
    setShowForm(false)
    setEditingId(null)
  }

  function handleDeleteClick(id) {
    if (confirmDeleteId === id) {
      clearTimeout(confirmTimerRef.current)
      deleteEvent(id)
      setConfirmDeleteId(null)
      if (editingId === id) {
        setShowForm(false)
        setEditingId(null)
        resetForm()
      }
    } else {
      setConfirmDeleteId(id)
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet modal-sheet--calendar" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Routine Calendar</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                <path d="M7 1L2 6l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="cal-month-label">{formatMonthYear(viewYear, viewMonth)}</span>
            <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="cal-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d}>{d}</span>)}
          </div>

          <div className="cal-grid">
            {grid.map((dateStr, i) => {
              if (!dateStr) return <span key={`empty-${i}`} className="cal-cell cal-cell--empty" />
              const count = (eventsByDate[dateStr] || []).length
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}`}
                  onClick={() => selectDay(dateStr)}
                >
                  {parseInt(dateStr.slice(8), 10)}
                  {count > 0 && <span className="cal-dot" />}
                </button>
              )
            })}
          </div>

          <div className="cal-day-section">
            <div className="cal-day-heading-row">
              <div className="cal-day-heading">
                {selectedDate === today ? 'Today' : formatDayHeading(selectedDate)}
              </div>
              {dayEvents.length > 1 && (
                <div className="cal-sort-row">
                  <span className="cal-sort-label">Sort</span>
                  {SORT_OPTIONS.map(opt => {
                    const active = sortBy === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className={`cal-sort-btn${active ? ' cal-sort-btn--active' : ''}`}
                        onClick={() => {
                          if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                          else { setSortBy(opt.key); setSortDir('asc') }
                        }}
                      >
                        {opt.label}
                        {active && (
                          <span className="cal-sort-arrow">
                            {sortDir === 'asc' ? '↑' : '↓'} {opt.dirLabels[sortDir]}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {(sortBy !== 'time' || sortDir !== 'asc') && (
                    <button
                      type="button"
                      className="cal-sort-btn cal-sort-reset"
                      onClick={() => { setSortBy('time'); setSortDir('asc') }}
                    >
                      ✕ Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {dayEvents.length === 0 && !showForm && (
              <p className="cal-empty">No events scheduled</p>
            )}

            {dayEvents.length > 0 && (
              <ul className="cal-event-list">
                {dayEvents.map(ev => {
                  const tod = TIME_OF_DAY.find(t => t.key === ev.timeOfDay)
                  const linkedProduct = ev.productId ? products.find(p => p.id === ev.productId) : null
                  return (
                    <li key={ev.id} className="cal-event" onClick={() => openEditForm(ev)}>
                      <span className="cal-event-emoji">{ev.emoji || '🧴'}</span>
                      <div className="cal-event-info">
                        <span className="cal-event-name">{ev.name}</span>
                        <span className="cal-event-meta">
                          {[
                            tod ? `${tod.icon} ${tod.label}` : null,
                            ev.time ? formatEventTime(ev.time) : null,
                            ev.duration ? `${ev.duration} min` : null,
                          ].filter(Boolean).join(' · ')}
                        </span>
                        {linkedProduct && (
                          <span className="cal-event-product">
                            🔗 {linkedProduct.name || 'Unnamed product'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`cal-event-delete${confirmDeleteId === ev.id ? ' cal-event-delete--confirm' : ''}`}
                        onClick={e => { e.stopPropagation(); handleDeleteClick(ev.id) }}
                        aria-label={`Delete ${ev.name}`}
                      >
                        {confirmDeleteId === ev.id ? '✓' : '✕'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {showForm ? (
              <div className="cal-event-form">
                <div className="cal-event-form-row" ref={emojiRef}>
                  <button type="button" className="cat-emoji-btn" onClick={() => setShowEmojiPicker(s => !s)}>
                    {emoji || '🧴'}
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      value={emoji}
                      onSelect={e => { setEmoji(e); setShowEmojiPicker(false) }}
                    />
                  )}
                  <input
                    type="text"
                    className="field-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Event name — e.g. Clay mask"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label className="field-label">Time of day</label>
                  <div className="cal-tod-row">
                    {TIME_OF_DAY.map(t => (
                      <button
                        key={t.key}
                        type="button"
                        className={`cal-tod-btn${timeOfDay === t.key ? ' cal-tod-btn--active' : ''}`}
                        onClick={() => setTimeOfDay(v => v === t.key ? '' : t.key)}
                      >
                        <span>{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sortedProducts.length > 0 && (
                  <div className="field">
                    <label className="field-label">Product</label>

                    {categories.length > 0 && (
                      <div className="cal-product-filters">
                        <select
                          className="field-input field-select"
                          value={filterCategoryId}
                          onChange={e => { setFilterCategoryId(e.target.value); setFilterTypeId('') }}
                        >
                          <option value="">All categories</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                            </option>
                          ))}
                        </select>
                        {filterCategoryId && filterTypes.length > 0 && (
                          <select
                            className="field-input field-select"
                            value={filterTypeId}
                            onChange={e => setFilterTypeId(e.target.value)}
                          >
                            <option value="">All types</option>
                            {filterTypes.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.emoji ? `${t.emoji} ` : ''}{t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <label className="cal-hide-expired">
                      <input
                        type="checkbox"
                        checked={hideExpired}
                        onChange={e => setHideExpired(e.target.checked)}
                      />
                      Hide expired products
                    </label>

                    <select
                      className="field-input field-select"
                      value={productId}
                      onChange={e => setProductId(e.target.value)}
                    >
                      <option value="">No product</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name || 'Unnamed product'}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="cal-form-grid">
                  <div className="field">
                    <label className="field-label">Precise time (24h)</label>
                    <div className="cal-time-select-row">
                      <select
                        className="field-input field-select"
                        value={timeHour}
                        onChange={handleHourChange}
                      >
                        <option value="">--</option>
                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="cal-time-colon">:</span>
                      <select
                        className="field-input field-select"
                        value={timeMinute}
                        onChange={handleMinuteChange}
                      >
                        <option value="">--</option>
                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Duration</label>
                    <div className="cal-duration-input">
                      <input
                        type="number"
                        min="1"
                        className="field-input"
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                        placeholder="10"
                      />
                      <span className="cal-duration-suffix">min</span>
                    </div>
                  </div>
                </div>

                <div className="cal-event-form-actions">
                  <button
                    type="button"
                    className="cat-cancel-btn"
                    onClick={() => { setShowForm(false); setEditingId(null); resetForm() }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="cat-save-btn" onClick={submitForm}>
                    {editingId ? 'Save' : 'Add event'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="new-cat-btn" onClick={openNewForm}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Add event
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
