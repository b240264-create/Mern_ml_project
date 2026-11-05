import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { api } from '../api';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [status, setStatus] = useState('loading');
  const [text, setText] = useState(params.get('q') || '');

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'popular';
  const page = Number(params.get('page') || 1);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: 1, ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  useEffect(() => { api('/products/categories').then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    const c = new AbortController();
    setStatus('loading');
    const qs = new URLSearchParams({ sort, page, limit: 12, ...(q && { q }), ...(category && { category }) });
    api(`/products?${qs}`, { signal: c.signal })
      .then((d) => { setResult(d); setStatus('ok'); })
      .catch((e) => { if (e.name !== 'AbortError') setStatus('error'); });
    return () => c.abort();
  }, [q, category, sort, page]);

  return (
    <>
      <h1>Shop</h1>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q: text.trim() }); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search products" aria-label="Search" />
        <select value={category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          <option value="popular">Most popular</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
        <button className="btn btn-inline">Search</button>
      </form>

      {status === 'error' && <p className="error">Could not load products. Is the API running?</p>}
      {status === 'loading' && <p className="muted">Loading...</p>}
      {status === 'ok' && result.items.length === 0 && <p className="muted">No products match your search.</p>}

      <p className="muted small">{result.total} products</p>
      <div className="grid">{result.items.map((p) => <ProductCard key={p._id} product={p} />)}</div>

      {result.pages > 1 && (
        <div className="pager">
          <button className="btn btn-inline" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>Previous</button>
          <span className="muted">Page {result.page} of {result.pages}</span>
          <button className="btn btn-inline" disabled={page >= result.pages} onClick={() => update({ page: page + 1 })}>Next</button>
        </div>
      )}
    </>
  );
}
