import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">Giftly</Link>
        <nav className="nav-links">
          <NavLink to="/products">Shop</NavLink>
          {user && <NavLink to="/orders">Orders</NavLink>}
          {user && <NavLink to="/account">For you</NavLink>}
          <NavLink to="/cart">Cart{count > 0 && <span className="pill">{count}</span>}</NavLink>
          {user ? (
            <button className="link" onClick={() => { logout(); navigate('/'); }}>Log out ({user.name.split(' ')[0]})</button>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
