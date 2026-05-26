import { useState, useEffect, useRef } from 'react'
import { addMonths, formatDisplayDate, getProductStatus } from '../utils/dateUtils'
import DateInput from './DateInput'

const USAGE_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
]

export default function ProductCard({ product, onUpdate, onDelete, startExpanded }) {
  const [expanded, setExpanded] = useState(startExpanded)
  const [name, setName] = useState(product.name || '')
  const [suggestion, setSuggestion] = useState(null)
  const [dismissedKey, setDismissedKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef(null)
  const debounceRef = useRef(null)
  const confirmTimerRef = useRef(null)

  useEffect(() => {
    if (startExpanded && nameRef.current) {
      nameRef.current.focus()
    }
  }, [])

  // Keep local name in sync if product name changes externally
  useEffect(() => {
    setName(product.name || '')
  }, [product.name])

  // Auto-suggest expiration when opening date + usage months are both set
  useEffect(() => {
    if (!product.openingDate || !product.usageMonths) {
      setSuggestion(null)
      return
    }
    const suggested = addMonths(product.openingDate, product.usageMonths)
    const key = `${product.openingDate}+${product.usageMonths}`
    if (suggested !== product.expirationDate && key !== dismissedKey) {
      setSuggestion(suggested)
    } else {
      setSuggestion(null)
    }
  }, [product.openingDate, product.usageMonths, product.expirationDate, dismissedKey])

  function handleNameChange(e) {
    const val = e.target.value
    setName(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onUpdate({ name: val }), 300)
  }

  function handleOpeningDateChange(e) {
    onUpdate({ openingDate: e.target.value || null })
  }

  function handleExpirationDateChange(e) {
    const val = e.target.value || null
    onUpdate({ expirationDate: val })
    // Dismiss suggestion when user manually sets the expiry date
    setDismissedKey(`${product.openingDate}+${product.usageMonths}`)
  }

  function handleUsageMonthsChange(e) {
    const val = e.target.value ? parseInt(e.target.value) : null
    onUpdate({ usageMonths: val })
    // Reset dismissal so suggestion can appear for new usage period
    setDismissedKey(null)
  }

  function applySuggestion() {
    onUpdate({ expirationDate: suggestion })
    setSuggestion(null)
  }

  function dismissSuggestion() {
    setDismissedKey(`${product.openingDate}+${product.usageMonths}`)
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      clearTimeout(confirmTimerRef.current)
      onDelete()
    } else {
      setConfirmDelete(true)
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const status = getProductStatus(product)

  return (
    <div className={`card card--${status.type}`}>
      <div className="card-header" onClick={() => setExpanded(e => !e)}>
        <div className="card-header-left">
          <span className={`status-dot status-dot--${status.type}`} />
          <div className="card-name-block">
            <span className="card-name">
              {name
                ? name
                : <span className="card-name-empty">Unnamed product</span>
              }
            </span>
            {(product.openingDate || product.expirationDate) && (
              <span className="card-dates">
                {product.openingDate && `Opened ${formatDisplayDate(product.openingDate)}`}
                {product.openingDate && product.expirationDate && ' · '}
                {product.expirationDate && `Exp ${formatDisplayDate(product.expirationDate)}`}
              </span>
            )}
          </div>
        </div>
        <div className="card-header-right">
          <span className={`badge badge--${status.type}`}>{status.label}</span>
          <span className={`chevron ${expanded ? 'chevron--up' : ''}`}>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </div>

      {expanded && (
        <div className="card-body">
          <div className="field">
            <label className="field-label">Product name</label>
            <input
              ref={nameRef}
              type="text"
              className="field-input"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Vitamin C Serum"
            />
          </div>

          <div className="field">
            <label className="field-label">Opening date</label>
            <div className="field-hint">Leave empty if the product is still sealed</div>
            <DateInput
              value={product.openingDate}
              onChange={handleOpeningDateChange}
            />
          </div>

          <div className="field">
            <label className="field-label">Use within</label>
            <select
              className="field-input field-select"
              value={product.usageMonths || ''}
              onChange={handleUsageMonthsChange}
            >
              <option value="">Not specified</option>
              {USAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">Expiration date</label>
            <div className="field-hint">Can be set manually or via the suggestion below</div>
            <DateInput
              value={product.expirationDate}
              onChange={handleExpirationDateChange}
            />
          </div>

          {suggestion && (
            <div className="suggestion">
              <div className="suggestion-icon">💡</div>
              <div className="suggestion-content">
                <div className="suggestion-text">
                  Set expiry to <strong>{formatDisplayDate(suggestion)}</strong>?
                </div>
                <div className="suggestion-sub">
                  Based on opening date + {product.usageMonths} months
                </div>
                <div className="suggestion-actions">
                  <button className="suggestion-btn suggestion-btn--apply" onClick={applySuggestion}>
                    Apply
                  </button>
                  <button className="suggestion-btn suggestion-btn--skip" onClick={dismissSuggestion}>
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            className={`delete-btn ${confirmDelete ? 'delete-btn--confirm' : ''}`}
            onClick={handleDeleteClick}
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete product'}
          </button>
        </div>
      )}
    </div>
  )
}
