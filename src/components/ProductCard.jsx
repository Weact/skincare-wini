import { useState, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
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

// A single draggable tag chip in the edit form — reorderable via SortableContext.
// The colour picker itself lives in a shared bottom sheet (see ProductCard), not
// anchored to the chip, so it can never be clipped off-screen on narrow viewports.
function SortableTagChip({ tag, onOpenColorPicker, removeTag }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag.name })

  return (
    <span
      ref={setNodeRef}
      className={`tag-chip tag-chip--removable${isPresetColor(tag.color) ? ` tag-chip--${tag.color}` : ''}${isDragging ? ' tag-chip--dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
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
        onClick={() => onOpenColorPicker(tag.name)}
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
    </span>
  )
}

// Static (non-interactive) preview shown under the pointer while a tag is being dragged
function TagChipPreview({ tag }) {
  return (
    <span
      className={`tag-chip tag-chip--overlay${isPresetColor(tag.color) ? ` tag-chip--${tag.color}` : ''}`}
      style={isPresetColor(tag.color) ? undefined : { color: tag.color, background: `${tag.color}22` }}
    >
      <span className="tag-color-dot" style={{ background: tagDot(tag.color) }} />
      {tag.name}
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
  const [hexDraft, setHexDraft] = useState('')
  const [activeTagId, setActiveTagId] = useState(null)
  const nameRef = useRef(null)
  const debounceRef = useRef(null)
  const confirmTimerRef = useRef(null)
  const photoInputRef = useRef(null)
  const hexInputRef = useRef(null)

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
    closeColorPicker()
  }

  function setTagColor(name, color) {
    onUpdate({ tags: tags.map(t => t.name === name ? { ...t, color } : t) })
    closeColorPicker()
  }

  function closeColorPicker() {
    setColorPickerFor(null)
    setHexDraft('')
  }

  // input[type=color] has no native picker UI on iOS (Safari and Chrome are
  // both WebKit there), so custom colours are entered as plain hex instead —
  // works identically on every platform. Applies live as soon as all 6 hex
  // digits are typed, without closing the sheet, so the user can keep tweaking.
  function handleHexChange(e) {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    setHexDraft(raw)
    if (raw.length === 6 && colorPickerFor) {
      onUpdate({ tags: tags.map(t => t.name === colorPickerFor ? { ...t, color: `#${raw.toLowerCase()}` } : t) })
    }
  }

  // PointerSensor (not Mouse+TouchSensor) so the nested colour-dot/remove
  // buttons' onPointerDown stopPropagation actually works on touch devices —
  // TouchSensor listens for the separate `touchstart` event, which a
  // stopPropagation() on pointerdown never blocks, letting a tap on those
  // buttons get hijacked as a drag attempt on iOS.
  const tagSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleTagDragStart({ active }) {
    setActiveTagId(active.id)
    // Haptic tick on drag pickup — Android Chrome only, iOS Safari/Chrome has
    // no Vibration API at all, so this silently no-ops there.
    if (navigator.vibrate) navigator.vibrate(10)
  }

  function handleTagDragEnd({ active, over }) {
    setActiveTagId(null)
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

  const colorPickerTagObj = tags.find(t => t.name === colorPickerFor)

  // Pre-fill the hex field with the tag's current custom colour when its sheet opens
  useEffect(() => {
    if (colorPickerTagObj && !isPresetColor(colorPickerTagObj.color)) {
      setHexDraft(colorPickerTagObj.color.replace('#', ''))
    } else {
      setHexDraft('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorPickerFor])

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
            <div className="tags-input-wrap">
              <DndContext
                sensors={tagSensors}
                collisionDetection={closestCenter}
                onDragStart={handleTagDragStart}
                onDragEnd={handleTagDragEnd}
                onDragCancel={() => setActiveTagId(null)}
              >
                <SortableContext items={tags.map(t => t.name)} strategy={rectSortingStrategy}>
                  {tags.map(tag => (
                    <SortableTagChip
                      key={tag.name}
                      tag={tag}
                      onOpenColorPicker={setColorPickerFor}
                      removeTag={removeTag}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeTagId && (() => {
                    const draggedTag = tags.find(t => t.name === activeTagId)
                    return draggedTag ? <TagChipPreview tag={draggedTag} /> : null
                  })()}
                </DragOverlay>
              </DndContext>
              <input
                type="text"
                className="tag-input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length ? 'Add tag…' : 'e.g. Travel size, Gift, Holy grail'}
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

          {colorPickerFor && (
            <div className="modal-backdrop" onClick={closeColorPicker}>
              <div className="modal-sheet modal-sheet--tag-color" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Colour for "{colorPickerFor}"</span>
                  <button className="modal-close" onClick={closeColorPicker} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="tag-color-grid">
                    {TAG_COLORS.map(c => (
                      <button
                        key={c.key}
                        type="button"
                        className={`tag-color-swatch${colorPickerTagObj?.color === c.key ? ' tag-color-swatch--active' : ''}`}
                        style={{ background: c.dot }}
                        onClick={() => setTagColor(colorPickerFor, c.key)}
                        aria-label={c.key}
                      />
                    ))}
                    <button
                      type="button"
                      className={`tag-color-swatch tag-color-swatch--custom${colorPickerTagObj && !isPresetColor(colorPickerTagObj.color) ? ' tag-color-swatch--active' : ''}`}
                      onClick={() => hexInputRef.current?.focus()}
                      aria-label="Custom colour"
                    >
                      +
                    </button>
                  </div>
                  <div className="tag-hex-row">
                    <span
                      className="tag-hex-preview"
                      style={{ background: hexDraft.length === 6 ? `#${hexDraft}` : 'transparent' }}
                    />
                    <div className="tag-hex-input-wrap">
                      <span className="tag-hex-prefix">#</span>
                      <input
                        ref={hexInputRef}
                        type="text"
                        inputMode="text"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="tag-hex-input"
                        value={hexDraft}
                        onChange={handleHexChange}
                        placeholder="a1b2c3"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>
              </div>
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
