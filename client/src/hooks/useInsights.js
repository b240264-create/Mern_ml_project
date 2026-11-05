import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Personalised insights for the logged-in user (segment, purchase probability, offer, recommendations).
// Logged-out visitors get null.
export default function useInsights() {
  const { user } = useAuth();
  const [state, setState] = useState({ data: null, loading: false, error: null });

  const load = useCallback((signal) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api('/insights/me', { signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ data: null, loading: false, error }); });
  }, []);

  useEffect(() => {
    if (!user) { setState({ data: null, loading: false, error: null }); return undefined; }
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [user, load]);

  return { ...state, reload: () => load() };
}
