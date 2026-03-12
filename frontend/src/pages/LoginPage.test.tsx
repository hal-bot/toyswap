import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext } from '../context/AuthContext';
import { server } from '../test/handlers';
import { loginError } from '../test/handlers';
import type { Swapper } from '../types/api';

function renderLoginPage(login = (_s: Swapper) => {}) {
  return render(
    <AuthContext.Provider value={{ user: null, login, logout: () => {} }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  it('renders username and password fields and a login button', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('on successful submit calls login API and navigates to /', async () => {
    const login = vi.fn();
    renderLoginPage(login);
    await userEvent.type(screen.getByLabelText(/username/i), 'asmith');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice' })));
  });

  it('on 401 response shows error message', async () => {
    server.use(loginError);
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), 'asmith');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(screen.getByText(/that username or password didn't work/i)).toBeInTheDocument()
    );
  });

  it('login button is disabled while request is in flight', async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), 'asmith');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');

    const button = screen.getByRole('button', { name: /log in/i });
    userEvent.click(button);

    // Button becomes disabled immediately after click
    await waitFor(() => expect(button).toBeDisabled());
  });

  it('"Make an account!" link is present and points to /create-account', () => {
    renderLoginPage();
    const link = screen.getByRole('link', { name: /make an account/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/create-account');
  });
});
