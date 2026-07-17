import { formatDisplayDate } from '../utils/dateUtils'

export default function DateInput({ value, onChange, id, max }) {
  return (
    <div className="date-field">
      <div className="date-display">
        {value
          ? formatDisplayDate(value)
          : <span className="date-placeholder">DD/MM/YYYY</span>
        }
        <svg className="date-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 6.5H15" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 1V4M11 1V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>
      {/* Transparent native input overlaid on top — opens the OS date picker on click */}
      <input
        id={id}
        type="date"
        className="date-native"
        value={value || ''}
        onChange={onChange}
        max={max}
      />
    </div>
  )
}
