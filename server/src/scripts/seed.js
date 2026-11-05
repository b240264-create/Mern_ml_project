// Fills MongoDB with a demo catalogue, customers and ~2 years of order history so the ML model has
// something real to learn from.   Usage:  npm run seed
//
// Customers come in four behaviour types (the clusters the model should rediscover):
//   champion  - many orders, recent      regular - steady      occasional - few orders      lapsed - bought long ago
// Each customer also prefers one product category, which is what the recommender picks up on.
//
// Demo logins (password for all: password123):
//   champion@demo.com  regular@demo.com  lapsed@demo.com  new@demo.com (no orders = cold start)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

const N_CUSTOMERS = Number(process.env.SEED_CUSTOMERS || 400);
const DAY = 24 * 60 * 60 * 1000;
const SPAN_DAYS = 540;

// ---- tiny seeded PRNG so every run produces the same data
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const rint = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function weightedSample(items, weights, k) {
  const chosen = new Set();
  const w = [...weights];
  while (chosen.size < Math.min(k, items.length)) {
    const total = w.reduce((s, x) => s + x, 0);
    let r = rand() * total;
    let i = 0;
    while (i < w.length - 1 && (r -= w[i]) > 0) i++;
    chosen.add(i); w[i] = 0;
    if (w.every((x) => x === 0)) break;
  }
  return [...chosen].map((i) => items[i]);
}

// ---- catalogue
const CATALOG = {
  Kitchen:     { price: [6, 45],  adj: ['Ceramic', 'Bamboo', 'Steel', 'Glass', 'Silicone', 'Copper'], nouns: ['Mug', 'Cutting Board', 'Spice Rack', 'Teapot', 'Mixing Bowl', 'Pan', 'Whisk', 'Storage Jar', 'Kettle', 'Colander'] },
  Stationery:  { price: [2, 25],  adj: ['Leather', 'Recycled', 'Pastel', 'Classic', 'Pocket', 'Grid'],             nouns: ['Notebook', 'Pen Set', 'Planner', 'Sticky Notes', 'Pencil Case', 'Highlighters', 'Desk Organiser', 'Journal', 'Sketchbook', 'Stapler'] },
  Toys:        { price: [5, 40],  adj: ['Wooden', 'Plush', 'Magnetic', 'Giant', 'Mini', 'Glow-in-the-dark'],      nouns: ['Puzzle', 'Teddy Bear', 'Building Blocks', 'Board Game', 'Yo-yo', 'Train Set', 'Doll House', 'Kite', 'Card Game', 'Racing Car'] },
  Garden:      { price: [4, 60],  adj: ['Terracotta', 'Solar', 'Rustic', 'Hanging', 'Galvanised', 'Folding'],     nouns: ['Plant Pot', 'Watering Can', 'Wind Chime', 'Lantern', 'Bird Feeder', 'Trowel Set', 'Seed Tray', 'Garden Gloves', 'Planter Box', 'Windmill'] },
  Gifts:       { price: [5, 55],  adj: ['Scented', 'Hand-painted', 'Engraved', 'Vintage', 'Festive', 'Luxury'],   nouns: ['Candle', 'Photo Frame', 'Gift Box', 'Keyring', 'Bookmark Set', 'Card Pack', 'Jewellery Box', 'Soap Set', 'Music Box', 'Wrapping Kit'] },
  Electronics: { price: [8, 90],  adj: ['Wireless', 'Portable', 'Mini', 'Smart', 'USB-C', 'Rechargeable'],       nouns: ['Speaker', 'Power Bank', 'Desk Lamp', 'Earbuds', 'Phone Stand', 'Cable Kit', 'Alarm Clock', 'Webcam Cover', 'Charger', 'Torch'] },
};

function buildProducts() {
  const out = [];
  for (const [category, c] of Object.entries(CATALOG)) {
    const combos = shuffle(c.adj.flatMap((a) => c.nouns.map((n) => `${a} ${n}`))).slice(0, 20);
    for (const name of combos) {
      const price = Math.round(c.price[0] + rand() * (c.price[1] - c.price[0])) - 0.01;
      out.push({ name, category, price: Math.max(0.99, price), description: `${name}. A customer favourite from our ${category.toLowerCase()} range.` });
    }
  }
  return out;
}

