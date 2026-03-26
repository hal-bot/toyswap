import type { Item } from '../types/api';

interface ItemCardProps {
  item: Item;
  actionLabel?: string;
  onAction?: (item: Item) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (item: Item) => void;
}

const TYPE_COLORS: Record<string, string> = {
  toy: '#f7c948',
  book: '#4a90d9',
  misc: '#9b59b6',
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'Brand New',
  'lite wear': 'Lite Wear',
  'medium wear': 'Medium Wear',
  'heavy wear': 'Heavy Wear',
};

function itemImageUrl(name: string): string {
  return `https://source.unsplash.com/300x200/?${encodeURIComponent(name + ',toy')}`;
}

function fallbackSvg(type: string): string {
  const color = TYPE_COLORS[type] ?? '#ccc';
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
    <rect width="300" height="200" fill="${color}" rx="8"/>
    <text x="150" y="110" font-size="48" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export default function ItemCard({
  item,
  actionLabel,
  onAction,
  selectable,
  selected,
  onSelect,
}: ItemCardProps) {
  const handleClick = () => {
    if (selectable && onSelect) onSelect(item);
  };

  const classNames = ['card', selectable ? 'selectable' : '', selected ? 'selected' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onClick={handleClick}
      style={{ cursor: selectable ? 'pointer' : 'default' }}
    >
      <img
        src={item.imageUrl || itemImageUrl(item.name)}
        alt={item.name}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackSvg(item.type);
        }}
      />
      <h3>{item.name}</h3>
      <div>
        <span className="badge" style={{ background: TYPE_COLORS[item.type] ?? '#ccc' }}>
          {item.type}
        </span>
        <span className="badge">{item.ageLevel}</span>
      </div>
      <div style={{ fontSize: '0.9rem' }}>
        <strong>Condition:</strong> {CONDITION_LABELS[item.condition] ?? item.condition}
      </div>
      {item.requireBatteries && (
        <div style={{ fontSize: '0.85rem', color: '#e65100' }}>🔋 Needs batteries</div>
      )}
      {actionLabel && onAction && (
        <button
          className="btn btn-green"
          style={{ marginTop: '0.5rem', width: '100%' }}
          onClick={(e) => {
            e.stopPropagation();
            onAction(item);
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
