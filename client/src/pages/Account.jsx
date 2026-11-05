import { Link } from 'react-router-dom';
import useInsights from '../hooks/useInsights';
import OfferBanner from '../components/OfferBanner';
import ProductCard from '../components/ProductCard';

const MEANING = {
  Champions: 'You shop often, recently and spend the most. Our best customers.',
  Loyal: 'You shop regularly and spend well.',
  Potential: 'You have shopped recently and could become a regular.',
  'At-Risk': 'You used to shop more often and have been away for a while.',
  Hibernating: 'You have not shopped for some time and only bought a little.',
  Lost: 'It has been a long time since your last order. We would love to see you back.',
  New: 'You have no orders yet, so we cannot know your taste. Place a first order to unlock personal picks.',
};

export default function Account() {
  const { data, loading, error, reload } = useInsights();

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <p className="error">Could not load your insights. <button className="link" onClick={reload}>Retry</button></p>;
  if (!data) return null;

  if (data.fallback) {
    return (
      <>
        <h1>For you</h1>
        <p className="muted">The recommendation service is not reachable right now. The shop works as normal; personal picks will return when it is back.</p>
        <button className="btn btn-inline" onClick={reload}>Try again</button>
      </>
    );
  }

  const pct = data.purchaseProbability == null ? null : Math.round(data.purchaseProbability * 100);

  return (
    <>
      <h1>For you</h1>
      <p className="muted">This page shows what the model currently knows about you. It updates after every order.</p>

      <div className="insight-grid">
        <section className="panel">
          <div className="muted small">Your customer group (Engine 1: clustering)</div>
          <div className="big-seg">{data.segment}</div>
          <p>{MEANING[data.segment]}</p>
        </section>

        <section className="panel">
          <div className="muted small">Chance you buy in the next 90 days (Engine 2: prediction)</div>
          {pct == null ? <p>Not enough history yet.</p> : (
            <>
              <div className="big-seg">{pct}%</div>
              <div className="meter" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
            </>
          )}
        </section>

        <section className="panel">
          <div className="muted small">Offer chosen for you (Engine 2: offer policy)</div>
          <div className="big-seg">{data.offer}</div>
          <p className="muted small">Applied automatically at checkout when it affects the price.</p>
        </section>
      </div>

      <OfferBanner offer={data.offer} />
      <h2>Your recommendations</h2>
      <div className="grid">{data.recommendations.map(({ product, score }) => (
        <div key={product._id}>
          <ProductCard product={product} />
          {score != null && <div className="muted small center">match score {score.toFixed(2)}</div>}
        </div>
      ))}</div>
      <p className="muted small">Model trained {data.modelTrainedAt ? new Date(data.modelTrainedAt).toLocaleString() : 'at an unknown time'}. <Link to="/products">Browse all products</Link></p>
    </>
  );
}
