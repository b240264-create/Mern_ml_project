import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import useInsights from '../hooks/useInsights';
import OfferBanner from '../components/OfferBanner';
import { api, money } from '../api';

const SHIPPING_FLAT = 5;
const FREE_SHIPPING_OVER = 50;

// Mirrors server/src/routes/orders.js so the cart can preview what checkout will charge.
// The server recomputes everything at checkout, so this is only an estimate.
function estimate(offer, subtotal) {
  const pct = /^(\d+)% discount$/.exec(offer || '');
  const discount = pct ? Math.round(subtotal * Number(pct[1])) / 100 : 0;
  const shipping = subtotal >= FREE_SHIPPING_OVER || offer === 'Free shipping' ? 0 : SHIPPING_FLAT;
  return { discount, shipping };
}

export default function Cart() {
  const { lines, subtotal, setQuantity, remove, clear } = useCart();
  const { user } = useAuth();
  const { data } = useInsights();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (lines.length === 0) return <><h1>Your cart</h1><p className="muted">Your cart is empty. <Link to="/products">Browse the shop</Link>.</p></>;

  const offer = data && !data.fallback ? data.offer : null;
  const { discount, shipping } = estimate(offer, subtotal);
  const total = subtotal - discount + shipping;

  const placeOrder = async () => {
    if (!user) return navigate('/login', { state: { from: '/cart' } });
    setBusy(true); setError(null);
    try {
      const order = await api('/orders', { method: 'POST', body: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) } });
      clear();
      navigate('/orders', { state: { placedId: order._id } });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Your cart</h1>
      {user && <OfferBanner offer={offer} segment={data && data.segment} />}
      <div className="cart">
        <div>
          {lines.map((l) => (
            <div className="line" key={l.productId}>
              <div>
                <Link to={`/products/${l.productId}`}><strong>{l.name}</strong></Link>
                <div className="muted small">{money(l.price)} each</div>
              </div>
              <input type="number" min="1" max="20" value={l.quantity} aria-label={`Quantity of ${l.name}`}
                onChange={(e) => setQuantity(l.productId, Number(e.target.value) || 1)} />
              <div className="line-total">{money(l.price * l.quantity)}</div>
              <button className="link" onClick={() => remove(l.productId)}>Remove</button>
            </div>
          ))}
        </div>
        <aside className="summary">
          <div className="sum-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {discount > 0 && <div className="sum-row ok"><span>{offer}</span><span>-{money(discount)}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{shipping === 0 ? 'Free' : money(shipping)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{money(total)}</span></div>
          <p className="muted small">Free shipping over {money(FREE_SHIPPING_OVER)}. The final price is calculated when you place the order.</p>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} onClick={placeOrder}>{busy ? 'Placing order...' : user ? 'Place order' : 'Log in to order'}</button>
        </aside>
      </div>
    </>
  );
}
