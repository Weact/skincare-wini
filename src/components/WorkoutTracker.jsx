import { useState, useEffect } from 'react'
import { todayISO, formatDayHeading, formatMonthYear, formatDisplayDate, formatEventTime } from '../utils/dateUtils'
import { mondayOfWeek, sundayOfWeek } from '../utils/workoutUtils'
import WorkoutForm from './WorkoutForm'
import WorkoutCard from './WorkoutCard'
import DateInput from './DateInput'
import SelectionBar from './SelectionBar'
import DeleteConfirmModal from './DeleteConfirmModal'

// dirLabels spell the order out on the active chip, since bare arrows are
// read two opposite ways; the arrow itself follows the spreadsheet
// convention (↑ = ascending)
const SORT_OPTIONS = [
  { key: 'date',      label: 'Date',      dirLabels: { asc: 'old→new', desc: 'new→old' } },
  { key: 'name',      label: 'Name',      dirLabels: { asc: 'A→Z',     desc: 'Z→A' } },
  { key: 'duration',  label: 'Duration',  dirLabels: { asc: '1→9',     desc: '9→1' } },
  { key: 'calories',  label: 'Calories',  dirLabels: { asc: '1→9',     desc: '9→1' } },
  { key: 'exercises', label: 'Exercises', dirLabels: { asc: '1→9',     desc: '9→1' } },
]

// Natural starting direction per criterion — newest/biggest first for
// numbers and dates, A→Z for names; tapping the active chip flips it
const DEFAULT_DIR = { date: 'desc', name: 'asc', duration: 'desc', calories: 'desc', exercises: 'desc' }

// Group a list of workouts into { date: [workouts] } with a stable
// time-then-created order inside each day
function groupByDay(list) {
  const byDate = {}
  list.forEach(w => {
    ;(byDate[w.date] ??= []).push(w)
  })
  Object.values(byDate).forEach(day =>
    day.sort((a, b) =>
      (a.time || '99:99').localeCompare(b.time || '99:99') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )
  )
  return byDate
}

