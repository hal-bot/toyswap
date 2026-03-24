import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getItemsByOwner } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ItemCard from '../components/ItemCard';
import type { Item } from '../types/api';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapError, setSwapError] = useState('');

  useEffect(() => {
    if (!user) return;
    getItemsByOwner(user.userId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  function handleSwapClick() {
    if (items.length === 0) {
      setSwapError('You need to add items before you can swap!');
    } else {
      setSwapError('');
      navigate('/swap');
    }
  }

  return (
    <>
      <nav className="topbar">
        <span className="logo">
          T<span className="flip">o</span>ySwa<span className="flip">p</span>
        </span>
        <div className="nav-actions">
          <Link to="/add-item" className="btn btn-yellow" style={{ fontSize: '1rem' }}>
            Add Item
          </Link>
          <Link to="/swap" className="btn btn-green" style={{ fontSize: '1rem' }}>
            Swap
          </Link>
          <button className="btn btn-red" style={{ fontSize: '1rem' }} onClick={logout}>
            Log Out
          </button>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <h1>Hey, {user?.firstName}! 👋</h1>
          <button
            className="btn btn-green"
            style={{ fontSize: '1.2rem' }}
            onClick={handleSwapClick}
          >
            Swap Toys! 🔄
          </button>
        </div>

        {swapError && <div className="error-msg">{swapError}</div>}

        <h2 style={{ color: 'var(--crayon-blue)', marginBottom: '0.25rem' }}>
          Your T<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>o</span>ys
        </h2>

        {loading ? (
          <p className="empty-msg">Loading your toys...</p>
        ) : items.length === 0 ? (
          <div className="empty-msg">
            You don't have any toys listed yet! Add some toys to start swapping.
          </div>
        ) : (
          <div className="item-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
