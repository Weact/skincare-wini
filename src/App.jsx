import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  pointerWithin,
  rectIntersection,
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
import ExpiredSection from './components/ExpiredSection'
import AuthButton from './components/AuthButton'
import ChangelogModal from './components/ChangelogModal'
import SettingsPanel from './components/SettingsPanel'
import CalendarModal from './components/CalendarModal'
import WorkoutCalendarModal from './components/WorkoutCalendarModal'
import WorkoutTracker from './components/WorkoutTracker'
import PoopTracker from './components/PoopTracker'
import Toast from './components/Toast'
import EmojiPicker from './components/EmojiPicker'
import SelectionBar from './components/SelectionBar'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import { useAuth } from './hooks/useAuth'
import { useProducts } from './hooks/useProducts'
import { useCategories } from './hooks/useCategories'
import { useTypes } from './hooks/useTypes'
import { useEvents } from './hooks/useEvents'
import { useWorkouts } from './hooks/useWorkouts'
import { useSteps } from './hooks/useSteps'
import { usePoops } from './hooks/usePoops'
import { useProfile } from './hooks/useProfile'
import WelcomeScreen from './components/WelcomeScreen'
import SharedProfileView from './components/SharedProfileView'
import { resizeImage } from './utils/imageUtils'
import { getProductStatus } from './utils/dateUtils'
import { LATEST_VERSION } from './changelog'
import { TRACKERS } from './constants'
import './App.css'

