import { useState, useRef, useEffect } from 'react'
import { CATEGORY_EMOJIS } from '../constants'

// Preset grid plus a "+" first cell for typing/pasting any emoji from the
// device's own emoji keyboard (iOS/Android keyboard emoji key, Win+. , or
// Cmd+Ctrl+Space) — not limited to the curated preset list.
export default function EmojiPicker({ value, onSelect }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (showCustom) inputRef.current?.focus()
  }, [showCustom])

  function submitCustom() {
    const val = customValue.trim()
    if (val) onSelect(val)
    setCustomValue('')
    setShowCustom(false)
  }

  const isCustomActive = !!value && !CATEGORY_EMOJIS.includes(value)

  return (
    <div className="cat-emoji-picker">
      <button
        type="button"
        className={`cat-emoji-opt cat-emoji-opt--custom${isCustomActive ? ' cat-emoji-opt--active' : ''}`}
        onClick={() => setShowCustom(s => !s)}
        aria-label="Enter your own emoji"
      >
        {isCustomActive ? value : '+'}
      </button>
      {CATEGORY_EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          className={`cat-emoji-opt${e === value ? ' cat-emoji-opt--active' : ''}`}
          onClick={() => onSelect(e)}
        >
          {e}
        </button>
      ))}
      {showCustom && (
        <div className="cat-emoji-custom-row">
          <input
            ref={inputRef}
            type="text"
            className="cat-emoji-custom-input"
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitCustom() } }}
            onBlur={submitCustom}
            placeholder="Type or paste your own emoji"
            maxLength={8}
          />
        </div>
      )}
    </div>
  )
}
