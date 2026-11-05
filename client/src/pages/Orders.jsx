import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, money } from '../api';

export default function Orders() {
  const { state } = useLocation();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!orders) return <p className="muted">Loading...</p>;

  return (
    <>
      <h1>Your orders</h1>
      {state && state.placedId && <p className="success">Thank you! Your order was placed.</p>}
      {orders.length === 0 && <p className="muted">No orders yet. <Link to="/products">Start shopping</Link>.</p>}
      {orders.map((o) => (
        <article className={`order ${state && state.placedId === o._id ? 'order-new' : ''}`} key={o._id}>
          <header>
            <strong>{new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
            <span className="muted small">#{o._id.slice(-6)}</span>
            <span className="status">{o.status}</span>
            <strong className="push">{money(o.total)}</strong>
          </header>
          <ul>
            {o.items.map((i) => (
              <li key={i.product}><Link to={`/products/${i.product}`}>{i.name}</Link> × {i.quantity} <span className="muted">{money(i.price)}</span></li>
            ))}
          </ul>
          {(o.discount > 0 || o.offerApplied) && (
            <p className="muted small">
              {o.discount > 0 && <>Saved {money(o.discount)}. </>}
              {o.offerApplied && <>Offer: {o.offerApplied}.</>}
            </p>
          )}
        </article>
      ))}
    </>
  );
}
