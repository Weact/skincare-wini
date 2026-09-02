import { useEffect } from 'react'
import { formatDisplayDate, getDaysUntil } from '../utils/dateUtils'

// Everything with a printed expiry inside the current calendar year, soonest
// first — the list behind the Expiring button. Deliberately flat and sorted
// by date alone, cutting across every category: the question it answers is
// "what runs out next", not "what's in my routine".
export default function ExpiringModal({ products, categories, types, onSelect, onClose }) {
  useEffect(() => {
    function handle(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  const year = new Date().getFullYear()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Expiring in {year}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {products.length === 0 ? (
            <p className="field-hint">
              Nothing in your collection is dated to expire before the end of {year}.
            </p>
          ) : (
            <>
              <p className="field-hint">
                Soonest first. Tap one to open its card.
              </p>
              <ul className="expiring-list">
                {products.map(product => {
                  const days = getDaysUntil(product.expirationDate)
                  const cat = categories.find(c => c.id === product.categoryId)
                  const type = types.find(t => t.id === product.typeId)
                  const place = [cat?.name, type?.name].filter(Boolean).join(' · ')
                  const tone = days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'open'
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="expiring-row"
                        onClick={() => onSelect(product.id)}
                      >
                        {product.photo ? (
                          <img src={product.photo} className="expiring-thumb" alt="" />
                        ) : (
                          <span className="expiring-thumb expiring-thumb--blank">🧴</span>
                        )}
                        <span className="expiring-info">
                          <span className="expiring-name">{product.name || 'Unnamed product'}</span>
                          <span className="expiring-meta">
                            Exp {formatDisplayDate(product.expirationDate)}
                            {place ? ` · ${place}` : ''}
                          </span>
                        </span>
                        <span className={`badge badge--${tone}`}>
                          {days < 0
                            ? `Expired ${-days}d ago`
                            : days === 0
                              ? 'Expires today'
                              : `${days}d left`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
