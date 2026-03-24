import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createAccount } from '../api/client';

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    zipCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createAccount({
        userId: form.username, // userId === username
        username: form.username,
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        zipCode: form.zipCode || undefined,
      });
      navigate('/login');
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 409) {
        setError('That username is already taken, try another one!');
      } else {
        setError('Something went wrong. Please try again!');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 style={{ color: 'var(--crayon-green)' }}>
          Joi<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>n</span> Us!
        </h1>
        <p className="subtitle">Create your ToySwap account 🎉</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={handleChange}
              required
              placeholder="Pick a fun username!"
            />
          </div>
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="zipCode">Zip Code (optional)</label>
            <input
              id="zipCode"
              name="zipCode"
              type="text"
              value={form.zipCode}
              onChange={handleChange}
              placeholder="e.g. 90210"
            />
          </div>
          <button
            type="submit"
            className="btn btn-green"
            disabled={loading}
            style={{ width: '100%', fontSize: '1.3rem' }}
          >
            {loading ? 'Creating...' : "Let's Go!"}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontFamily: 'var(--font-heading)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--crayon-blue)', fontWeight: 'bold' }}>
            Log in!
          </Link>
        </p>
      </div>
    </div>
  );
}
