import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import OfferBanner from './OfferBanner';
import useInsights from '../hooks/useInsights';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

// Logged in  -> products picked by the ML model for this customer (+ their offer)
// Logged out -> popular products, with a nudge to log in
export default function PersonalizedShelf() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading, error } = useInsights();
  const [popular, setPopular] = useState([]);

  const needPopular = !authLoading && (!user || error || (data && data.fallback));
  useEffect(() => {
    if (needPopular) api('/insights/popular').then(setPopular).catch(() => setPopular([]));
  }, [needPopular]);

  if (authLoading || (user && loading)) return <p className="muted">Finding picks for you...</p>;

  if (user && data && !data.fallback) {
    return (
      <section>
        <OfferBanner offer={data.offer} segment={data.segment} />
        <h2>Recommended for you</h2>
        <p className="muted">
          Picked by our model because you are in the <strong>{data.segment}</strong> group
          {data.segment === 'New' ? ' (no orders yet, so these are bestsellers)' : ' and based on what you bought before'}.
        </p>
        <div className="grid">{data.recommendations.map(({ product }) => <ProductCard key={product._id} product={product} />)}</div>
      </section>
    );
  }

  return (
    <section>
      <h2>Popular right now</h2>
      {!user && <p className="muted"><Link to="/login">Log in</Link> to see picks chosen for you.</p>}
      {user && <p className="muted">Personal picks are unavailable at the moment, so here are our bestsellers.</p>}
      <div className="grid">{popular.map((p) => <ProductCard key={p._id} product={p} />)}</div>
    </section>
  );
}
