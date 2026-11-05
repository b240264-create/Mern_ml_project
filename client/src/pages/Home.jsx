import { Link } from 'react-router-dom';
import PersonalizedShelf from '../components/PersonalizedShelf';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Kitchen', 'Stationery', 'Toys', 'Garden', 'Gifts', 'Electronics'];

export default function Home() {
  const { user } = useAuth();
  return (
    <>
      <section className="hero">
        <h1>{user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Everyday finds, picked for you'}</h1>
        <p className="muted">A demo shop where a machine learning model decides who you are as a customer, what you may want next, and which offer to show you.</p>
        <div className="chips">
          {CATEGORIES.map((c) => <Link key={c} className="chip" to={`/products?category=${c}`}>{c}</Link>)}
        </div>
      </section>
      <PersonalizedShelf />
      {!user && (
        <section className="demo-box">
          <h3>Try the demo accounts</h3>
          <p className="muted small">Password for all of them: <code>password123</code></p>
          <ul>
            <li><code>champion@demo.com</code> frequent, recent buyer</li>
            <li><code>regular@demo.com</code> steady buyer</li>
            <li><code>lapsed@demo.com</code> has not bought for over a year</li>
            <li><code>new@demo.com</code> no orders yet (cold start)</li>
          </ul>
        </section>
      )}
    </>
  );
}