// ---- customers
const FIRST = ['Aarav', 'Mia', 'Liam', 'Priya', 'Noah', 'Sofia', 'Arjun', 'Emma', 'Kabir', 'Olivia', 'Ravi', 'Zoe', 'Ishaan', 'Ava', 'Vikram', 'Lucy', 'Rohan', 'Chloe', 'Dev', 'Grace'];
const LAST = ['Sharma', 'Smith', 'Patel', 'Brown', 'Singh', 'Jones', 'Gupta', 'Taylor', 'Verma', 'Wilson', 'Mehta', 'Clark', 'Reddy', 'Hall', 'Nair', 'Young', 'Kapoor', 'King', 'Joshi', 'Wright'];
const TYPES = {
  champion:   { orders: [20, 34], daysAgo: [0, SPAN_DAYS],   basket: [2, 6] },
  regular:    { orders: [8, 14],  daysAgo: [0, SPAN_DAYS],   basket: [1, 5] },
  occasional: { orders: [3, 6],   daysAgo: [0, SPAN_DAYS],   basket: [1, 4] },
  lapsed:     { orders: [1, 3],   daysAgo: [380, SPAN_DAYS], basket: [1, 4] },
};
const TYPE_PROBS = [['champion', 0.15], ['regular', 0.3], ['occasional', 0.35], ['lapsed', 0.2]];
const pickType = () => { let r = rand(); for (const [t, p] of TYPE_PROBS) { if ((r -= p) < 0) return t; } return 'occasional'; };

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to', config.mongoUri);
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);

  // ids are generated up front so orders can reference products before anything is written
  const products = buildProducts().map((p) => ({
    ...p,
    _id: new mongoose.Types.ObjectId(crypto.createHash('sha256').update(p.name).digest('hex').slice(0, 24)),
  }));

  const pop = products.map(() => Math.pow(rand(), 3) + 0.03); // a few best-sellers, a long tail
  const categories = Object.keys(CATALOG);
  const passwordHash = bcrypt.hashSync('password123', 10);
  const now = Date.now();

  const customers = [
    { name: 'Champion Demo', email: 'champion@demo.com', type: 'champion', forceRecent: true },
    { name: 'Regular Demo',  email: 'regular@demo.com',  type: 'regular',  forceRecent: true },
    { name: 'Lapsed Demo',   email: 'lapsed@demo.com',   type: 'lapsed' },
    { name: 'New Demo',      email: 'new@demo.com',      type: null },       // no orders: cold start
  ];
  for (let i = 0; i < N_CUSTOMERS; i++) {
    const first = pick(FIRST), last = pick(LAST);
    customers.push({ name: `${first} ${last}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), type: pickType() });
  }

  const users = customers.map((c) => ({ _id: new mongoose.Types.ObjectId(), name: c.name, email: c.email, passwordHash }));

  const orders = [];
  customers.forEach((c, idx) => {
    if (!c.type) return;
    const cfg = TYPES[c.type];
    const favourite = pick(categories);
    const weights = products.map((p, i) => pop[i] * (p.category === favourite ? 4 : 1));
    const nOrders = rint(...cfg.orders);
    for (let k = 0; k < nOrders; k++) {
      let daysAgo = rint(...cfg.daysAgo);
      if (c.forceRecent && k === 0) daysAgo = rint(1, 6);
      const createdAt = new Date(now - daysAgo * DAY - rint(0, 12) * 3600 * 1000);
      const picked = weightedSample(products, weights, rint(...cfg.basket));
      const items = picked.map((p) => ({ product: p._id, name: p.name, quantity: rint(1, 3), price: p.price }));
      const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
      const shipping = subtotal >= 50 ? 0 : 5;
      orders.push({
        user: users[idx]._id, items, subtotal, discount: 0, shipping, total: subtotal + shipping,
        status: daysAgo > 7 ? 'delivered' : 'placed', createdAt,
      });
    }
  });
  // popularity counter used for the "Popular right now" fallback (computed here, written with the products)
  const counts = new Map();
  for (const o of orders) for (const it of o.items) counts.set(String(it.product), (counts.get(String(it.product)) || 0) + it.quantity);
  for (const p of products) p.salesCount = counts.get(String(p._id)) || 0;

  await Product.insertMany(products);
  await User.insertMany(users);
  console.log(`Products: ${products.length}   Users: ${users.length}; inserting ${orders.length} orders ...`);
  for (let i = 0; i < orders.length; i += 500) await Order.insertMany(orders.slice(i, i + 500));

  console.log(`Customers: ${users.length}   Orders: ${orders.length}`);
  console.log('\nDemo logins (password: password123): champion@demo.com, regular@demo.com, lapsed@demo.com, new@demo.com');
  console.log('Next:  npm run export   then train the model (see README).');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
