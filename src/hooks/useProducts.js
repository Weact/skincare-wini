import { useState, useEffect, useRef } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { loadProducts, saveProducts } from '../utils/storage'

export function useProducts(userId) {
  const [products, setProducts] = useState([])
  const migrated = useRef(false)

  useEffect(() => {
    if (!userId) return

    migrated.current = false
    const colRef = collection(db, 'users', userId, 'products')

    const unsub = onSnapshot(colRef, async snapshot => {
      // One-time migration: move localStorage products into Firestore
      if (!migrated.current) {
        migrated.current = true
        const local = loadProducts()
        if (local.length > 0 && snapshot.empty) {
          const batch = writeBatch(db)
          local.forEach(p => batch.set(doc(colRef, p.id), p))
          await batch.commit()
          saveProducts([])
          return // onSnapshot will fire again with the migrated data
        }
      }

      setProducts(snapshot.docs.map(d => ({ ...d.data(), id: d.id })))
    }, err => {
      console.error('Firestore snapshot error:', err)
    })

    return unsub
  }, [userId])

  async function addProduct(product) {
    await setDoc(doc(db, 'users', userId, 'products', product.id), product)
  }

  async function updateProduct(id, updates) {
    await setDoc(doc(db, 'users', userId, 'products', id), updates, { merge: true })
  }

  async function deleteProduct(id) {
    await deleteDoc(doc(db, 'users', userId, 'products', id))
  }

  async function reorderProductsInCategory(orderedProducts) {
    const batch = writeBatch(db)
    orderedProducts.forEach((product, index) => {
      batch.set(doc(db, 'users', userId, 'products', product.id), { order: index }, { merge: true })
    })
    await batch.commit()
  }

  async function moveProductToCategory(productId, newCategoryId, orderedProducts) {
    const batch = writeBatch(db)
    orderedProducts.forEach((product, index) => {
      const updates = { order: index }
      if (product.id === productId) updates.categoryId = newCategoryId
      batch.set(doc(db, 'users', userId, 'products', product.id), updates, { merge: true })
    })
    await batch.commit()
  }

  return { products, addProduct, updateProduct, deleteProduct, reorderProductsInCategory, moveProductToCategory }
}
