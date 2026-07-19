import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { todayISO, getMonthGrid, formatMonthYear, formatDayHeading, formatDisplayDate, formatEventTime } from '../utils/dateUtils'
import { POOP_FEELINGS } from '../constants'
import SelectionBar from './SelectionBar'
import DeleteConfirmModal from './DeleteConfirmModal'

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function daysInMonthCount(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// The more logged in a day, the goofier that day's marker gets — bigger,
// wobblier, and glowier the higher the count climbs
function poopTierClass(count) {
  if (count >= 7) return 'poop-dot--7'
  if (count >= 6) return 'poop-dot--6'
  if (count >= 5) return 'poop-dot--5'
  if (count >= 4) return 'poop-dot--4'
  if (count >= 3) return 'poop-dot--3'
  if (count >= 2) return 'poop-dot--2'
  return ''
}

// dirLabels spell the order out on the active chip, since bare arrows are
// read two opposite ways; the arrow itself follows the spreadsheet
// convention (↑ = ascending). Custom has no direction — it's just whatever
// order the entries were last dragged into.
const SORT_OPTIONS = [
  { key: 'time',    label: 'Time',    dirLabels: { asc: 'early→late', desc: 'late→early' } },
  { key: 'feeling', label: 'Feeling', dirLabels: { asc: 'bad→great',  desc: 'great→bad' } },
]

function compareEntries(a, b, sortBy) {
  const byTime = (a.time || '').localeCompare(b.time || '')
  if (sortBy === 'feeling') {
    const rank = f => POOP_FEELINGS.findIndex(x => x.key === f)
    return (rank(a.feeling) - rank(b.feeling)) || byTime
  }
  return byTime
}

// One draggable entry — only mounted while sorted by Custom (and not
// selecting), since that's the only mode where dragging does anything
function SortablePoopEntry({ p, feeling, confirmDeleteId, onDeleteClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="cal-event"
    >
      <span className="product-drag-handle" {...attributes} {...listeners} onClick={e => e.stopPropagation()}>
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
          <circle cx="3.5" cy="3" r="1.5" fill="currentColor"/>
          <circle cx="8.5" cy="3" r="1.5" fill="currentColor"/>
          <circle cx="3.5" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="8.5" cy="8" r="1.5" fill="currentColor"/>
          <circle cx="3.5" cy="13" r="1.5" fill="currentColor"/>
          <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
        </svg>
      </span>
      <span className="cal-event-emoji">{feeling?.icon || '💩'}</span>
      <div className="cal-event-info">
        <span className="cal-event-name">{formatEventTime(p.time) || 'Logged'}</span>
        {feeling && <span className="cal-event-meta">{feeling.label}</span>}
      </div>
      <button
        type="button"
        className={`cal-event-delete${confirmDeleteId === p.id ? ' cal-event-delete--confirm' : ''}`}
        onClick={() => onDeleteClick(p.id)}
        aria-label="Delete entry"
      >
        {confirmDeleteId === p.id ? '✓' : '✕'}
      </button>
    </li>
  )
}

// Poop tracker's entire view IS the calendar — no journal list alongside it
// like the other trackers. Tap a day to see, add, or remove its entries.
export default function PoopTracker({ poops, addPoop, deletePoop, reorderPoops, readOnly = false }) {
  const today = todayISO()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimerRef = useRef(null)
  const [pickingFeeling, setPickingFeeling] = useState(false)
  const [sortBy, setSortBy] = useState('time')
  const [sortDir, setSortDir] = useState('asc')

  // Predicted Custom-sort order, set synchronously on drop and cleared once
  // Firestore confirms it — otherwise the dropped entry would snap back to
  // its old slot for a beat before the round-trip lands (same pattern used
  // for reordering products/categories/types).
  const [liveCustomOrder, setLiveCustomOrder] = useState(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Selection spans days on purpose — flip through the calendar with Select
  // mode on and entries picked on earlier days stay picked
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => () => clearTimeout(confirmTimerRef.current), [])
  useEffect(() => setPickingFeeling(false), [selectedDate])

  // Drop the optimistic Custom-order prediction once Firestore has
  // confirmed the same sequence for that date
  useEffect(() => {
    if (!liveCustomOrder) return
    const confirmed = poops
      .filter(p => p.date === liveCustomOrder.date)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(p => p.id)
    const matches = confirmed.length === liveCustomOrder.ids.length &&
      confirmed.every((id, i) => id === liveCustomOrder.ids[i])
    if (matches) setLiveCustomOrder(null)
  }, [poops])

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedIds(new Set())
    setPickingFeeling(false)
  }

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmBulkDelete() {
    selectedIds.forEach(id => deletePoop(id))
    setSelectedIds(new Set())
    setSelectMode(false)
    setShowDeleteConfirm(false)
  }

  const selectedItems = poops
    .filter(p => selectedIds.has(p.id))
    .map(p => {
      const feeling = POOP_FEELINGS.find(f => f.key === p.feeling)
      return {
        id: p.id,
        label: `${formatEventTime(p.time) || 'Logged'}${feeling ? ` — ${feeling.label}` : ''}`,
        sublabel: formatDisplayDate(p.date),
      }
    })

  const byDate = {}
  poops.forEach(p => { (byDate[p.date] ??= []).push(p) })

  // Average per day for whichever month the calendar is currently showing —
  // through today (not the full month) when that's the current month, since
  // days that haven't happened yet shouldn't drag the average down
  const viewMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthPoops = poops.filter(p => p.date.slice(0, 7) === viewMonthKey)
  const isViewingCurrentMonth = viewMonthKey === today.slice(0, 7)
  const elapsedDaysInViewedMonth = isViewingCurrentMonth
    ? parseInt(today.slice(8), 10)
    : daysInMonthCount(viewYear, viewMonth)
  const monthAverage = monthPoops.length > 0 ? monthPoops.length / elapsedDaysInViewedMonth : null

  const grid = getMonthGrid(viewYear, viewMonth)
  const rawDayEntries = byDate[selectedDate] || []
  const dayEntries = sortBy === 'custom'
    ? (liveCustomOrder && liveCustomOrder.date === selectedDate
        ? liveCustomOrder.ids.map(id => rawDayEntries.find(p => p.id === id)).filter(Boolean)
        : [...rawDayEntries].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    : [...rawDayEntries].sort((a, b) => {
        const result = compareEntries(a, b, sortBy)
        return sortDir === 'desc' ? -result : result
      })

  function handleSortClick(key) {
    if (key === 'custom') {
      setSortBy('custom')
      return
    }
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const ids = dayEntries.map(p => p.id)
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    if (from === -1 || to === -1) return
    const reordered = arrayMove(dayEntries, from, to)
    setLiveCustomOrder({ date: selectedDate, ids: reordered.map(p => p.id) })
    reorderPoops(reordered)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function chooseFeeling(feeling) {
    addPoop({ date: selectedDate, time: nowTime(), feeling })
    setPickingFeeling(false)
  }

  function handleDeleteClick(id) {
    if (confirmDeleteId === id) {
      clearTimeout(confirmTimerRef.current)
      deletePoop(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="poop-tracker">
      {monthAverage !== null && (
        <div className="wk-summary-row poop-summary-row">
          <div className="wk-summary-tile">
            <span className="wk-summary-title">📊 Daily average</span>
            <span className="wk-summary-main">{monthAverage.toFixed(1)} / day</span>
            <span className="wk-summary-sub">
              {monthPoops.length} logged in {formatMonthYear(viewYear, viewMonth)}
            </span>
          </div>
        </div>
      )}

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
          const count = (byDate[dateStr] || []).length
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate
          return (
            <button
              key={dateStr}
              type="button"
              className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}`}
              onClick={() => setSelectedDate(dateStr)}
            >
              {parseInt(dateStr.slice(8), 10)}
              {count > 0 && (
                <>
                  <span className={`poop-dot ${poopTierClass(count)}`}>💩</span>
                  <span className="poop-count-badge">{count}</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-day-section">
        <div className="cal-day-heading-row">
          <div className="cal-day-heading">
            {selectedDate === today ? 'Today' : formatDayHeading(selectedDate)}
          </div>
        </div>

        {(!readOnly || dayEntries.length > 1) && (
          <div className="list-toolbar-row">
            {!readOnly && (
              <SelectionBar
                selectMode={selectMode}
                count={selectedIds.size}
                onToggle={toggleSelectMode}
                onDeleteClick={() => setShowDeleteConfirm(true)}
              />
            )}
            {dayEntries.length > 1 && (
              <div className="cal-sort-row">
                <span className="cal-sort-label">Sort</span>
                {SORT_OPTIONS.map(opt => {
                  const active = sortBy === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`cal-sort-btn${active ? ' cal-sort-btn--active' : ''}`}
                      onClick={() => handleSortClick(opt.key)}
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
                {!readOnly && (
                  <button
                    type="button"
                    className={`cal-sort-btn${sortBy === 'custom' ? ' cal-sort-btn--active' : ''}`}
                    onClick={() => handleSortClick('custom')}
                  >
                    Custom
                  </button>
                )}
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
        )}

        {dayEntries.length === 0 ? (
          <p className="cal-empty">Nothing logged</p>
        ) : sortBy === 'custom' && !selectMode && !readOnly ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dayEntries.map(p => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="cal-event-list">
                {dayEntries.map(p => (
                  <SortablePoopEntry
                    key={p.id}
                    p={p}
                    feeling={POOP_FEELINGS.find(f => f.key === p.feeling)}
                    confirmDeleteId={confirmDeleteId}
                    onDeleteClick={handleDeleteClick}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul className="cal-event-list">
            {dayEntries.map(p => {
              const feeling = POOP_FEELINGS.find(f => f.key === p.feeling)
              return (
                <li
                  key={p.id}
                  className={`cal-event${selectMode && selectedIds.has(p.id) ? ' cal-event--selected' : ''}`}
                  onClick={selectMode ? () => toggleSelected(p.id) : undefined}
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      className="card-select-checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <span className="cal-event-emoji">{feeling?.icon || '💩'}</span>
                  <div className="cal-event-info">
                    <span className="cal-event-name">{formatEventTime(p.time) || 'Logged'}</span>
                    {feeling && <span className="cal-event-meta">{feeling.label}</span>}
                  </div>
                  {!selectMode && !readOnly && (
                    <button
                      type="button"
                      className={`cal-event-delete${confirmDeleteId === p.id ? ' cal-event-delete--confirm' : ''}`}
                      onClick={() => handleDeleteClick(p.id)}
                      aria-label="Delete entry"
                    >
                      {confirmDeleteId === p.id ? '✓' : '✕'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!readOnly && !selectMode && (pickingFeeling ? (
          <div className="field">
            <label className="field-label">How did it feel?</label>
            <div className="cal-tod-row">
              {POOP_FEELINGS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  className="cal-tod-btn"
                  onClick={() => chooseFeeling(f.key)}
                >
                  <span>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cat-cancel-btn cat-cancel-btn--text"
              onClick={() => setPickingFeeling(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="new-cat-btn" onClick={() => setPickingFeeling(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Log 💩
          </button>
        ))}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          items={selectedItems}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
