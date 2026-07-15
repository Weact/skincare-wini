import { useState, useEffect, useRef } from 'react'
import { addMonths, formatDisplayDate, formatEventTime, getProductStatus } from '../utils/dateUtils'
import { resizeImage } from '../utils/imageUtils'
import { CATEGORY_EMOJIS, TIME_OF_DAY } from '../constants'
import DateInput from './DateInput'

const USAGE_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
]

export default function ProductCard({ product, onUpdate, onDelete, startExpanded, expanded, onToggleExpanded, categories = [], types = [], onCreateType, events = [], onOpenEvent, dragHandleProps }) {
  const [name, setName] = useState(product.name || '')
  const [suggestion, setSuggestion] = useState(null)
  const [dismissedKey, setDismissedKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typeInput, setTypeInput] = useState('')
  const [typeEmoji, setTypeEmoji] = useState('')
  const [showTypeEmojiPicker, setShowTypeEmojiPicker] = useState(false)
  const nameRef = useRef(null)
  const debounceRef = useRef(null)
  const confirmTimerRef = useRef(null)
  const photoInputRef = useRef(null)
  const typeEmojiRef = useRef(null)

  const typesForCategory = types.filter(t => t.categoryId === product.categoryId)
  const currentType = types.find(t => t.id === product.typeId)

  const typeSuggestions = typesForCategory
    .filter(t => t.id !== product.typeId)
    .filter(t => t.name.toLowerCase().includes(typeInput.toLowerCase()))
    .slice(0, 6)

  const linkedEvents = events
    .filter(e => e.productId === product.id)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))

  // Close the type-creation emoji picker on outside click
  useEffect(() => {
    function handle(e) {
      if (typeEmojiRef.current && !typeEmojiRef.current.contains(e.target)) setShowTypeEmojiPicker(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  async function submitType(raw) {
    const val = raw.trim()
    if (!val) return
    const existing = typesForCategory.find(t => t.name.toLowerCase() === val.toLowerCase())
    if (existing) {
      onUpdate({ typeId: existing.id })
    } else if (onCreateType) {
      const newId = await onCreateType(val, typeEmoji, product.categoryId)
      onUpdate({ typeId: newId })
    }
    setTypeInput('')
    setTypeEmoji('')
    setShowTypeEmojiPicker(false)
  }

  function selectExistingType(type) {
    onUpdate({ typeId: type.id })
    setTypeInput('')
    setTypeEmoji('')
    setShowTypeEmojiPicker(false)
  }

  function handleTypeKeyDown(e) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    submitType(typeInput)
  }

  function clearType() {
    onUpdate({ typeId: null })
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const photo = await resizeImage(file)
    onUpdate({ photo })
  }

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
      <div className="card-header" onClick={onToggleExpanded}>
        {dragHandleProps && (
          <span className="product-drag-handle" {...dragHandleProps} onClick={e => e.stopPropagation()}>
            <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
              <circle cx="3.5" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="3" r="1.5" fill="currentColor"/>
              <circle cx="3.5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="3.5" cy="13" r="1.5" fill="currentColor"/>
              <circle cx="8.5" cy="13" r="1.5" fill="currentColor"/>
            </svg>
          </span>
        )}
        {product.photo && (
          <img src={product.photo} className="card-thumb" alt="" />
        )}
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
          {linkedEvents.length > 0 && (
            <span className="card-linked-icon" title="Has a linked calendar event">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 9.5h18" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          )}
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
            <label className="field-label">Photo</label>
            {product.photo ? (
              <div className="photo-preview">
                <img src={product.photo} className="photo-img" alt="Product" />
                <div className="photo-actions">
                  <button className="photo-btn" onClick={() => photoInputRef.current.click()}>
                    Change photo
                  </button>
                  <button className="photo-btn photo-btn--remove" onClick={() => onUpdate({ photo: null })}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button className="add-photo-btn" onClick={() => photoInputRef.current.click()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
                Add photo
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          {categories.length > 0 && (
            <div className="field">
              <label className="field-label">Category</label>
              <select
                className="field-input field-select"
                value={product.categoryId || ''}
                onChange={e => onUpdate({ categoryId: e.target.value || null, typeId: null })}
              >
                <option value="">Uncategorized</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Type</label>
            {!product.categoryId ? (
              <p className="field-hint">Choose a category above to set a type</p>
            ) : currentType ? (
              <div className="type-current">
                <span className="type-current-chip">
                  {currentType.emoji ? `${currentType.emoji} ` : ''}{currentType.name}
                </span>
                <button
                  type="button"
                  className="type-current-remove"
                  onClick={clearType}
                  aria-label="Clear type"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className="cat-edit-form" ref={typeEmojiRef}>
                  <button
                    type="button"
                    className="cat-emoji-btn"
                    onClick={() => setShowTypeEmojiPicker(s => !s)}
                  >
                    {typeEmoji || '🏷️'}
                  </button>
                  {showTypeEmojiPicker && (
                    <div className="cat-emoji-picker">
                      {CATEGORY_EMOJIS.map(e => (
                        <button
                          key={e}
                          type="button"
                          className={`cat-emoji-opt${e === typeEmoji ? ' cat-emoji-opt--active' : ''}`}
                          onClick={() => { setTypeEmoji(e); setShowTypeEmojiPicker(false) }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    className="field-input"
                    value={typeInput}
                    onChange={e => setTypeInput(e.target.value)}
                    onKeyDown={handleTypeKeyDown}
                    placeholder="Select or create a type…"
                  />
                </div>
                {typeSuggestions.length > 0 && (
                  <div className="type-suggestions">
                    {typeSuggestions.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="type-suggestion-chip"
                        onClick={() => selectExistingType(t)}
                      >
                        {t.emoji ? `${t.emoji} ` : ''}{t.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {linkedEvents.length > 0 && (
            <div className="field">
              <label className="field-label">Linked dates</label>
              <ul className="linked-dates-list">
                {linkedEvents.map(ev => {
                  const tod = TIME_OF_DAY.find(t => t.key === ev.timeOfDay)
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className="linked-date"
                        onClick={() => onOpenEvent?.(ev)}
                      >
                        <span className="linked-date-emoji">{ev.emoji || '📅'}</span>
                        <div className="linked-date-info">
                          <span className="linked-date-name">{ev.name}</span>
                          <span className="linked-date-meta">
                            {[
                              formatDisplayDate(ev.date),
                              tod ? `${tod.icon} ${tod.label}` : null,
                              ev.time ? formatEventTime(ev.time) : null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="linked-date-chevron">
                          <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

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
