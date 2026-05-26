import { useState, useEffect, useRef } from 'react'
import ProductCard from './components/ProductCard'
import { loadProducts, saveProducts } from './utils/storage'
import { resizeImage } from './utils/imageUtils'
import './App.css'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function App() {
  const [products, setProducts] = useState(() => loadProducts())
  const [newProductId, setNewProductId] = useState(null)
  const isFirstRender = useRef(true)

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    document.getElementById('theme-color-meta').content =
      theme === 'dark' ? '#100e1a' : '#faf7f5'
  }, [theme])

  useEffect(() => {
    // Skip saving on initial load (we just loaded from storage)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveProducts(products)
  }, [products])

  const photoInputRef = useRef(null)

  function addProduct(photo = null) {
    const id = generateId()
    const product = {
      id,
      name: '',
      openingDate: null,
      expirationDate: null,
      usageMonths: null,
      photo,
      createdAt: new Date().toISOString(),
    }
    setProducts(prev => [product, ...prev])
    setNewProductId(id)
  }

  async function handlePhotoFAB(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const photo = await resizeImage(file)
    addProduct(photo)
  }

  function updateProduct(id, updates) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function deleteProduct(id) {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">Skincare</h1>
          <span className="app-count">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </span>
        </div>
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
      </header>

      <main className="app-main">
        {products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧴</div>
            <p className="empty-title">No products yet</p>
            <p className="empty-text">Tap the + button to add your first skincare product</p>
          </div>
        ) : (
          <ul className="product-list">
            {products.map(product => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  onUpdate={updates => updateProduct(product.id, updates)}
                  onDelete={() => deleteProduct(product.id)}
                  startExpanded={product.id === newProductId}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fab-group">
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
        <button className="fab" onClick={() => addProduct()} aria-label="Add product">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoFAB}
      />
    </div>
  )
}
