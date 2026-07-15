export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO() {
  return toISODate(new Date())
}

// Flat array of cells for a month grid (weeks of 7, Monday-first), padded
// with null before day 1 and after the last day so the grid stays rectangular
export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatDayHeading(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

// 'HH:MM' (already 24h from the native time input) -> zero-padded '08:00'
export function formatEventTime(time) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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
