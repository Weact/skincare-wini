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
import SettingsPanel from './components/SettingsPanel'
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

// Whether two product lists resolve to the same on-screen order, per category —
// used to detect once Firestore has confirmed an optimistic drag prediction.
// Compares id sequence rather than raw `order` numbers, since the source
// category's remaining items aren't renumbered locally the same way they're
// renumbered on persist.
function sameProductOrder(a, b, categories) {
  const ga = groupProducts(a, categories)
  const gb = groupProducts(b, categories)
  const keys = new Set([...Object.keys(ga), ...Object.keys(gb)])
  for (const k of keys) {
    const idsA = (ga[k] || []).map(p => p.id)
    const idsB = (gb[k] || []).map(p => p.id)
    if (idsA.length !== idsB.length) return false
    for (let i = 0; i < idsA.length; i++) {
      if (idsA[i] !== idsB[i]) return false
    }
  }
  return true
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
  const [liveCategoryOrder, setLiveCategoryOrder] = useState(null)
  const photoInputRef = useRef(null)

  // Drop the optimistic product-order preview once Firestore has confirmed
  // the same order — clearing it right on drop (the old behaviour) made the
  // dropped card snap back to its pre-drag slot for a beat, then jump once
  // the async write round-tripped back through onSnapshot.
  useEffect(() => {
    if (!liveProducts) return
    if (sameProductOrder(products, liveProducts, categories)) setLiveProducts(null)
  }, [products, categories])

  // Same idea for category order
  useEffect(() => {
    if (!liveCategoryOrder) return
    const confirmed = categories.map(c => c.id)
    const matches = confirmed.length === liveCategoryOrder.length &&
      confirmed.every((id, i) => id === liveCategoryOrder[i])
    if (matches) setLiveCategoryOrder(null)
  }, [categories])

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

  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => ({
    theme:    localStorage.getItem('theme')    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    accent:   localStorage.getItem('accent')   || 'rose',
    font:     localStorage.getItem('font')     || 'system',
    fontSize: localStorage.getItem('fontSize') || 'md',
  }))

  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme',     settings.theme)
    html.setAttribute('data-accent',    settings.accent)
    html.setAttribute('data-font',      settings.font)
    html.setAttribute('data-font-size', settings.fontSize)
    document.getElementById('theme-color-meta').content =
      settings.theme === 'dark' ? '#100e1a' : '#faf7f5'
    localStorage.setItem('theme',    settings.theme)
    localStorage.setItem('accent',   settings.accent)
    localStorage.setItem('font',     settings.font)
    localStorage.setItem('fontSize', settings.fontSize)
  }, [settings])

  function updateSetting(key, value) {
    setSettings(s => ({ ...s, [key]: value }))
  }

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
      if (from !== -1 && to !== -1) {
        const reordered = arrayMove([...categories], from, to)
        // Predict the confirmed order immediately so the dropped category
        // doesn't snap back to its old slot while Firestore round-trips —
        // cleared once the effect above sees `categories` match this.
        setLiveCategoryOrder(reordered.map(c => c.id))
        reorderCategories(reordered)
      }
      return
    }

    // ── Persist product drag from liveProducts ──
    let persisted = false
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
        persisted = true
      }
    }

    // Only snap back to the raw (unconfirmed) `products` here if nothing was
    // actually persisted — otherwise keep showing the prediction in
    // `liveProducts` until the effect above confirms Firestore caught up.
    if (!persisted) setLiveProducts(null)
  }

  const displayProducts = liveProducts ?? products
  const displayCategories = liveCategoryOrder
    ? liveCategoryOrder.map(id => categories.find(c => c.id === id)).filter(Boolean)
    : categories
  const grouped = groupProducts(displayProducts, categories)
  const categoryIds = displayCategories.map(c => `cat-${c.id}`)
  const uncategorized = grouped.__none || []
  const allTags = [...new Set(
    products.flatMap(p => (p.tags || []).map(t => typeof t === 'string' ? t : t.name))
  )].sort((a, b) => a.localeCompare(b))
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
          <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <AuthButton user={user} onLinkGoogle={linkWithGoogle} onSignOut={handleSignOut} />
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
                        allTags={allTags}
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
                onDragCancel={() => { setActiveId(null); setLiveProducts(null); setLiveCategoryOrder(null) }}
              >
                <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                  {displayCategories.map(cat => (
                    <SortableCategory
                      key={cat.id}
                      category={cat}
                      products={grouped[cat.id] || []}
                      categories={categories}
                      allTags={allTags}
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
                    allTags={allTags}
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
      {showSettings && (
        <SettingsPanel settings={settings} onUpdate={updateSetting} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
