import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
const KEY = 'shop_cart';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ }
  }, [lines]);

  const value = useMemo(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    add: (product, quantity = 1) => setLines((ls) => {
      const found = ls.find((l) => l.productId === product._id);
      if (found) return ls.map((l) => (l === found ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l));
      return [...ls, { productId: product._id, name: product.name, category: product.category, price: product.price, quantity }];
    }),
    setQuantity: (productId, quantity) => setLines((ls) =>
      ls.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) } : l))),
    remove: (productId) => setLines((ls) => ls.filter((l) => l.productId !== productId)),
    clear: () => setLines([]),
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
