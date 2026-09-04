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

// Coarse remaining time, for anything far enough out that an exact day count
// is noise — a sealed bottle reading "1094d left" tells you much less than
// "3yrs left" does. Exact days through the last month, months up to a year,
// years beyond that.
export function formatTimeLeft(days) {
  if (days === null || days < 0) return null
  if (days === 0) return 'Expires today'
  if (days <= 30) return `${days}d left`
  if (days < 365) return `${Math.round(days / 30)}mo left`
  const years = Math.round(days / 365)
  return `${years}yr${years === 1 ? '' : 's'} left`
}

// Has the product's own "Send warning" date been reached? From that day on
// the card switches to an exact day count and an amber tone, whether or not
// the product has been opened. (The notification itself is not built yet.)
export function isWarningActive(product, today = todayISO()) {
  if (!product.warningDate || !product.expirationDate) return false
  return today >= product.warningDate
}

// `label` is the badge; `note` is the smaller chip beside it, carrying the
// time left when the badge itself doesn't already say it (a sealed product
// stays "Sealed" — nothing has started running down — but its printed date
// is still ticking, and that's what the note shows).
export function getProductStatus(product) {
  if (product.emptiedAt) {
    return { type: 'empty', label: 'Empty' }
  }
  const days = getDaysUntil(product.expirationDate)
  const warned = days !== null && days >= 0 && isWarningActive(product)

  if (!product.openingDate) {
    if (days === null) {
      return { type: 'sealed', label: 'Sealed' }
    }
    if (days < 0) {
      return { type: 'sealed', label: 'Sealed', note: 'Past expiry', noteTone: 'expired' }
    }
    return {
      type: 'sealed',
      label: 'Sealed',
      note: warned ? `${days}d left` : formatTimeLeft(days),
      noteTone: warned || days <= 30 ? 'expiring' : 'muted',
    }
  }
  if (days === null) {
    return { type: 'open', label: 'Open' }
  }
  if (days < 0) {
    return { type: 'expired', label: 'Expired' }
  }
  if (days === 0) {
    return { type: 'expiring', label: 'Expires today' }
  }
  if (days <= 30 || warned) {
    return { type: 'expiring', label: `${days}d left` }
  }
  return { type: 'open', label: formatTimeLeft(days) }
}

// The products the Expiring button surfaces, soonest first. Two ways in:
// anything still ahead of its printed date but less than 12 months out, and
// sealed products already past it — those keep their Sealed badge and stay in
// their category rather than dropping into the Expired section, so this list
// is the only place they'd ever be noticed. An opened product past its date is
// left out: the Expired section already has it. So are used-up products.
export function getExpiringSoon(products) {
  const today = todayISO()
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setMonth(cutoff.getMonth() + 12)
  const limit = toISODate(cutoff)
  return products
    .filter(p => {
      if (p.emptiedAt || !p.expirationDate) return false
      if (p.expirationDate < today) return !p.openingDate
      return p.expirationDate < limit
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
}

// Digits typed into a DD/MM/YYYY box, re-slashed as they arrive, so manual
// entry never fights the separators.
export function maskDateInput(raw) {
  const text = (raw || '').replace(/[^0-9\/]/g, '')
  if (!text.includes('/')) {
    const digits = text.slice(0, 8)
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
  }
  // Separators the user typed decide where each segment ends, so '2/4/2027'
  // stays the 2nd of April rather than being re-cut into '24/20/27'. Digits
  // past a segment's width spill into the next one, so pasting or typing on
  // past a slash can't wedge the field.
  const chunks = text.split('/')
  const out = []
  let spill = ''
  for (let i = 0; i < 3; i++) {
    const width = i === 2 ? 4 : 2
    const seg = spill + (chunks[i] ?? '')
    spill = seg.slice(width)
    out.push(seg.slice(0, width))
    if (chunks.length <= i + 1 && !spill) break
  }
  return out.join('/')
}

// 'DD/MM/YYYY' -> 'YYYY-MM-DD', or null when it isn't a real calendar day.
// A single-digit day or month is accepted — blur rewrites the box from the
// stored value, so '2/4/2027' becomes '02/04/2027' as soon as you leave it.
// The round-trip check is what rejects 31/02 and friends, which Date happily
// rolls over into the next month.
export function parseDisplayDate(text) {
  const m = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/.exec((text || '').trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m.map(Number)
  const d = new Date(yyyy, mm - 1, dd)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null
  return toISODate(d)
}

// Monday-first week containing `dateStr`, as inclusive ISO bounds. Matches
// getMonthGrid's Monday-first convention so the Tasks tracker's "this week"
// lines up with what the calendars already draw.
export function getWeekRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const offset = (d.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: toISODate(start), end: toISODate(end) }
}

// 'YYYY-MM-DD' -> 'YYYY-MM', the grouping key for the Future section's
// month buckets. String-sortable, so ascending month order is a plain sort.
export function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7)
}

export function formatMonthKey(key) {
  const [y, m] = key.split('-').map(Number)
  return formatMonthYear(y, m - 1)
}

// Short relative wording for an overdue task — how late it already is
export function formatOverdue(dateStr) {
  const days = -getDaysUntil(dateStr)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d late`
  if (days < 30) return `${Math.floor(days / 7)}w late`
  return `${Math.floor(days / 30)}mo late`
}

// The date as it reads on a task row. Dates in the current year keep the
// weekday and drop the year — the row is narrow and the year is noise for
// anything you're actually planning; other years fall back to the
// unambiguous numeric form so a 2025 task can't be mistaken for a 2026 one.
export function formatTaskDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.getFullYear() === new Date().getFullYear()
    ? formatDayHeading(dateStr)
    : formatDisplayDate(dateStr)
}

// 'past' | 'today' | 'future' — the only thing that colours a task's date.
// Plain string compare: both sides are ISO days, so no Date objects and no
// timezone to get wrong.
export function dateTone(dateStr, today) {
  if (!dateStr) return null
  if (dateStr < today) return 'past'
  if (dateStr > today) return 'future'
  return 'today'
}
