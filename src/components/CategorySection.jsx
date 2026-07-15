import { useState, useEffect, useRef } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductCard from './ProductCard'
import { CATEGORY_EMOJIS } from '../constants'

function SortableProductItem({ product, onUpdate, onDelete, startExpanded, categories, allTags }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `prod-${product.id}`,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <ProductCard
        product={product}
        onUpdate={onUpdate}
        onDelete={onDelete}
        startExpanded={startExpanded}
        categories={categories}
        allTags={allTags}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  )
}

export default function CategorySection({
  category,           // null = uncategorized section
  products,
  categories,         // all categories, for the product card dropdown
  allTags = [],        // all tags in use, for the product card tag suggestions
  onUpdateProduct,
  onDeleteProduct,
  onUpdateCategory,
  onDeleteCategory,
  newProductId,
  dragHandleProps,    // provided by parent SortableCategory wrapper
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef(null)
  const menuRef = useRef(null)
  const emojiRef = useRef(null)

  const isUncategorized = !category

  // Close menu/emoji on outside click
  useEffect(() => {
    function handle(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  function startEdit() {
    setEditName(category.name)
    setEditEmoji(category.emoji || '')
    setEditing(true)
    setShowMenu(false)
  }

  function saveEdit() {
    if (!editName.trim()) return
    onUpdateCategory(category.id, { name: editName.trim(), emoji: editEmoji })
    setEditing(false)
    setShowEmoji(false)
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      clearTimeout(confirmTimer.current)
      onDeleteCategory(category.id)
    } else {
      setConfirmDelete(true)
      setShowMenu(false)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const productIds = products.map(p => `prod-${p.id}`)

  return (
    <div className={`cat-section${isUncategorized ? ' cat-section--uncategorized' : ''}`}>
      <div className="cat-header">
        {/* Drag handle — only for real categories */}
        {!isUncategorized && dragHandleProps && (
          <span className="cat-drag-handle" {...dragHandleProps}>
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

        {editing ? (
          /* ── Edit mode ── */
          <div className="cat-edit-form" ref={emojiRef}>
            <button className="cat-emoji-btn" onClick={() => setShowEmoji(s => !s)}>
              {editEmoji || '📁'}
            </button>
            {showEmoji && (
              <div className="cat-emoji-picker">
                {CATEGORY_EMOJIS.map(e => (
                  <button
                    key={e}
                    className={`cat-emoji-opt${e === editEmoji ? ' cat-emoji-opt--active' : ''}`}
                    onClick={() => { setEditEmoji(e); setShowEmoji(false) }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <input
              className="cat-name-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
              autoFocus
            />
            <button className="cat-save-btn" onClick={saveEdit}>Save</button>
            <button className="cat-cancel-btn" onClick={() => setEditing(false)}>✕</button>
          </div>
        ) : (
          /* ── Normal mode ── */
          <>
            <button className="cat-header-main" onClick={() => setCollapsed(c => !c)}>
              {!isUncategorized && category.emoji && (
                <span className="cat-emoji">{category.emoji}</span>
              )}
              <span className="cat-name">
                {isUncategorized ? 'Uncategorized' : category.name}
              </span>
              <span className="cat-count">{products.length}</span>
              <span className={`chevron${collapsed ? '' : ' chevron--up'}`}>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>

            {!isUncategorized && (
              <div className="cat-menu-wrap" ref={menuRef}>
                {confirmDelete ? (
                  <button className="cat-confirm-delete-btn" onClick={handleDeleteClick}>
                    Tap to confirm
                  </button>
                ) : (
                  <button className="cat-menu-btn" onClick={() => setShowMenu(s => !s)}>···</button>
                )}
                {showMenu && (
                  <div className="cat-menu">
                    <button onClick={startEdit}>Rename</button>
                    <button className="cat-menu-danger" onClick={handleDeleteClick}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!collapsed && (
        <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
          <ul className="cat-products">
            {products.map(product => (
              <SortableProductItem
                key={product.id}
                product={product}
                onUpdate={updates => onUpdateProduct(product.id, updates)}
                onDelete={() => onDeleteProduct(product.id)}
                startExpanded={product.id === newProductId}
                categories={categories}
                allTags={allTags}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  )
}
