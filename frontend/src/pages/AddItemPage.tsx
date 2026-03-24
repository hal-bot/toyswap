import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createItem } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ItemType, ItemCondition, AgeLevel } from '../types/api';

export default function AddItemPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    type: '',
    condition: 'new' as ItemCondition,
    ageLevel: '',
    requireBatteries: false,
    description: '',
    imageUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [target.name]: target.type === 'checkbox' ? target.checked : target.value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      await createItem(
        {
          name: form.name,
          type: (form.type || 'misc') as ItemType,
          condition: form.condition,
          ageLevel: (form.ageLevel || 'child') as AgeLevel,
          requireBatteries: form.requireBatteries,
          imageUrl: form.imageUrl || undefined,
        },
        user.userId,
      );
      navigate('/');
    } catch {
      setError('Uh oh! We could not add your toy. Please try again!');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="topbar">
        <span className="logo">
          T<span className="flip">o</span>ySwa<span className="flip">p</span>
        </span>
        <div className="nav-actions">
          <button
            className="btn btn-yellow"
            style={{ fontSize: '1rem' }}
            onClick={() => navigate('/')}
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="page">
        <div className="auth-box" style={{ maxWidth: 540, margin: '2rem auto' }}>
          <h1 style={{ textAlign: 'center', color: 'var(--crayon-orange)' }}>
            Add a T<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>o</span>y! 🧸
          </h1>
          <p
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-heading)',
              color: '#5d4037',
              marginTop: 0,
            }}
          >
            Tell us about the toy you want to swap!
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Toy Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. LEGO Star Wars Set"
              />
            </div>

            <div className="form-group">
              <label htmlFor="type">Toy Type</label>
              <input
                id="type"
                name="type"
                type="text"
                value={form.type}
                onChange={handleChange}
                placeholder="e.g. Action Figure"
              />
            </div>

            <div className="form-group">
              <label htmlFor="condition">Condition</label>
              <select
                id="condition"
                name="condition"
                value={form.condition}
                onChange={handleChange}
                required
              >
                <option value="new">Brand New</option>
                <option value="lite wear">Lite Wear</option>
                <option value="medium wear">Medium Wear</option>
                <option value="heavy wear">Heavy Wear</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ageLevel">Age Level</label>
              <input
                id="ageLevel"
                name="ageLevel"
                type="text"
                value={form.ageLevel}
                onChange={handleChange}
                placeholder="e.g. 5+"
              />
            </div>

            <div className="form-group">
              <div className="checkbox-row">
                <input
                  id="requireBatteries"
                  name="requireBatteries"
                  type="checkbox"
                  checked={form.requireBatteries}
                  onChange={handleChange}
                />
                <label htmlFor="requireBatteries">Requires Batteries 🔋</label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <input
                id="description"
                name="description"
                type="text"
                value={form.description}
                onChange={handleChange}
                placeholder="Tell us about your toy"
              />
            </div>

            <div className="form-group">
              <label htmlFor="imageUrl">Image URL</label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="text"
                value={form.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <button
              type="submit"
              className="btn btn-orange"
              disabled={loading}
              style={{ width: '100%', fontSize: '1.3rem' }}
            >
              {loading ? 'Adding...' : 'Add My Toy!'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
