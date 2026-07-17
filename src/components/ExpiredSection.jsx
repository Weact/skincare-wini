import { useState } from 'react'
import ProductCard from './ProductCard'

// A virtual, computed grouping — like Uncategorized, not a real category.
// Membership is derived live from each product's expiration date (see
// getProductStatus), so it can't be reordered into and needs no rename/delete
// menu or drag handle; it just reflects whatever is currently expired.
export default function ExpiredSection({
  products,
  categories,
  types,
  onCreateType,
  events,
  onOpenEvent,
  onUpdateProduct,
  onDeleteProduct,
  newProductId,
  expandedIds,
  onToggleExpanded,
  selectMode,
  selectedIds,
  onToggleSelect,
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="cat-section cat-section--expired">
      <div className="cat-header">
        <button className="cat-header-main" onClick={() => setCollapsed(c => !c)}>
          <span className="cat-emoji">⏰</span>
          <span className="cat-name">Expired</span>
          <span className="cat-count">{products.length}</span>
          <span className={`chevron${collapsed ? '' : ' chevron--up'}`}>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>

      {!collapsed && (
        <ul className="cat-products">
          {products.map(product => (
            <li key={product.id}>
              <ProductCard
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
