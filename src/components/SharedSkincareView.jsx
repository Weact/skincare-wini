import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useCategories } from '../hooks/useCategories'
import { useTypes } from '../hooks/useTypes'
import CategorySection from './CategorySection'
import ExpiredSection from './ExpiredSection'
import { getProductStatus } from '../utils/dateUtils'

// Plain read-only product listener — deliberately not useProducts(), which
// carries one-time localStorage→Firestore migration logic meant only for the
// signed-in owner's own device. Reusing it here for a shared viewer's uid
// (which will always fail its migration write against the owner's data
// under the read-only Firestore rules anyway) would just be a source of
// pointless dead writes/console errors.
function useSharedProducts(userId) {
  const [products, setProducts] = useState([])
  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(collection(db, 'users', userId, 'products'), snapshot => {
      setProducts(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => console.error('Shared products error:', err))
    return unsub
  }, [userId])
  return products
}

function groupProducts(products, categories) {
  const groups = {}
  categories.forEach(c => { groups[c.id] = [] })
  groups.__none = []
  products.forEach(p => {
    const key = p.categoryId && groups[p.categoryId] !== undefined ? p.categoryId : '__none'
    groups[key].push(p)
  })
  return groups
}

// Read-only mirror of the skincare list in App.jsx, minus categories/drag/
// forms/FAB — just the tree of categories → types → products, plus the
// Expired section. The routine calendar stays private, same as before.
export default function SharedSkincareView({ uid }) {
  const { categories } = useCategories(uid)
  const { types } = useTypes(uid)
  const products = useSharedProducts(uid)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function typesForCategory(catId) {
    return types.filter(t => t.categoryId === catId)
  }

  const expiredProducts = products.filter(p => getProductStatus(p).type === 'expired')
  const groupableProducts = products.filter(p => getProductStatus(p).type !== 'expired')
  const grouped = groupProducts(groupableProducts, categories)
  const uncategorized = grouped.__none || []

  return (
    <div className="shared-skincare">
      <span className="app-count">
        {products.length} {products.length === 1 ? 'product' : 'products'}
      </span>

      {categories.map(cat => (
        <CategorySection
          key={cat.id}
          category={cat}
          products={grouped[cat.id] || []}
          categories={categories}
          types={typesForCategory(cat.id)}
          expandedIds={expandedIds}
          onToggleExpanded={toggleExpanded}
          readOnly
        />
      ))}

      {uncategorized.length > 0 && (
        <CategorySection
          category={null}
          products={uncategorized}
          categories={categories}
          expandedIds={expandedIds}
          onToggleExpanded={toggleExpanded}
          readOnly
        />
      )}

      {expiredProducts.length > 0 && (
        <ExpiredSection
          products={expiredProducts}
          categories={categories}
          types={types}
          expandedIds={expandedIds}
          onToggleExpanded={toggleExpanded}
          readOnly
        />
      )}

      {products.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🧴</div>
          <p className="empty-title">No products yet</p>
        </div>
      )}
    </div>
  )
}
