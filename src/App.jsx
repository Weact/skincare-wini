import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductCard from './components/ProductCard'
import CategorySection from './components/CategorySection'
import AuthButton from './components/AuthButton'
import ChangelogModal from './components/ChangelogModal'
import { useAuth } from './hooks/useAuth'
import { useProducts } from './hooks/useProducts'
import { useCategories } from './hooks/useCategories'
import { resizeImage } from './utils/imageUtils'
import { CATEGORY_EMOJIS, PRESET_CATEGORIES } from './constants'
import { LATEST_VERSION } from './changelog'
import './App.css'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Wraps a CategorySection with drag-and-drop sorting behaviour
function SortableCategory(props) {
  const { category } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cat-${category.id}`,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <CategorySection {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// Groups and sorts products by category
function groupProducts(products, categories) {
  const groups = {}
  categories.forEach(c => { groups[c.id] = [] })
  groups.__none = []

  products.forEach(p => {
    const key = p.categoryId && groups[p.categoryId] !== undefined ? p.categoryId : '__none'
    groups[key].push(p)
  })

  const sortByOrder = arr =>
    [...arr].sort((a, b) => {
      const ao = a.order ?? Infinity
      const bo = b.order ?? Infinity
      return ao !== bo ? ao - bo : new Date(a.createdAt) - new Date(b.createdAt)
    })

  const result = {}
  Object.keys(groups).forEach(k => { result[k] = sortByOrder(groups[k]) })
  return result
}

export default function App() {
  const { user, linkWithGoogle, handleSignOut } = useAuth()
  const { products, addProduct, updateProduct, deleteProduct, reorderProductsInCategory, moveProductToCategory } = useProducts(user?.uid)
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories(user?.uid)
  const [newProductId, setNewProductId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [liveProducts, setLiveProducts] = useState(null)
  const photoInputRef = useRef(null)

  // New category form state
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatEmoji, setNewCatEmoji] = useState('')
  const [showNewCatEmoji, setShowNewCatEmoji] = useState(false)
  const newCatEmojiRef = useRef(null)

  const [showChangelog, setShowChangelog] = useState(false)
  const [changelogIsNew, setChangelogIsNew] = useState(
    () => localStorage.getItem('lastSeenChangelog') !== LATEST_VERSION
  )

  function openChangelog() {
    setShowChangelog(true)
    setChangelogIsNew(false)
    localStorage.setItem('lastSeenChangelog', LATEST_VERSION)
  }

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    document.getElementById('theme-color-meta').content =
      theme === 'dark' ? '#100e1a' : '#faf7f5'
  }, [theme])

  // Close emoji picker on outside click
  useEffect(() => {
    function handle(e) {
      if (newCatEmojiRef.current && !newCatEmojiRef.current.contains(e.target)) {
        setShowNewCatEmoji(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  async function handleAddProduct(photo = null) {
    const id = generateId()
    await addProduct({
      id, name: '', openingDate: null, expirationDate: null,
      usageMonths: null, photo, createdAt: new Date().toISOString(),
    })
    setNewProductId(id)
  }

  async function handlePhotoFAB(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const photo = await resizeImage(file)
    handleAddProduct(photo)
  }

  async function handleDeleteCategory(catId) {
    // Clear categoryId on all products that belonged to this category
    const affected = products.filter(p => p.categoryId === catId)
    await Promise.all(affected.map(p => updateProduct(p.id, { categoryId: null })))
    await deleteCategory(catId)
  }

  async function submitNewCategory() {
    if (!newCatName.trim()) return
    await addCategory(newCatName.trim(), newCatEmoji)
    setNewCatName('')
    setNewCatEmoji('')
    setShowNewCat(false)
    setShowNewCatEmoji(false)
  }

  function handleDragStart({ active }) {
    setActiveId(String(active.id))
  }

  function handleDragOver({ active, over }) {
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)
    if (!aId.startsWith('prod-')) return

    const fromId = aId.slice(5)

    setLiveProducts(prev => {
      const current = prev ?? products
      const fromProd = current.find(p => p.id === fromId)
      if (!fromProd) return prev

      let toCatId
      let insertBeforeId = null

      if (oId.startsWith('prod-')) {
        const toId = oId.slice(5)
        if (toId === fromId) return prev
        const toProd = current.find(p => p.id === toId)
        if (!toProd) return prev
        toCatId = toProd.categoryId || null
        insertBeforeId = toId
      } else if (oId.startsWith('cat-')) {
        toCatId = oId.slice(4)
      } else {
        return prev
      }

      const without = current.filter(p => p.id !== fromId)
      const targetProds = without
        .filter(p => (p.categoryId || null) === toCatId)
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

      const movedProd = { ...fromProd, categoryId: toCatId }
      const idx = insertBeforeId ? targetProds.findIndex(p => p.id === insertBeforeId) : -1
      targetProds.splice(idx === -1 ? targetProds.length : idx, 0, movedProd)

      const updated = targetProds.map((p, i) => ({ ...p, order: i }))
      const rest = without.filter(p => (p.categoryId || null) !== toCatId)
      return [...rest, ...updated]
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    const aId = String(active.id)

    // ── Reorder categories ──
    if (aId.startsWith('cat-')) {
      setLiveProducts(null)
      if (!over || aId === String(over.id)) return
      const oId = String(over.id)
      if (!oId.startsWith('cat-')) return
      const from = categories.findIndex(c => `cat-${c.id}` === aId)
      const to = categories.findIndex(c => `cat-${c.id}` === oId)
      if (from !== -1 && to !== -1) reorderCategories(arrayMove([...categories], from, to))
      return
    }

    // ── Persist product drag from liveProducts ──
    if (aId.startsWith('prod-') && liveProducts && over) {
      const fromId = aId.slice(5)
      const origProd = products.find(p => p.id === fromId)
      const liveProd = liveProducts.find(p => p.id === fromId)

      if (origProd && liveProd) {
        const toCatId = liveProd.categoryId || null
        const fromCatId = origProd.categoryId || null

        const targetOrdered = liveProducts
          .filter(p => (p.categoryId || null) === toCatId)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        if (fromCatId !== toCatId) {
          moveProductToCategory(fromId, toCatId, targetOrdered)
          const sourceOrdered = liveProducts
            .filter(p => (p.categoryId || null) === fromCatId)
            .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
          if (sourceOrdered.length > 0) reorderProductsInCategory(sourceOrdered)
        } else {
          reorderProductsInCategory(targetOrdered)
        }
      }
    }

    setLiveProducts(null)
  }

  const displayProducts = liveProducts ?? products
  const grouped = groupProducts(displayProducts, categories)
  const categoryIds = categories.map(c => `cat-${c.id}`)
  const uncategorized = grouped.__none || []
  const unusedPresets = PRESET_CATEGORIES.filter(
    p => !categories.some(c => c.name.toLowerCase() === p.name.toLowerCase())
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">Skincare</h1>
          <span className="app-count">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </span>
        </div>
        <div className="app-header-right">
          <button className="changelog-btn" onClick={openChangelog} aria-label="What's new">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            {changelogIsNew && <span className="changelog-dot" />}
          </button>
          <AuthButton user={user} onLinkGoogle={linkWithGoogle} onSignOut={handleSignOut} />
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        {user === undefined ? (
          <div className="app-loading">
            <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
          </div>
        ) : (
          <>
            {/* ── New category form ── */}
            {showNewCat ? (
              <div className="new-cat-form" ref={newCatEmojiRef}>
                <button className="cat-emoji-btn" onClick={() => setShowNewCatEmoji(s => !s)}>
                  {newCatEmoji || '📁'}
                </button>
                {showNewCatEmoji && (
                  <div className="cat-emoji-picker">
                    {CATEGORY_EMOJIS.map(e => (
                      <button
                        key={e}
                        className={`cat-emoji-opt${e === newCatEmoji ? ' cat-emoji-opt--active' : ''}`}
                        onClick={() => { setNewCatEmoji(e); setShowNewCatEmoji(false) }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  className="cat-name-input"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitNewCategory(); if (e.key === 'Escape') setShowNewCat(false) }}
                  placeholder="Category name..."
                  autoFocus
                />
                <button className="cat-save-btn" onClick={submitNewCategory}>Add</button>
                <button className="cat-cancel-btn" onClick={() => setShowNewCat(false)}>✕</button>
              </div>
            ) : (
              <button className="new-cat-btn" onClick={() => setShowNewCat(true)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                New category
              </button>
            )}

            {/* ── Preset category chips ── */}
            {unusedPresets.length > 0 && (
              <div className="preset-chips">
                <span className="preset-chips-label">Suggested</span>
                <div className="preset-chips-scroll">
                  {unusedPresets.map(p => (
                    <button
                      key={p.name}
                      className="preset-chip"
                      onClick={() => addCategory(p.name, p.emoji)}
                    >
                      {p.emoji} {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Product list ── */}
            {products.length === 0 && !showNewCat ? (
              <div className="empty-state">
                <div className="empty-icon">🧴</div>
                <p className="empty-title">No products yet</p>
                <p className="empty-text">Tap + to add your first skincare product</p>
              </div>
            ) : categories.length === 0 ? (
              /* Flat list — no categories created yet */
              <ul className="product-list">
                {[...displayProducts]
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(product => (
                    <li key={product.id}>
                      <ProductCard
                        product={product}
                        onUpdate={updates => updateProduct(product.id, updates)}
                        onDelete={() => deleteProduct(product.id)}
                        startExpanded={product.id === newProductId}
                        categories={categories}
                      />
                    </li>
                  ))}
              </ul>
            ) : (
              /* Grouped view with drag-and-drop */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveId(null); setLiveProducts(null) }}
              >
                <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                  {categories.map(cat => (
                    <SortableCategory
                      key={cat.id}
                      category={cat}
                      products={grouped[cat.id] || []}
                      categories={categories}
                      onUpdateProduct={updateProduct}
                      onDeleteProduct={deleteProduct}
                      onUpdateCategory={updateCategory}
                      onDeleteCategory={handleDeleteCategory}
                      newProductId={newProductId}
                    />
                  ))}
                </SortableContext>

                {/* Uncategorized — always at bottom, not sortable at section level */}
                {uncategorized.length > 0 && (
                  <CategorySection
                    category={null}
                    products={uncategorized}
                    categories={categories}
                    onUpdateProduct={updateProduct}
                    onDeleteProduct={deleteProduct}
                    onUpdateCategory={() => {}}
                    onDeleteCategory={() => {}}
                    newProductId={newProductId}
                  />
                )}

                <DragOverlay>
                  {activeId?.startsWith('prod-') && (() => {
                    const p = products.find(p => p.id === activeId.slice(5))
                    return p ? (
                      <div className="dnd-overlay">
                        <ProductCard
                          product={p}
                          onUpdate={() => {}}
                          onDelete={() => {}}
                          startExpanded={false}
                          categories={categories}
                        />
                      </div>
                    ) : null
                  })()}
                  {activeId?.startsWith('cat-') && (() => {
                    const c = categories.find(c => `cat-${c.id}` === activeId)
                    return c ? (
                      <div className="dnd-overlay cat-overlay-card">
                        {c.emoji && <span className="cat-emoji">{c.emoji}</span>}
                        <span className="cat-name">{c.name}</span>
                      </div>
                    ) : null
                  })()}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </main>

      <div className="fab-group">
        <button className="fab fab--secondary" onClick={() => photoInputRef.current.click()} aria-label="Add product with photo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        <button className="fab" onClick={() => handleAddProduct()} aria-label="Add product">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFAB} />

      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
    </div>
  )
}
