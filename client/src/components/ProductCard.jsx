import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProductTile from './ProductTile';
import { useCart } from '../context/CartContext';
import { money } from '../api';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const onAdd = () => {
    add(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="card">
      <Link to={`/products/${product._id}`} className="card-link">
        <ProductTile category={product.category} />
        <div className="card-body">
          <div className="muted small">{product.category}</div>
          <h3>{product.name}</h3>
          <div className="price">{money(product.price)}</div>
        </div>
      </Link>
      <button className={`btn ${added ? 'btn-ok' : ''}`} onClick={onAdd}>{added ? 'Added ✓' : 'Add to cart'}</button>
    </article>
  );
}
