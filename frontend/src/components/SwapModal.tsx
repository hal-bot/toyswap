import { useState } from 'react';
import { completeSwap } from '../api/client';
import ItemCard from './ItemCard';
import type { Item } from '../types/api';

interface SwapModalProps {
  targetItem: Item;
  userItems: Item[];
  onClose: () => void;
  onSwapComplete: (offerItemId: number, requestItemId: number, receivedItem: Item) => void;
}

export default function SwapModal({ targetItem, userItems, onClose, onSwapComplete }: SwapModalProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [error, setError] = useState('');

  async function handleCompleteSwap() {
    if (!selectedItem?.id || !targetItem.id) return;
    setLoading(true);
    setError('');
    try {
      await completeSwap({ offerItemId: selectedItem.id, requestItemId: targetItem.id });
      setSwapped(true);
    } catch {
      setError('Something went wrong with the swap. Please try again!');
    } finally {
      setLoading(false);
    }
  }

  function handleSuccessClose() {
    onSwapComplete(selectedItem!.id!, targetItem.id!, targetItem);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {swapped ? (
          <div style={{ textAlign: 'center' }}>
            <div className="success-banner">
              Toy swapped! 🎉<br />
              <span style={{ fontSize: '1rem', display: 'block', marginTop: '0.5rem' }}>
                You traded for <strong>{targetItem.name}</strong>!
              </span>
            </div>
            <button className="btn btn-green" style={{ marginTop: '1.2rem' }} onClick={handleSuccessClose}>
              Awesome!
            </button>
          </div>
        ) : (
          <>
            <h2>
              Pick a toy to swap for <em>{targetItem.name}</em>!
            </h2>
            <p style={{ fontFamily: 'var(--font-heading)', color: '#5d4037' }}>
              Click one of your toys to select it, then hit Complete Swap!
            </p>

            {error && <div className="error-msg">{error}</div>}

            {userItems.length === 0 ? (
              <div className="error-msg">You don't have any items to swap!</div>
            ) : (
              <div className="item-grid" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                {userItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    selectable
                    selected={selectedItem?.id === item.id}
                    onSelect={setSelectedItem}
                  />
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                Never mind
              </button>
              <button
                className="btn btn-green"
                disabled={!selectedItem || loading}
                onClick={handleCompleteSwap}
              >
                {loading ? 'Swapping...' : '✅ Complete Swap'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
