import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'

const API = 'https://dummyjson.com'

function StarRating({ rating }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`star ${i < Math.round(rating) ? 'filled' : ''}`}>★</span>
      ))}
      <span className="star-num">{rating.toFixed(1)}</span>
    </span>
  )
}

function ProductCard({ product, onAddToCart, onOpenDetail }) {
  const discount = Math.round(product.discountPercentage)
  return (
    <div className="product-card" onClick={() => onOpenDetail(product)}>
      <div className="card-img-wrap">
        <img src={product.thumbnail} alt={product.title} loading="lazy" />
        {discount > 0 && <span className="discount-badge">-{discount}%</span>}
      </div>
      <div className="card-body">
        <span className="card-category">{product.category}</span>
        <span className="card-title">{product.title}</span>
        <StarRating rating={product.rating} />
        <div className="card-footer">
          <span className="card-price">${product.price.toFixed(2)}</span>
          <button
            className="btn-cart"
            onClick={(e) => { e.stopPropagation(); onAddToCart(product) }}
          >+ Cart</button>
        </div>
      </div>
    </div>
  )
}

function CartSidebar({ open, cart, onRemove, onClose }) {
  const total = useMemo(() => cart.reduce((s, i) => s + i.price, 0), [cart])
  return (
    <>
      {open && <div className="cart-overlay" onClick={onClose} />}
      <div className={`cart-sidebar ${open ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Cart ({cart.length})</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">🛒</div>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="cart-item">
                  <img src={item.thumbnail} alt={item.title} />
                  <div className="cart-item-info">
                    <div className="cart-item-title">{item.title}</div>
                    <div className="cart-item-price">${item.price.toFixed(2)}</div>
                  </div>
                  <button className="cart-remove" onClick={() => onRemove(idx)}>✕</button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <button className="btn-checkout">Checkout</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function ProductModal({ product, onClose, onAddToCart }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!product) return
    setLoading(true)
    fetch(`${API}/products/${product.id}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => { setDetail(product); setLoading(false) })
  }, [product?.id])

  if (!product) return null
  const p = detail || product
  const discount = Math.round(p.discountPercentage)

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        {loading ? (
          <div className="modal-loading">Loading…</div>
        ) : (
          <div className="modal-content">
            <div className="modal-imgs">
              <img src={p.thumbnail} alt={p.title} className="modal-main-img" />
              {p.images?.length > 1 && (
                <div className="modal-imgs-strip">
                  {p.images.slice(0, 4).map((img, i) => (
                    <img key={i} src={img} alt="" className="modal-thumb" />
                  ))}
                </div>
              )}
            </div>
            <div className="modal-info">
              <span className="modal-category">{p.category}</span>
              <h2>{p.title}</h2>
              <StarRating rating={p.rating} />
              <p className="modal-desc">{p.description}</p>
              <div className="modal-meta">
                <p><strong>Brand:</strong> {p.brand || 'N/A'}</p>
                <p><strong>Stock:</strong> <span className={p.stock < 10 ? 'low-stock' : ''}>{p.stock} units</span></p>
                <p><strong>SKU:</strong> {p.sku || p.id}</p>
              </div>
              <div className="modal-price">
                ${p.price.toFixed(2)}
                {discount > 0 && <span className="modal-discount"> {discount}% off</span>}
              </div>
              <button
                className="btn-checkout"
                style={{ marginTop: '12px' }}
                onClick={() => { onAddToCart(p); onClose() }}
              >Add to Cart</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function App() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [eventCount, setEventCount] = useState(0)
  const searchTimer = useRef(null)

  const fetchProducts = useCallback(async (query, category) => {
    setLoading(true)
    setError(null)
    try {
      let url
      if (query) url = `${API}/products/search?q=${encodeURIComponent(query)}&limit=40`
      else if (category) url = `${API}/products/category/${encodeURIComponent(category)}?limit=40`
      else url = `${API}/products?limit=40`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products ?? [])
      setEventCount(c => c + 1)
    } catch (e) {
      setError(`Failed to load products: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/products/categories`)
      const data = await res.json()
      setCategories(data.map(c => typeof c === 'string' ? c : c.slug).slice(0, 16))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchProducts('', ''); fetchCategories() }, [fetchProducts, fetchCategories])

  const handleSearch = useCallback((e) => {
    const q = e.target.value
    setSearch(q)
    setSelectedCat('')
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchProducts(q, ''), 400)
  }, [fetchProducts])

  const handleCategory = useCallback((cat) => {
    const next = cat === selectedCat ? '' : cat
    setSelectedCat(next)
    setSearch('')
    fetchProducts('', next)
  }, [selectedCat, fetchProducts])

  const addToCart = useCallback((product) => {
    setCart(prev => [...prev, product])
    setCartOpen(true)
    setEventCount(c => c + 1)
  }, [])

  const removeFromCart = useCallback((idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx))
    setEventCount(c => c + 1)
  }, [])

  const cartCount = cart.length

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="brand-icon">⬡</span>
          <div>
            <h1>ShopLens</h1>
            <span className="brand-sub">React + Render-Proxy Tracer</span>
          </div>
        </div>
        <div className="header-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={handleSearch}
          />
          {search && <button className="search-clear" onClick={() => { setSearch(''); fetchProducts('', selectedCat) }}>✕</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span className="event-badge">⬡ {eventCount} events</span>
          <button className="cart-toggle" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">Categories</div>
          <button
            className={`cat-btn ${!selectedCat ? 'active' : ''}`}
            onClick={() => handleCategory('')}
          >All Products</button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`cat-btn ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => handleCategory(cat)}
            >{cat}</button>
          ))}
        </aside>

        <main className="main">
          {error ? (
            <div className="error-state">
              <div className="empty-icon">⚠️</div>
              <p>{error}</p>
              <button onClick={() => fetchProducts(search, selectedCat)}>Retry</button>
            </div>
          ) : loading ? (
            <div className="grid skeleton-grid">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton-card" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No products match "{search}"</p>
              <button onClick={() => { setSearch(''); fetchProducts('', '') }}>Clear search</button>
            </div>
          ) : (
            <>
              <div className="results-bar">
                <span className="results-label">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                  {selectedCat && <span className="results-hint"> in {selectedCat}</span>}
                  {search && <span className="results-hint"> for "{search}"</span>}
                </span>
              </div>
              <div className="grid">
                {products.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAddToCart={addToCart}
                    onOpenDetail={setSelectedProduct}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <CartSidebar
        open={cartOpen}
        cart={cart}
        onRemove={removeFromCart}
        onClose={() => setCartOpen(false)}
      />

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}
    </div>
  )
}
