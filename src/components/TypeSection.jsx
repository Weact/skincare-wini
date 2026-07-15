import { useState, useEffect, useRef } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import ProductCard from './ProductCard'
import { CATEGORY_EMOJIS } from '../constants'

function SortableProductItem({ product, onUpdate, onDelete, startExpanded, categories, types, allTags }) {
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
        types={types}
        allTags={allTags}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  )
}

// A type is a sub-category, scoped to one category. Unlike categories/products,
// types aren't drag-reorderable themselves — only their products are — so this
// uses useDroppable (a plain drop target) rather than useSortable.
export default function TypeSection({
  type,
  products,
  categories,
  types,
  allTags,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateType,
  onDeleteType,
  newProductId,
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

  const { setNodeRef: setDropRef } = useDroppable({ id: `type-${type.id}` })

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
    setEditName(type.name)
    setEditEmoji(type.emoji || '')
    setEditing(true)
    setShowMenu(false)
  }

  function saveEdit() {
    if (!editName.trim()) return
    onUpdateType(type.id, { name: editName.trim(), emoji: editEmoji })
    setEditing(false)
    setShowEmoji(false)
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      clearTimeout(confirmTimer.current)
      onDeleteType(type.id)
    } else {
      setConfirmDelete(true)
      setShowMenu(false)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const productIds = products.map(p => `prod-${p.id}`)

  return (
    <div className="type-section" ref={setDropRef}>
      <div className="type-header">
        {editing ? (
          <div className="cat-edit-form" ref={emojiRef}>
            <button className="cat-emoji-btn" onClick={() => setShowEmoji(s => !s)}>
              {editEmoji || '🏷️'}
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
          <>
            <button className="type-header-main" onClick={() => setCollapsed(c => !c)}>
              {type.emoji && <span className="cat-emoji">{type.emoji}</span>}
              <span className="type-name">{type.name}</span>
              <span className="cat-count">{products.length}</span>
              <span className={`chevron${collapsed ? '' : ' chevron--up'}`}>
                <svg width="10" height="7" viewBox="0 0 12 8" fill="none">
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>

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
          </>
        )}
      </div>

      {!collapsed && (
        <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
          <ul className="type-products">
            {products.map(product => (
              <SortableProductItem
                key={product.id}
                product={product}
                onUpdate={updates => onUpdateProduct(product.id, updates)}
                onDelete={() => onDeleteProduct(product.id)}
                startExpanded={product.id === newProductId}
                categories={categories}
                types={types}
                allTags={allTags}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </div>
  )
}
