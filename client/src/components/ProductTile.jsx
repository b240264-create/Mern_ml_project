// The demo has no product photos, so each category gets a coloured tile with an emoji.
const LOOK = {
  Kitchen: { emoji: '🍳', hue: 28 },
  Stationery: { emoji: '✏️', hue: 215 },
  Toys: { emoji: '🧸', hue: 330 },
  Garden: { emoji: '🌿', hue: 140 },
  Gifts: { emoji: '🎁', hue: 275 },
  Electronics: { emoji: '🎧', hue: 190 },
};

export default function ProductTile({ category, size = 'md' }) {
  const { emoji, hue } = LOOK[category] || { emoji: '🛍️', hue: 220 };
  return (
    <div
      className={`tile tile-${size}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 88%), hsl(${hue} 65% 76%))` }}
      role="img"
      aria-label={category}
    >
      <span>{emoji}</span>
    </div>
  );
}
