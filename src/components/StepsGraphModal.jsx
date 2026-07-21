import { useState } from 'react'
import { toISODate, formatDayHeading } from '../utils/dateUtils'

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

function daysInMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function weekdayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function monthDayLabel(dateStr) {
  return String(new Date(dateStr + 'T00:00:00').getDate())
}

// Bar graph of one week's or month's daily step counts, opened by tapping
// the Steps summary tile. Read-only — logging still happens from the steps
// row. `periodStart` is the Monday of the week, or the 1st of the month.
export default function StepsGraphModal({ period, periodStart, today, stepsByDate, onClose }) {
  const [activeIdx, setActiveIdx] = useState(null)
  const count = period === 'month' ? daysInMonth(periodStart) : 7
  const dense = count > 7
  const days = Array.from({ length: count }, (_, i) => addDays(periodStart, i))
  const values = days.map(d => stepsByDate[d] || 0)
  const max = Math.max(1, ...values)
  const elapsedDays = days.filter(d => d <= today).length
  const total = values.reduce((sum, v) => sum + v, 0)
  const avg = elapsedDays > 0 ? Math.round(total / elapsedDays) : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet modal-sheet--steps-graph" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title steps-graph-title">👟 {period === 'month' ? "This month's" : "This week's"} steps</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="steps-graph-avg">
            <span className="steps-graph-avg-value">{avg.toLocaleString('en-US')}</span>
            <span className="steps-graph-avg-label">avg steps/day this {period}</span>
          </div>
          <div className="steps-graph-detail">
            {activeIdx !== null
              ? <><strong>{values[activeIdx].toLocaleString('en-US')}</strong> steps · {formatDayHeading(days[activeIdx])}</>
              : <span className="steps-graph-detail-hint">Tap a bar to see the exact count</span>}
          </div>
          <div className={`steps-graph-bars${dense ? ' steps-graph-bars--dense' : ''}`}>
            {days.map((d, i) => {
              const isToday = d === today
              const isFuture = d > today
              return (
                <button
                  type="button"
                  key={d}
                  className={`steps-graph-col${isToday ? ' steps-graph-col--today' : ''}${activeIdx === i ? ' steps-graph-col--active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(prev => (prev === i ? null : prev))}
                  onFocus={() => setActiveIdx(i)}
                  onClick={() => setActiveIdx(prev => (prev === i ? null : i))}
                >
                  {!dense && (
                    <span className="steps-graph-value">{values[i] > 0 ? values[i].toLocaleString('en-US') : ''}</span>
                  )}
                  <div className="steps-graph-bar-track">
                    <div
                      className={`steps-graph-bar${isFuture ? ' steps-graph-bar--future' : ''}`}
                      style={{ height: values[i] > 0 ? `${Math.max(4, (values[i] / max) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="steps-graph-day">
                    {dense
                      ? (isToday || (i % 5 === 0) ? monthDayLabel(d) : ' ')
                      : weekdayLabel(d)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
