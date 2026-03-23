import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../context/AuthContext';
import type { Swapper } from '../types/api';

const mockUser: Swapper = {
  userId: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'asmith',
};

function renderWithAuth(user: Swapper | null, children: React.ReactNode) {
  return render(
    <AuthContext.Provider value={{ user, login: () => {}, logout: () => {} }}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute>{children}</ProtectedRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProtectedRoute', () => {
  it('renders children when user is logged in', () => {
    renderWithAuth(mockUser, <div>Protected Content</div>);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when no user in context', () => {
    renderWithAuth(null, <div>Protected Content</div>);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