function DayGroup({ date, workouts, today, highlightWeek, stepsCount, updateWorkout, deleteWorkout, onOpenCalendar, selectMode, selectedIds, onToggleSelect, readOnly }) {
  return (
    <div className="wk-day-group">
      <div className="cal-day-heading wk-day-heading">
        <span>{date === today ? 'Today' : formatDayHeading(date)}</span>
        {stepsCount > 0 && (
          <span className="wk-day-steps">👟 {stepsCount.toLocaleString('en-US')}</span>
        )}
      </div>
      <ul className="wk-day-list">
        {workouts.map(w => (
          <li key={w.id}>
            <WorkoutCard
              workout={w}
              highlight={highlightWeek}
              onUpdate={updates => updateWorkout(w.id, updates)}
              onDelete={() => deleteWorkout(w.id)}
              onOpenCalendar={onOpenCalendar}
              selectMode={selectMode}
              selected={selectedIds?.has(w.id)}
              onToggleSelect={() => onToggleSelect(w.id)}
              readOnly={readOnly}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

// Collapsible month bucket in the past-workouts journal — rendered only for
// months that actually contain workouts. The current month starts expanded;
// older ones start collapsed.
function MonthSection({ monthKey, dates, byDate, today, startOpen, stepsByDate, highlightUntil, updateWorkout, deleteWorkout, onOpenCalendar, selectMode, selectedIds, onToggleSelect, readOnly }) {
  const [collapsed, setCollapsed] = useState(!startOpen)
  const count = dates.reduce((sum, d) => sum + byDate[d].length, 0)
  const [year, month] = [parseInt(monthKey.slice(0, 4)), parseInt(monthKey.slice(5)) - 1]

  return (
    <div className="wk-month-section">
      <button className="cat-header-main wk-month-header" onClick={() => setCollapsed(c => !c)}>
        <span className="cat-name">{formatMonthYear(year, month)}</span>
        <span className="cat-count">{count}</span>
        <span className={`chevron${collapsed ? '' : ' chevron--up'}`}>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {!collapsed && dates.map(date => (
        <DayGroup
          key={date}
          date={date}
          workouts={byDate[date]}
          today={today}
          highlightWeek={highlightUntil ? date <= highlightUntil : false}
          stepsCount={stepsByDate[date]}
          updateWorkout={updateWorkout}
          deleteWorkout={deleteWorkout}
          onOpenCalendar={onOpenCalendar}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

// Main view of workout mode — upcoming (scheduled) workouts on top with the
// current week highlighted, then the past journal under collapsible months.
export default function WorkoutTracker({ workouts, steps = [], logSteps, addWorkout, updateWorkout, deleteWorkout, onLogged, onStepsLogged, onOpenCalendar, readOnly = false }) {
  const [showForm, setShowForm] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const today = todayISO()

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedIds(new Set())
    setShowForm(false)
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
    selectedIds.forEach(id => deleteWorkout(id))
    setSelectedIds(new Set())
    setSelectMode(false)
    setShowDeleteConfirm(false)
  }

  function handleSortClick(key) {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(DEFAULT_DIR[key])
    }
  }

  // Flat comparator for the non-date criteria, chronological tiebreak
  function compareWorkouts(a, b) {
    let r = 0
    if (sortBy === 'name') r = (a.name || '').localeCompare(b.name || '')
    else if (sortBy === 'duration') r = (a.duration || 0) - (b.duration || 0)
    else if (sortBy === 'calories') r = (a.calories || 0) - (b.calories || 0)
    else if (sortBy === 'exercises') r = (a.exercises?.length || 0) - (b.exercises?.length || 0)
    r = r || (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
    return sortDir === 'desc' ? -r : r
  }
  const weekStart = mondayOfWeek(new Date())
  const weekEnd = sundayOfWeek(new Date())
  const currentMonthKey = today.slice(0, 7)

  // Date mode orders both sections by distance from today: the default
  // (desc) shows newest past first AND soonest upcoming first; flipping
  // shows the farthest-from-today ends first. So Upcoming uses the
  // inverse comparator of Past — "near→far" flips to "far→near" together.
  const dateAsc = sortBy === 'date' && sortDir === 'asc'
  const byMonthDir = (a, b) => dateAsc ? a.localeCompare(b) : b.localeCompare(a)
  const byUpcomingDir = (a, b) => dateAsc ? b.localeCompare(a) : a.localeCompare(b)

  // ── Upcoming: strictly future, bucketed by month ──
  const upcoming = workouts.filter(w => w.date > today)
  const upcomingByDate = groupByDay(upcoming)
  const upcomingMonths = {}
  Object.keys(upcomingByDate).forEach(d => {
    ;(upcomingMonths[d.slice(0, 7)] ??= []).push(d)
  })
  const upcomingMonthKeys = Object.keys(upcomingMonths).sort(byUpcomingDir)
  upcomingMonthKeys.forEach(k => upcomingMonths[k].sort(byUpcomingDir))
  // The month closest to today stays the one that starts expanded,
  // whichever end of the list it sorts to
  const soonestUpcomingKey = upcomingMonthKeys.length
    ? [...upcomingMonthKeys].sort()[0]
    : null

  // ── Past journal (incl. today), bucketed by month ──
  const past = workouts.filter(w => w.date <= today)
  const byDate = groupByDay(past)
  const months = {}
  Object.keys(byDate).forEach(d => {
    ;(months[d.slice(0, 7)] ??= []).push(d)
  })
  const monthKeys = Object.keys(months).sort(byMonthDir)
  monthKeys.forEach(k => months[k].sort(byMonthDir))

  // Non-date criteria flatten the journal into one sorted list
  const flatSorted = sortBy !== 'date' ? [...workouts].sort(compareWorkouts) : null

  // Both summaries count completed workouts only (today and earlier),
  // not future scheduled ones
  const thisWeek = past.filter(w => w.date >= weekStart)
  const thisMonth = past.filter(w => w.date.slice(0, 7) === currentMonthKey)

  const stepsByDate = {}
  steps.forEach(s => { stepsByDate[s.date] = s.count })

  function summarize(list, stepDates) {
    return {
      count: list.length,
      minutes: list.reduce((sum, w) => sum + (w.duration || 0), 0),
      calories: list.reduce((sum, w) => sum + (w.calories || 0), 0),
      steps: stepDates.reduce((sum, d) => sum + (stepsByDate[d] || 0), 0),
    }
  }

  const pastStepDates = Object.keys(stepsByDate).filter(d => d <= today)
  const week = summarize(thisWeek, pastStepDates.filter(d => d >= weekStart))
  const month = summarize(thisMonth, pastStepDates.filter(d => d.slice(0, 7) === currentMonthKey))

  // Steps quick logger — defaults to today but can target any past day;
  // the draft stays in sync with whichever date is currently selected
  const [stepsDate, setStepsDate] = useState(today)
  const selectedSteps = stepsByDate[stepsDate] || 0
  const [stepsDraft, setStepsDraft] = useState('')
  useEffect(() => {
    setStepsDraft(selectedSteps ? String(selectedSteps) : '')
  }, [stepsDate, selectedSteps])

  function saveSteps() {
    const val = stepsDraft ? parseInt(stepsDraft) : 0
    logSteps?.(stepsDate, val > 0 ? val : null)
    if (val > 0) onStepsLogged?.()
  }

  function summarySub(s) {
    return [
      s.minutes > 0 ? `${s.minutes} min` : null,
      s.calories > 0 ? `${s.calories} kcal` : null,
      s.steps > 0 ? `${s.steps.toLocaleString('en-US')} steps` : null,
    ].filter(Boolean).join(' · ')
  }

  async function handleAdd(payload) {
    await addWorkout(payload)
    setShowForm(false)
    onLogged?.(payload)
  }

  const selectedItems = workouts
    .filter(w => selectedIds.has(w.id))
    .map(w => ({
      id: w.id,
      label: w.name || 'Unnamed workout',
      sublabel: [formatDisplayDate(w.date), w.time ? formatEventTime(w.time) : null].filter(Boolean).join(' · '),
    }))

  return (
    <>
      {!readOnly && (
        <SelectionBar
          selectMode={selectMode}
          count={selectedIds.size}
          onToggle={toggleSelectMode}
          onDeleteClick={() => setShowDeleteConfirm(true)}
        />
      )}

      {(week.count > 0 || month.count > 0 || week.steps > 0 || month.steps > 0) && (
        <div className="wk-summary-row">
          <div className="wk-summary-tile">
            <span className="wk-summary-title">💪 This week</span>
            <span className="wk-summary-main">
              {week.count} workout{week.count === 1 ? '' : 's'}
            </span>
            {summarySub(week) && <span className="wk-summary-sub">{summarySub(week)}</span>}
          </div>
          <div className="wk-summary-tile">
            <span className="wk-summary-title">🗓️ This month</span>
            <span className="wk-summary-main">
              {month.count} workout{month.count === 1 ? '' : 's'}
            </span>
            {summarySub(month) && <span className="wk-summary-sub">{summarySub(month)}</span>}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="wk-steps-row">
          <span className="wk-steps-label">👟 Steps</span>
          <div className="wk-steps-date">
            <DateInput value={stepsDate} onChange={e => setStepsDate(e.target.value || today)} max={today} />
          </div>
          <input
            type="number"
            min="0"
            className="field-input wk-steps-input"
            value={stepsDraft}
            onChange={e => setStepsDraft(e.target.value)}
            placeholder="8000"
          />
          <button type="button" className="cat-save-btn" onClick={saveSteps}>
            Save
          </button>
        </div>
      )}

      {!readOnly && !selectMode && (showForm ? (
        <div className="wk-form-panel">
          <WorkoutForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      ) : (
        <button className="new-cat-btn" onClick={() => setShowForm(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Log workout
        </button>
      ))}

      {workouts.length > 1 && (
        <div className="cal-sort-row wk-sort-row">
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
          {(sortBy !== 'date' || sortDir !== 'desc') && (
            <button
              type="button"
              className="cal-sort-btn cal-sort-reset"
              onClick={() => { setSortBy('date'); setSortDir('desc') }}
            >
              ✕ Reset
            </button>
          )}
        </div>
      )}

      {workouts.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-icon">🏋️</div>
          <p className="empty-title">No workouts yet</p>
          <p className="empty-text">
            {readOnly ? 'Nothing logged yet' : 'Log your first workout to start your training journal'}
          </p>
        </div>
      ) : flatSorted ? (
        <ul className="wk-day-list wk-flat-list">
          {flatSorted.map(w => (
            <li key={w.id}>
              <WorkoutCard
                workout={w}
                showDate
                onUpdate={updates => updateWorkout(w.id, updates)}
                onDelete={() => deleteWorkout(w.id)}
                onOpenCalendar={onOpenCalendar}
                selectMode={selectMode}
                selected={selectedIds.has(w.id)}
                onToggleSelect={() => toggleSelected(w.id)}
                readOnly={readOnly}
              />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {upcomingMonthKeys.length > 0 && (
            <div className="wk-upcoming-section">
              <div className="wk-section-heading">⏳ Upcoming</div>
              {upcomingMonthKeys.map(monthKey => (
                <MonthSection
                  key={monthKey}
                  monthKey={monthKey}
                  dates={upcomingMonths[monthKey]}
                  byDate={upcomingByDate}
                  today={today}
                  startOpen={monthKey === soonestUpcomingKey}
                  stepsByDate={stepsByDate}
                  highlightUntil={weekEnd}
                  updateWorkout={updateWorkout}
                  deleteWorkout={deleteWorkout}
                  onOpenCalendar={onOpenCalendar}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}

          {monthKeys.length > 0 && (
            <div className="wk-section-heading wk-section-heading--past">📓 Past workouts</div>
          )}

          {monthKeys.map(monthKey => (
            <MonthSection
              key={monthKey}
              monthKey={monthKey}
              dates={months[monthKey]}
              byDate={byDate}
              today={today}
              startOpen={monthKey === currentMonthKey}
              stepsByDate={stepsByDate}
              updateWorkout={updateWorkout}
              deleteWorkout={deleteWorkout}
              onOpenCalendar={onOpenCalendar}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              readOnly={readOnly}
            />
          ))}
        </>
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          items={selectedItems}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
