import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductTile from '../components/ProductTile';
import { useCart } from '../context/CartContext';
import { api, money } from '../api';

export default function ProductDetail() {
  const { id } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    setProduct(null); setError(null);
    api(`/products/${id}`, { signal: c.signal }).then(setProduct).catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => c.abort();
  }, [id]);

  if (error) return <p className="error">{error} <Link to="/products">Back to shop</Link></p>;
  if (!product) return <p className="muted">Loading...</p>;

  return (
    <div className="detail">
      <ProductTile category={product.category} size="lg" />
      <div>
        <Link to={`/products?category=${product.category}`} className="muted small">{product.category}</Link>
        <h1>{product.name}</h1>
        <div className="price big">{money(product.price)}</div>
        <p>{product.description}</p>
        <div className="row">
          <label>Qty <input type="number" min="1" max="20" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} /></label>
          <button className={`btn btn-inline ${added ? 'btn-ok' : ''}`} onClick={() => { add(product, qty); setAdded(true); setTimeout(() => setAdded(false), 1200); }}>
            {added ? 'Added ✓' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
