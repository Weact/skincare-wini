const KEY = 'skincare_products'

export function loadProducts() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveProducts(products) {
  localStorage.setItem(KEY, JSON.stringify(products))
}
