const COPY = {
  '10% discount': 'Take 10% off your order. Applied automatically at checkout.',
  '20% discount': 'Take 20% off your order. Applied automatically at checkout.',
  'Free shipping': 'Free shipping on your next order. Applied automatically at checkout.',
  'Loyalty points': 'Thanks for shopping with us! Loyalty points are added to your order.',
  'Bundle deal': 'Bundle deal: mix and match your favourites.',
};

export default function OfferBanner({ offer, segment }) {
  if (!offer || offer === 'No offer') return null;
  return (
    <div className="offer">
      <span className="offer-tag">Your offer</span>
      <strong>{offer}</strong>
      <span className="muted">{COPY[offer] || ''}</span>
      {segment && <span className="seg-badge">{segment}</span>}
    </div>
  );
}
