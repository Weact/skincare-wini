import { toISODate } from '../utils/dateUtils'

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

function weekdayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

// Bar graph of one week's daily step counts, opened by tapping the "This
// week" summary tile. Read-only — logging still happens from the steps row.
export default function StepsGraphModal({ weekStart, today, stepsByDate, onClose }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const values = days.map(d => stepsByDate[d] || 0)
  const max = Math.max(1, ...values)
  const elapsedDays = days.filter(d => d <= today).length
  const total = values.reduce((sum, v) => sum + v, 0)
  const avg = elapsedDays > 0 ? Math.round(total / elapsedDays) : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">👟 This week's steps</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="steps-graph-avg">
            <span className="steps-graph-avg-value">{avg.toLocaleString('en-US')}</span>
            <span className="steps-graph-avg-label">avg steps/day this week</span>
          </div>
          <div className="steps-graph-bars">
            {days.map((d, i) => {
              const isToday = d === today
              const isFuture = d > today
              return (
                <div key={d} className={`steps-graph-col${isToday ? ' steps-graph-col--today' : ''}`}>
                  <span className="steps-graph-value">{values[i] > 0 ? values[i].toLocaleString('en-US') : ''}</span>
                  <div className="steps-graph-bar-track">
                    <div
                      className={`steps-graph-bar${isFuture ? ' steps-graph-bar--future' : ''}`}
                      style={{ height: values[i] > 0 ? `${Math.max(4, (values[i] / max) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="steps-graph-day">{weekdayLabel(d)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