// Which trackers the user has opted into — device-local, defaults to each
// tracker's own `defaultEnabled` flag (so existing Skincare/Workout users
// see no change, while opt-in trackers like Poop start off). Read directly
// from localStorage (rather than through `settings`) so the very first
// `mode` computation below doesn't have to wait on that state existing yet.
function getStoredEnabledTrackers() {
  try {
    const raw = localStorage.getItem('enabledTrackers')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return TRACKERS.filter(t => t.defaultEnabled).map(t => t.key)
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// With three nesting tiers now (category > type > product), pure centre-
// distance matching (closestCenter) gets unstable — a type section's rect
// can span much more area than the specific product under the cursor, so
// its centre can "win" even while hovering directly over a product inside
// it. pointerWithin checks what's actually under the cursor first (and
// returns the smallest/innermost match when several nest), falling back to
// rectIntersection only when the pointer briefly isn't over any registered
// droppable (e.g. a fast drag between gaps).
function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
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

// Whether two product lists resolve to the same on-screen order, per
// (category, type) bucket — used to detect once Firestore has confirmed an
// optimistic drag prediction. Compares id sequence rather than raw `order`
// numbers: order is only ever renumbered within the bucket a product moves
// into/within, so different buckets can share overlapping numbers by design.
function bucketKey(p) {
  return `${p.categoryId || ''}::${p.typeId || ''}`
}

function sameProductOrder(a, b) {
  const groupBy = list => {
    const groups = {}
    list.forEach(p => {
      const k = bucketKey(p)
      ;(groups[k] ??= []).push(p)
    })
    Object.values(groups).forEach(arr =>
      arr.sort((x, y) => (x.order ?? Infinity) - (y.order ?? Infinity))
    )
    return groups
  }
  const ga = groupBy(a)
  const gb = groupBy(b)
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
  const { products, addProduct, updateProduct, deleteProduct, reorderProductsInCategory, moveProduct } = useProducts(user?.uid)
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories(user?.uid)
  const { types, addType, updateType, deleteType, reorderTypes } = useTypes(user?.uid)
  const { events, addEvent, updateEvent, deleteEvent } = useEvents(user?.uid)
  const { workouts, addWorkout, updateWorkout, deleteWorkout } = useWorkouts(user?.uid)
  const { steps, logSteps } = useSteps(user?.uid)
  const { poops, addPoop, deletePoop, reorderPoops } = usePoops(user?.uid)
  const { profile, setVisibility, addAllowedViewer, removeAllowedViewer } = useProfile(user?.uid, user?.isAnonymous)
  const [viewingProfileCode, setViewingProfileCode] = useState(null)

  // Belt-and-suspenders: Firestore's rules already refuse anonymous reads of
  // shared profiles, but if someone signs out while mid-view (the only way
  // an anonymous session could end up with this state set at all), drop
  // straight back out rather than leave a dead/erroring view on screen.
  useEffect(() => {
    if (user?.isAnonymous) setViewingProfileCode(null)
  }, [user?.isAnonymous])
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarTarget, setCalendarTarget] = useState(null)
  const [workoutCalendarTarget, setWorkoutCalendarTarget] = useState(null)

  function handleOpenWorkoutInCalendar(workout) {
    setWorkoutCalendarTarget({ date: workout.date, workoutId: workout.id })
    setShowCalendar(true)
  }

  // Which tracker is active — skincare products or workout journal, or null
  // if the user has no tracker enabled (shows the welcome screen instead).
  // Persisted so the app reopens where the user left off.
  const [mode, setMode] = useState(() => {
    const enabled = getStoredEnabledTrackers()
    const stored = localStorage.getItem('trackerMode')
    return stored && enabled.includes(stored) ? stored : (enabled[0] || null)
  })

  function switchMode(next) {
    setMode(next)
    setViewingProfileCode(null)
    if (next) localStorage.setItem('trackerMode', next)
    else localStorage.removeItem('trackerMode')
  }

  function handleOpenEvent(event) {
    setCalendarTarget({ date: event.date, eventId: event.id })
    setShowCalendar(true)
  }
  const [newProductId, setNewProductId] = useState(null)

  // Consume the "just added" flag once its card has had a chance to mount
  // expanded — otherwise it lingers forever, and collapsing/reopening the
  // category or type it lives in (which unmounts and remounts every card
  // inside) recomputes startExpanded from this same id and pops it open again.
  useEffect(() => {
    if (newProductId) setNewProductId(null)
  }, [newProductId])

  // Which product cards are expanded — lifted up here (rather than local
  // state inside ProductCard) because changing a product's category/type
  // moves it to a different parent list (a different CategorySection or
  // TypeSection), which unmounts the old card instance and mounts a new one
  // elsewhere. Local state would reset to collapsed on that remount; state
  // stored here survives it, since the new instance just reads its id back
  // out of this set.
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Bulk-select mode for the product list (Select / Delete N)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedProductIds(new Set())
    // Entering select mode while a new-category/new-type form (or the +
    // menu) is open would leave them stacked awkwardly above the list
    setShowNewCat(false)
    setShowNewType(false)
    setShowAddMenu(false)
  }

  function toggleProductSelect(id) {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmBulkDeleteProducts() {
    await Promise.all([...selectedProductIds].map(id => handleDeleteProduct(id)))
    setSelectedProductIds(new Set())
    setSelectMode(false)
    setShowDeleteConfirm(false)
  }

  const [activeId, setActiveId] = useState(null)
  const [liveProducts, setLiveProducts] = useState(null)
  const [liveCategoryOrder, setLiveCategoryOrder] = useState(null)
  const [liveTypeOrder, setLiveTypeOrder] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const photoInputRef = useRef(null)

  function showToast(message) {
    clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  // Drop the optimistic product-order preview once Firestore has confirmed
  // the same order — clearing it right on drop (the old behaviour) made the
  // dropped card snap back to its pre-drag slot for a beat, then jump once
  // the async write round-tripped back through onSnapshot.
  useEffect(() => {
    if (!liveProducts) return
    if (sameProductOrder(products, liveProducts)) setLiveProducts(null)
  }, [products])

  // Same idea for category order
  useEffect(() => {
    if (!liveCategoryOrder) return
    const confirmed = categories.map(c => c.id)
    const matches = confirmed.length === liveCategoryOrder.length &&
      confirmed.every((id, i) => id === liveCategoryOrder[i])
    if (matches) setLiveCategoryOrder(null)
  }, [categories])

  // Same idea for type order — scoped to whichever category was reordered
  useEffect(() => {
    if (!liveTypeOrder) return
    const confirmed = types.filter(t => t.categoryId === liveTypeOrder.categoryId).map(t => t.id)
    const matches = confirmed.length === liveTypeOrder.ids.length &&
      confirmed.every((id, i) => id === liveTypeOrder.ids[i])
    if (matches) setLiveTypeOrder(null)
  }, [types])

  // New category form state
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatEmoji, setNewCatEmoji] = useState('')
  const [showNewCatEmoji, setShowNewCatEmoji] = useState(false)
  const newCatEmojiRef = useRef(null)

  // New type form state — global, single entry point; the user picks which
  // category it attaches to, instead of repeating an "Add type" control
  // inside every expanded category section
  const [showNewType, setShowNewType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeEmoji, setNewTypeEmoji] = useState('')
  const [showNewTypeEmoji, setShowNewTypeEmoji] = useState(false)
  const [newTypeCategoryId, setNewTypeCategoryId] = useState('')
  const newTypeEmojiRef = useRef(null)

  // + FAB's "what do you want to add" menu — replaces the old standalone
  // "New category" / "Add type" buttons
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef(null)

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
    enabledTrackers: getStoredEnabledTrackers(),
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
    localStorage.setItem('enabledTrackers', JSON.stringify(settings.enabledTrackers))
  }, [settings])

  // If the active (or last-active) tracker gets unchecked in Settings, fall
  // back to another enabled one, or to the welcome screen if none are left.
  useEffect(() => {
    if (mode && !settings.enabledTrackers.includes(mode)) {
      switchMode(settings.enabledTrackers[0] || null)
    } else if (!mode && settings.enabledTrackers.length > 0) {
      switchMode(settings.enabledTrackers[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabledTrackers])

  function updateSetting(key, value) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  // Close emoji picker on outside click
  useEffect(() => {
    function handle(e) {
      if (newCatEmojiRef.current && !newCatEmojiRef.current.contains(e.target)) {
        setShowNewCatEmoji(false)
      }
      if (newTypeEmojiRef.current && !newTypeEmojiRef.current.contains(e.target)) {
        setShowNewTypeEmoji(false)
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setShowAddMenu(false)
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
    setExpandedIds(prev => new Set(prev).add(id))
    // New products always start uncategorized — there's no way yet to add
    // directly into a specific category from the FABs
    showToast('Added product to Uncategorized')
  }

  // The + FAB's menu — scrolls up too, since the category/type forms it
  // opens render at the top of the list, off-screen if you'd scrolled down
  function handleAddMenuSelect(kind) {
    setShowAddMenu(false)
    if (kind === 'product') {
      handleAddProduct()
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (kind === 'category') setShowNewCat(true)
    else if (kind === 'type') openNewTypeForm()
  }

  async function handlePhotoFAB(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const photo = await resizeImage(file)
    handleAddProduct(photo)
  }

  async function handleDeleteCategory(catId) {
    // Clear categoryId/typeId on all products that belonged to this category,
    // and delete its types (sub-categories) along with it
    const affected = products.filter(p => p.categoryId === catId)
    await Promise.all(affected.map(p => updateProduct(p.id, { categoryId: null, typeId: null })))
    const catTypes = types.filter(t => t.categoryId === catId)
    await Promise.all(catTypes.map(t => deleteType(t.id)))
    await deleteCategory(catId)
  }

  async function handleDeleteType(typeId) {
    // Clear typeId on all products that belonged to this type
    const affected = products.filter(p => p.typeId === typeId)
    await Promise.all(affected.map(p => updateProduct(p.id, { typeId: null })))
    await deleteType(typeId)
  }

  async function handleDeleteProduct(productId) {
    // Unlink (but don't delete) any calendar events pointing at this product
    const affected = events.filter(e => e.productId === productId)
    await Promise.all(affected.map(e => updateEvent(e.id, { productId: null })))
    await deleteProduct(productId)
  }

  async function submitNewCategory() {
    if (!newCatName.trim()) return
    await addCategory(newCatName.trim(), newCatEmoji)
    setNewCatName('')
    setNewCatEmoji('')
    setShowNewCat(false)
    setShowNewCatEmoji(false)
  }

  function openNewTypeForm() {
    setNewTypeCategoryId(categories[0]?.id || '')
    setShowNewType(true)
  }

  async function submitNewType() {
    if (!newTypeName.trim() || !newTypeCategoryId) return
    await addType(newTypeName.trim(), newTypeEmoji, newTypeCategoryId)
    setNewTypeName('')
    setNewTypeEmoji('')
    setShowNewType(false)
    setShowNewTypeEmoji(false)
  }

  // Inline type creation from a product card (no emoji picker there — keep it quick)
  function handleCreateType(name, emoji, categoryId) {
    return addType(name, emoji, categoryId)
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
      let toTypeId = null
      let insertBeforeId = null

      if (oId.startsWith('prod-')) {
        const toId = oId.slice(5)
        if (toId === fromId) return prev
        const toProd = current.find(p => p.id === toId)
        if (!toProd) return prev
        toCatId = toProd.categoryId || null
        toTypeId = toProd.typeId || null
        insertBeforeId = toId
      } else if (oId.startsWith('type-')) {
        const type = types.find(t => t.id === oId.slice(5))
        if (!type) return prev
        toCatId = type.categoryId
        toTypeId = type.id
      } else if (oId.startsWith('cat-')) {
        toCatId = oId.slice(4)
      } else {
        return prev
      }

      const inBucket = p => (p.categoryId || null) === toCatId && (p.typeId || null) === toTypeId

      const without = current.filter(p => p.id !== fromId)
      const targetProds = without
        .filter(inBucket)
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

      const movedProd = { ...fromProd, categoryId: toCatId, typeId: toTypeId }
      const idx = insertBeforeId ? targetProds.findIndex(p => p.id === insertBeforeId) : -1
      targetProds.splice(idx === -1 ? targetProds.length : idx, 0, movedProd)

      const updated = targetProds.map((p, i) => ({ ...p, order: i }))
      const rest = without.filter(p => !inBucket(p))
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

    // ── Reorder types (within their own category only — no cross-category type drag) ──
    if (aId.startsWith('type-')) {
      setLiveProducts(null)
      if (!over || aId === String(over.id)) return
      const oId = String(over.id)
      if (!oId.startsWith('type-')) return
      const fromType = types.find(t => `type-${t.id}` === aId)
      const toType = types.find(t => `type-${t.id}` === oId)
      if (!fromType || !toType || fromType.categoryId !== toType.categoryId) return
      const categoryTypes = types.filter(t => t.categoryId === fromType.categoryId)
      const from = categoryTypes.findIndex(t => t.id === fromType.id)
      const to = categoryTypes.findIndex(t => t.id === toType.id)
      if (from !== -1 && to !== -1) {
        const reordered = arrayMove(categoryTypes, from, to)
        setLiveTypeOrder({ categoryId: fromType.categoryId, ids: reordered.map(t => t.id) })
        reorderTypes(reordered)
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
        const toTypeId = liveProd.typeId || null
        const fromCatId = origProd.categoryId || null
        const fromTypeId = origProd.typeId || null

        const targetOrdered = liveProducts
          .filter(p => (p.categoryId || null) === toCatId && (p.typeId || null) === toTypeId)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))

        if (fromCatId !== toCatId || fromTypeId !== toTypeId) {
          moveProduct(fromId, { categoryId: toCatId, typeId: toTypeId }, targetOrdered)
          const sourceOrdered = liveProducts
            .filter(p => (p.categoryId || null) === fromCatId && (p.typeId || null) === fromTypeId)
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
  // `types` already arrives sorted by `order` (see useTypes' orderBy query),
  // so filtering to one category's types preserves their correct relative
  // sequence without needing an extra sort here.
  function typesForCategory(catId) {
    const base = types.filter(t => t.categoryId === catId)
    if (liveTypeOrder?.categoryId === catId) {
      return liveTypeOrder.ids.map(id => base.find(t => t.id === id)).filter(Boolean)
    }
    return base
  }
  // Expired products are pulled into their own virtual section (like
  // Uncategorized) regardless of their real categoryId/typeId — status is
  // computed live from the expiration date, so this stays in sync
  // automatically and reverses itself if the date is edited back.
  const expiredProducts = displayProducts.filter(p => getProductStatus(p).type === 'expired')
  const groupableProducts = displayProducts.filter(p => getProductStatus(p).type !== 'expired')
  const grouped = groupProducts(groupableProducts, categories)
  const categoryIds = displayCategories.map(c => `cat-${c.id}`)
  const uncategorized = grouped.__none || []

  const selectedProductItems = products
    .filter(p => selectedProductIds.has(p.id))
    .map(p => ({
      id: p.id,
      label: p.name || 'Unnamed product',
      sublabel: getProductStatus(p).label,
    }))

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-header-left">
            {mode && !viewingProfileCode && (
              <div className="mode-switch" role="tablist" aria-label="Tracker">
                {TRACKERS.filter(t => settings.enabledTrackers.includes(t.key)).map(t => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={mode === t.key}
                    className={`mode-switch-btn${mode === t.key ? ' mode-switch-btn--active' : ''}`}
                    onClick={() => switchMode(t.key)}
                  >
                    <span className="mode-switch-icon">{t.icon}</span>
                    <span className="mode-switch-label">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="app-header-right">
            {/* Grouped into one pill (mirroring the tracker switch on the
                left) so these stay in the same order across every tracker.
                Poop has no calendar modal to open, so its button is left out
                entirely rather than shown disabled — an empty gap in the
                pill would look more broken than the pill simply being
                narrower for that tracker. */}
            <div className="header-icon-group">
              <button className="changelog-btn" onClick={openChangelog} aria-label="What's new">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
                {changelogIsNew && <span className="changelog-dot" />}
              </button>
              {mode && mode !== 'poop' && !viewingProfileCode && (
                <button
                  className="calendar-btn"
                  onClick={() => setShowCalendar(true)}
                  aria-label={mode === 'workout' ? 'Workout calendar' : 'Routine calendar'}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2"/>
                    <path d="M3 9.5h18" stroke="currentColor" strokeWidth="2"/>
                    <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <AuthButton user={user} onLinkGoogle={linkWithGoogle} onSignOut={handleSignOut} />
          </div>
        </div>
        {mode && !viewingProfileCode && (
          <span className="app-count">
            {mode === 'workout'
              ? `${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`
              : mode === 'poop'
              ? `${poops.length} logged`
              : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
          </span>
        )}
      </header>

      <main className="app-main">
        {user === undefined ? (
          <div className="app-loading">
            <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
          </div>
        ) : viewingProfileCode && !user?.isAnonymous ? (
          <SharedProfileView code={viewingProfileCode} onExit={() => setViewingProfileCode(null)} />
        ) : !mode ? (
          <WelcomeScreen onOpenSettings={() => setShowSettings(true)} />
        ) : mode === 'poop' ? (
          <PoopTracker poops={poops} addPoop={addPoop} deletePoop={deletePoop} reorderPoops={reorderPoops} />
        ) : mode === 'workout' ? (
          <WorkoutTracker
            workouts={workouts}
            steps={steps}
            logSteps={logSteps}
            addWorkout={addWorkout}
            updateWorkout={updateWorkout}
            deleteWorkout={deleteWorkout}
            onLogged={() => showToast('Workout logged 💪')}
            onStepsLogged={() => showToast('Steps logged 👟')}
            onOpenCalendar={handleOpenWorkoutInCalendar}
          />
        ) : (
          <>
            {!selectMode && (
              <div className="skincare-add-bar">
                <div className="fab-add-wrap" ref={addMenuRef}>
                  <button
                    type="button"
                    className={`skincare-add-btn${showAddMenu ? ' skincare-add-btn--active' : ''}`}
                    onClick={() => setShowAddMenu(s => !s)}
                    aria-label={showAddMenu ? 'Close add menu' : 'Add'}
                    aria-expanded={showAddMenu}
                  >
                    <svg className="fab-plus-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                    </svg>
                    Add
                  </button>
                  {showAddMenu && (
                    <div className="fab-menu fab-menu--dropdown">
                      <button className="fab-menu-item" onClick={() => handleAddMenuSelect('category')}>
                        <span className="fab-menu-icon">📁</span>
                        Category
                      </button>
                      {categories.length > 0 && (
                        <button className="fab-menu-item" onClick={() => handleAddMenuSelect('type')}>
                          <span className="fab-menu-icon">🏷️</span>
                          Type
                        </button>
                      )}
                      <button className="fab-menu-item" onClick={() => handleAddMenuSelect('product')}>
                        <span className="fab-menu-icon">🧴</span>
                        Product
                      </button>
                    </div>
                  )}
                </div>
                <button
                  className="fab fab--secondary"
                  onClick={() => photoInputRef.current.click()}
                  aria-label="Add product with photo"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
            )}

            <SelectionBar
              selectMode={selectMode}
              count={selectedProductIds.size}
              onToggle={toggleSelectMode}
              onDeleteClick={() => setShowDeleteConfirm(true)}
            />

            {/* ── New category form — opened from the + FAB's menu ── */}
            {showNewCat && (
              <div className="new-cat-form" ref={newCatEmojiRef}>
                <button className="cat-emoji-btn" onClick={() => setShowNewCatEmoji(s => !s)}>
                  {newCatEmoji || '📁'}
                </button>
                {showNewCatEmoji && (
                  <EmojiPicker
                    value={newCatEmoji}
                    onSelect={e => { setNewCatEmoji(e); setShowNewCatEmoji(false) }}
                  />
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
            )}

            {/* ── New type form — global, asks which category to attach to;
                 opened from the + FAB's menu ── */}
            {categories.length > 0 && showNewType && (
              <div className="new-type-global-form" ref={newTypeEmojiRef}>
                <select
                  className="field-input field-select"
                  value={newTypeCategoryId}
                  onChange={e => setNewTypeCategoryId(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
                <div className="cat-edit-form">
                  <button className="cat-emoji-btn" onClick={() => setShowNewTypeEmoji(s => !s)}>
                    {newTypeEmoji || '🏷️'}
                  </button>
                  {showNewTypeEmoji && (
                    <EmojiPicker
                      value={newTypeEmoji}
                      onSelect={e => { setNewTypeEmoji(e); setShowNewTypeEmoji(false) }}
                    />
                  )}
                  <input
                    className="cat-name-input"
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitNewType(); if (e.key === 'Escape') setShowNewType(false) }}
                    placeholder="Type name..."
                    autoFocus
                  />
                </div>
                <div className="new-type-global-actions">
                  <button className="cat-cancel-btn cat-cancel-btn--text" onClick={() => setShowNewType(false)}>Cancel</button>
                  <button className="cat-save-btn" onClick={submitNewType}>Add type</button>
                </div>
              </div>
            )}

            {/* ── Product list ── */}
            {products.length === 0 && categories.length === 0 && !showNewCat ? (
              <div className="empty-state">
                <div className="empty-icon">🧴</div>
                <p className="empty-title">No products yet</p>
                <p className="empty-text">Tap + to add your first skincare product</p>
              </div>
            ) : categories.length === 0 ? (
              /* Flat list — no categories created yet */
              <ul className="product-list">
                {[...groupableProducts]
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(product => (
                    <li key={product.id}>
                      <ProductCard
                        product={product}
                        onUpdate={updates => updateProduct(product.id, updates)}
                        onDelete={() => handleDeleteProduct(product.id)}
                        startExpanded={product.id === newProductId}
                        expanded={expandedIds.has(product.id)}
                        onToggleExpanded={() => toggleExpanded(product.id)}
                        categories={categories}
                        onCreateType={handleCreateType}
                        events={events}
                        onOpenEvent={handleOpenEvent}
                        selectMode={selectMode}
                        selected={selectedProductIds.has(product.id)}
                        onToggleSelect={() => toggleProductSelect(product.id)}
                      />
                    </li>
                  ))}
              </ul>
            ) : (
              /* Grouped view with drag-and-drop */
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => { setActiveId(null); setLiveProducts(null); setLiveCategoryOrder(null); setLiveTypeOrder(null) }}
              >
                <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                  {displayCategories.map(cat => (
                    <SortableCategory
                      key={cat.id}
                      category={cat}
                      products={grouped[cat.id] || []}
                      categories={categories}
                      types={typesForCategory(cat.id)}
                      onCreateType={handleCreateType}
                      events={events}
                      onOpenEvent={handleOpenEvent}
                      onUpdateProduct={updateProduct}
                      onDeleteProduct={handleDeleteProduct}
                      onUpdateCategory={updateCategory}
                      onDeleteCategory={handleDeleteCategory}
                      onUpdateType={updateType}
                      onDeleteType={handleDeleteType}
                      newProductId={newProductId}
                      expandedIds={expandedIds}
                      onToggleExpanded={toggleExpanded}
                      selectMode={selectMode}
                      selectedIds={selectedProductIds}
                      onToggleSelect={toggleProductSelect}
                    />
                  ))}
                </SortableContext>

                {/* Uncategorized — always at bottom, not sortable at section level */}
                {uncategorized.length > 0 && (
                  <CategorySection
                    category={null}
                    products={uncategorized}
                    categories={categories}
                    onCreateType={handleCreateType}
                    events={events}
                    onOpenEvent={handleOpenEvent}
                    onUpdateProduct={updateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onUpdateCategory={() => {}}
                    onDeleteCategory={() => {}}
                    newProductId={newProductId}
                    expandedIds={expandedIds}
                    onToggleExpanded={toggleExpanded}
                    selectMode={selectMode}
                    selectedIds={selectedProductIds}
                    onToggleSelect={toggleProductSelect}
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
                          expanded={false}
                          onToggleExpanded={() => {}}
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
                  {activeId?.startsWith('type-') && (() => {
                    const t = types.find(t => `type-${t.id}` === activeId)
                    return t ? (
                      <div className="dnd-overlay cat-overlay-card">
                        {t.emoji && <span className="cat-emoji">{t.emoji}</span>}
                        <span className="cat-name">{t.name}</span>
                      </div>
                    ) : null
                  })()}
                </DragOverlay>
              </DndContext>
            )}

            {/* ── Expired products — virtual section, cuts across categories, always last ── */}
            {expiredProducts.length > 0 && (
              <ExpiredSection
                products={expiredProducts}
                categories={categories}
                types={types}
                onCreateType={handleCreateType}
                events={events}
                onOpenEvent={handleOpenEvent}
                onUpdateProduct={updateProduct}
                onDeleteProduct={handleDeleteProduct}
                newProductId={newProductId}
                expandedIds={expandedIds}
                onToggleExpanded={toggleExpanded}
                selectMode={selectMode}
                selectedIds={selectedProductIds}
                onToggleSelect={toggleProductSelect}
              />
            )}
          </>
        )}
      </main>

      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFAB} />

      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          items={selectedProductItems}
          onConfirm={confirmBulkDeleteProducts}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSetting}
          onClose={() => setShowSettings(false)}
          user={user}
          profile={profile}
          onSetVisibility={setVisibility}
          onAddViewer={addAllowedViewer}
          onRemoveViewer={removeAllowedViewer}
          onViewProfile={code => { setViewingProfileCode(code); setShowSettings(false) }}
        />
      )}
      {showCalendar && (mode === 'workout' ? (
        <WorkoutCalendarModal
          workouts={workouts}
          addWorkout={addWorkout}
          updateWorkout={updateWorkout}
          deleteWorkout={deleteWorkout}
          jumpTo={workoutCalendarTarget}
          onClose={() => { setShowCalendar(false); setWorkoutCalendarTarget(null) }}
        />
      ) : (
        <CalendarModal
          events={events}
          products={products}
          categories={categories}
          types={types}
          addEvent={addEvent}
          updateEvent={updateEvent}
          deleteEvent={deleteEvent}
          jumpTo={calendarTarget}
          onClose={() => { setShowCalendar(false); setCalendarTarget(null) }}
        />
      ))}

      <Toast message={toast} />
    </div>
  )
}
