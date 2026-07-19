import { useState, useEffect, useRef } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductCard from './ProductCard'
import TypeSection from './TypeSection'
import EmojiPicker from './EmojiPicker'

function SortableProductItem({ product, onUpdate, onDelete, startExpanded, expanded, onToggleExpanded, categories, types, onCreateType, events, onOpenEvent, selectMode, selected, onToggleSelect }) {
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
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        categories={categories}
        types={types}
        onCreateType={onCreateType}
        events={events}
        onOpenEvent={onOpenEvent}
        dragHandleProps={{ ...attributes, ...listeners }}
        selectMode={selectMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
      />
    </li>
  )
}

// Splits this category's products into per-type buckets, plus __none for
// products with no type. Products arrive already sorted by `order`, so a
// plain filter (no re-sort) preserves relative order within each bucket.
function groupByType(products, types) {
  const groups = {}
  types.forEach(t => { groups[t.id] = [] })
  groups.__none = []
  products.forEach(p => {
    const key = p.typeId && groups[p.typeId] !== undefined ? p.typeId : '__none'
    groups[key].push(p)
  })
  return groups
}

export default function CategorySection({
  category,           // null = uncategorized section
  products,
  categories,         // all categories, for the product card dropdown
  types = [],          // this category's own types (sub-categories)
  onCreateType,        // (name, categoryId) => Promise<newTypeId>, for the product card's inline type creation
  events = [],         // all calendar events, for the product card's linked-dates section
  onOpenEvent,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateType,
  onDeleteType,
  newProductId,
  expandedIds,
  onToggleExpanded,
  dragHandleProps,    // provided by parent SortableCategory wrapper
  selectMode,
  selectedIds,
  onToggleSelect,
  readOnly = false,
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

  const grouped = groupByType(products, types)
  const untyped = grouped.__none || []
  const untypedIds = untyped.map(p => `prod-${p.id}`)
  const typeIds = types.map(t => `type-${t.id}`)

  return (
    <div className={`cat-section${isUncategorized ? ' cat-section--uncategorized' : ''}`}>
      <div className="cat-header">
        {/* Drag handle — only for real categories */}
        {!isUncategorized && dragHandleProps && !readOnly && (
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
              <EmojiPicker
                value={editEmoji}
                onSelect={e => { setEditEmoji(e); setShowEmoji(false) }}
              />
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

            {!isUncategorized && !readOnly && (
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
        <div className="cat-body">
          {!isUncategorized && types.length > 0 && (
            readOnly ? (
              types.map(type => (
                <TypeSection
                  key={type.id}
                  type={type}
                  products={grouped[type.id] || []}
                  categories={categories}
                  types={types}
                  events={events}
                  onOpenEvent={onOpenEvent}
                  newProductId={newProductId}
                  expandedIds={expandedIds}
                  onToggleExpanded={onToggleExpanded}
                  readOnly
                />
              ))
            ) : (
              <SortableContext items={typeIds} strategy={verticalListSortingStrategy}>
                {types.map(type => (
                  <TypeSection
                    key={type.id}
                    type={type}
                    products={grouped[type.id] || []}
                    categories={categories}
                    types={types}
                    onCreateType={onCreateType}
                    events={events}
                    onOpenEvent={onOpenEvent}
                    onUpdateProduct={onUpdateProduct}
                    onDeleteProduct={onDeleteProduct}
                    onUpdateType={onUpdateType}
                    onDeleteType={onDeleteType}
                    newProductId={newProductId}
                    expandedIds={expandedIds}
                    onToggleExpanded={onToggleExpanded}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </SortableContext>
            )
          )}

          {readOnly ? (
            <ul className="cat-products">
              {untyped.map(product => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    expanded={expandedIds.has(product.id)}
                    onToggleExpanded={() => onToggleExpanded(product.id)}
                    categories={categories}
                    types={types}
                    events={events}
                    onOpenEvent={onOpenEvent}
                    readOnly
                  />
                </li>
              ))}
            </ul>
          ) : (
            <SortableContext items={untypedIds} strategy={verticalListSortingStrategy}>
              <ul className="cat-products">
                {untyped.map(product => (
                  <SortableProductItem
                    key={product.id}
                    product={product}
                    onUpdate={updates => onUpdateProduct(product.id, updates)}
                    onDelete={() => onDeleteProduct(product.id)}
                    startExpanded={product.id === newProductId}
                    expanded={expandedIds.has(product.id)}
                    onToggleExpanded={() => onToggleExpanded(product.id)}
                    categories={categories}
                    types={types}
                    onCreateType={onCreateType}
                    events={events}
                    onOpenEvent={onOpenEvent}
                    selectMode={selectMode}
                    selected={selectedIds?.has(product.id)}
                    onToggleSelect={() => onToggleSelect(product.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}
