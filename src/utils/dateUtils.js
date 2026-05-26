export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target - today) / 86400000)
}

export function getProductStatus(product) {
  if (!product.openingDate) {
    return { type: 'sealed', label: 'Sealed' }
  }
  if (!product.expirationDate) {
    return { type: 'open', label: 'Open' }
  }
  const days = getDaysUntil(product.expirationDate)
  if (days < 0) {
    return { type: 'expired', label: 'Expired' }
  }
  if (days === 0) {
    return { type: 'expiring', label: 'Expires today' }
  }
  if (days <= 30) {
    return { type: 'expiring', label: `${days}d left` }
  }
  return { type: 'open', label: `${days}d left` }
}
