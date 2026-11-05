import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate((state && state.from) || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="auth" onSubmit={submit}>
      <h1>{isRegister ? 'Create account' : 'Log in'}</h1>
      {isRegister && <label>Name<input value={form.name} onChange={set('name')} required autoComplete="name" /></label>}
      <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
      <label>Password<input type="password" value={form.password} onChange={set('password')} required minLength={6} autoComplete={isRegister ? 'new-password' : 'current-password'} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}</button>
      <p className="muted small">
        {isRegister ? <>Already have an account? <Link to="/login" state={state}>Log in</Link></> : <>New here? <Link to="/register" state={state}>Create an account</Link></>}
      </p>
      {!isRegister && <p className="muted small">Demo: <code>champion@demo.com</code> / <code>password123</code></p>}
    </form>
  );
}
