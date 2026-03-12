import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllItems, getItemsByOwner } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ItemCard from '../components/ItemCard';
import SwapModal from '../components/SwapModal';
import type { Item } from '../types/api';

const PAGE_SIZE = 20;

export default function ItemSwapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allItems, setAllItems] = useState<Item[]>([]);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedTarget, setSelectedTarget] = useState<Item | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([getAllItems(), getItemsByOwner(user.userId)])
      .then(([all, mine]) => {
        // Only show other users' active items (API already filters active=true, but filter owner too)
        const available = all.filter((item) => item.currentOwner !== user.userId);
        setAllItems(available);
        setUserItems(mine);
      })
      .catch(() => {
        setAllItems([]);
        setUserItems([]);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const totalPages = Math.ceil(allItems.length / PAGE_SIZE);
  const visibleItems = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSwapComplete(offerItemId: number, requestItemId: number) {
    // Remove both swapped items from lists
    setAllItems((prev) => prev.filter((i) => i.id !== offerItemId && i.id !== requestItemId));
    setUserItems((prev) => prev.filter((i) => i.id !== offerItemId));
    setSelectedTarget(null);
  }

  return (
    <>
      <nav className="topbar">
        <span className="logo">
          T<span className="flip">o</span>ySwa<span className="flip">p</span>
        </span>
        <div className="nav-actions">
          <button className="btn btn-yellow" style={{ fontSize: '1rem' }} onClick={() => navigate('/')}>
            ← My Toys
          </button>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <h1>
            Toys to Swa<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>p</span>! 🎁
          </h1>
        </div>

        {loading ? (
          <p className="empty-msg">Loading toys...</p>
        ) : allItems.length === 0 ? (
          <div className="empty-msg">No toys available to swap right now. Check back soon!</div>
        ) : (
          <>
            <div className="item-grid">
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  actionLabel="Swap! 🔄"
                  onAction={(item) => setSelectedTarget(item)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedTarget && (
        <SwapModal
          targetItem={selectedTarget}
          userItems={userItems}
          onClose={() => setSelectedTarget(null)}
          onSwapComplete={handleSwapComplete}
        />
      )}
    </>
  );
}
