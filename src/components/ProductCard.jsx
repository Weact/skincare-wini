import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { addMonths, formatDisplayDate, getProductStatus } from '../utils/dateUtils'
import { resizeImage } from '../utils/imageUtils'
import { TAG_COLORS } from '../constants'
import DateInput from './DateInput'

const USAGE_OPTIONS = [
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
]

// Deterministic default colour so the same tag name doesn't jump colours on every add
function defaultTagColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TAG_COLORS[hash % TAG_COLORS.length].key
}

// A tag colour is either a preset key (e.g. "sage") or a custom "#rrggbb" hex
function isPresetColor(color) {
  return TAG_COLORS.some(c => c.key === color)
}

function tagDot(color) {
  return isPresetColor(color) ? TAG_COLORS.find(c => c.key === color).dot : color
}

// A single draggable tag chip in the edit form — reorderable via SortableContext
function SortableTagChip({ tag, colorPickerFor, setColorPickerFor, removeTag, setTagColor, setCustomColorTag, customColorInputRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag.name })

  return (
    <span
      ref={setNodeRef}
      className={`tag-chip tag-chip--removable${isPresetColor(tag.color) ? ` tag-chip--${tag.color}` : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        ...(isPresetColor(tag.color) ? null : { color: tag.color, background: `${tag.color}22` }),
      }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="tag-color-dot"
        style={{ background: tagDot(tag.color) }}
        onPointerDown={e => e.stopPropagation()}
        onClick={() => setColorPickerFor(f => f === tag.name ? null : tag.name)}
        aria-label={`Change colour for ${tag.name}`}
      />
      {tag.name}
      <button
        type="button"
        className="tag-remove"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => removeTag(tag.name)}
        aria-label={`Remove ${tag.name} tag`}
      >
        ✕
      </button>
      {colorPickerFor === tag.name && (
        <div className="tag-color-picker" onPointerDown={e => e.stopPropagation()}>
          {TAG_COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              className={`tag-color-swatch${tag.color === c.key ? ' tag-color-swatch--active' : ''}`}
              style={{ background: c.dot }}
              onClick={() => setTagColor(tag.name, c.key)}
              aria-label={c.key}
            />
          ))}
          <button
            type="button"
            className={`tag-color-swatch tag-color-swatch--custom${!isPresetColor(tag.color) ? ' tag-color-swatch--active' : ''}`}
            onClick={() => { setCustomColorTag(tag.name); customColorInputRef.current?.click() }}
            aria-label="Custom colour"
          >
            +
          </button>
        </div>
      )}
    </span>
  )
}

export default function ProductCard({ product, onUpdate, onDelete, startExpanded, categories = [], allTags = [], dragHandleProps }) {
  const [expanded, setExpanded] = useState(startExpanded)
  const [name, setName] = useState(product.name || '')
  const [suggestion, setSuggestion] = useState(null)
  const [dismissedKey, setDismissedKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [colorPickerFor, setColorPickerFor] = useState(null)
  const [customColorTag, setCustomColorTag] = useState(null)
  const nameRef = useRef(null)
  const debounceRef = useRef(null)
  const confirmTimerRef = useRef(null)
  const photoInputRef = useRef(null)
  const tagsWrapRef = useRef(null)
  const customColorInputRef = useRef(null)

  // Normalise legacy plain-string tags (pre-colour) into { name, color } objects
  const tags = (product.tags || []).map(t =>
    typeof t === 'string' ? { name: t, color: defaultTagColor(t) } : t
  )

  function addTag(raw) {
    const val = raw.trim()
    if (!val || tags.some(t => t.name.toLowerCase() === val.toLowerCase())) {
      setTagInput('')
      return
    }
    onUpdate({ tags: [...tags, { name: val, color: defaultTagColor(val) }] })
    setTagInput('')
  }

  function removeTag(name) {
    onUpdate({ tags: tags.filter(t => t.name !== name) })
    setColorPickerFor(null)
  }

  function setTagColor(name, color) {
    onUpdate({ tags: tags.map(t => t.name === name ? { ...t, color } : t) })
    setColorPickerFor(null)
  }

  // Used by the native colour input while its dialog is open — must NOT close
  // the popover or change colorPickerFor, or the controlled `value` below
  // would snap back to its fallback mid-pick and the native dialog stops
  // reporting further changes.
  function updateCustomTagColor(name, color) {
    onUpdate({ tags: tags.map(t => t.name === name ? { ...t, color } : t) })
  }

  const tagSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function handleTagDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = tags.findIndex(t => t.name === active.id)
    const newIndex = tags.findIndex(t => t.name === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onUpdate({ tags: arrayMove(tags, oldIndex, newIndex) })
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1].name)
    }
  }

  // Close the colour picker popover on outside click
  useEffect(() => {
    function handle(e) {
      if (tagsWrapRef.current && !tagsWrapRef.current.contains(e.target)) {
        setColorPickerFor(null)
        setCustomColorTag(null)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  const customColorTagObj = tags.find(t => t.name === customColorTag)
  const customColorTagValue = customColorTagObj && !isPresetColor(customColorTagObj.color)
    ? customColorTagObj.color
    : '#c8727a'

  const tagSuggestions = allTags
    .filter(t => !tags.some(existing => existing.name.toLowerCase() === t.toLowerCase()))
    .filter(t => t.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 6)

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
      <div className="card-header" onClick={() => setExpanded(e => !e)}>
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
            {tags.length > 0 && (
              <div className="card-tags">
                {tags.map(tag => (
                  <span
                    key={tag.name}
                    className={`tag-chip${isPresetColor(tag.color) ? ` tag-chip--${tag.color}` : ''}`}
                    style={isPresetColor(tag.color) ? undefined : { color: tag.color, background: `${tag.color}22` }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
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
                onChange={e => onUpdate({ categoryId: e.target.value || null })}
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
            <label className="field-label">Tags</label>
            <div className="tags-input-wrap" ref={tagsWrapRef}>
              <DndContext sensors={tagSensors} collisionDetection={closestCenter} onDragEnd={handleTagDragEnd}>
                <SortableContext items={tags.map(t => t.name)} strategy={rectSortingStrategy}>
                  {tags.map(tag => (
                    <SortableTagChip
                      key={tag.name}
                      tag={tag}
                      colorPickerFor={colorPickerFor}
                      setColorPickerFor={setColorPickerFor}
                      removeTag={removeTag}
                      setTagColor={setTagColor}
                      setCustomColorTag={setCustomColorTag}
                      customColorInputRef={customColorInputRef}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <input
                type="text"
                className="tag-input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length ? 'Add tag…' : 'e.g. Travel size, Gift, Holy grail'}
              />
              <input
                ref={customColorInputRef}
                type="color"
                value={customColorTagValue}
                onChange={e => customColorTag && updateCustomTagColor(customColorTag, e.target.value)}
                style={{ display: 'none' }}
              />
            </div>
            {tagSuggestions.length > 0 && (
              <div className="tag-suggestions">
                {tagSuggestions.map(t => (
                  <button
                    key={t}
                    type="button"
                    className="tag-suggestion-chip"
                    onClick={() => addTag(t)}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

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
