import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login as apiLogin } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const swapper = await apiLogin({ username, password });
      login(swapper);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 401) {
        setError("Oops! That username or password didn't work.");
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
        <h1>
          T<span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>o</span>ySwap
        </h1>
        <p className="subtitle">Where toys find new friends! 🧸</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="e.g. coolmom42"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-blue"
            disabled={loading}
            style={{ width: '100%', fontSize: '1.3rem' }}
          >
            {loading ? 'Logging in...' : 'Log In!'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontFamily: 'var(--font-heading)' }}>
          New here?{' '}
          <Link to="/create-account" style={{ color: 'var(--crayon-red)', fontWeight: 'bold' }}>
            Make an account!
          </Link>
        </p>
      </div>
    </div>
  );
}
