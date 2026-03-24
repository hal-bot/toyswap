import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CreateAccountPage from './CreateAccountPage';
import { server } from '../test/handlers';
import { createSwapperConflict } from '../test/handlers';

function renderCreateAccountPage() {
  return render(
    <MemoryRouter initialEntries={['/create-account']}>
      <Routes>
        <Route path="/create-account" element={<CreateAccountPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CreateAccountPage', () => {
  it('renders all required fields', () => {
    renderCreateAccountPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('zip code field is present but not required', () => {
    renderCreateAccountPage();
    const zipInput = screen.getByLabelText(/zip code/i);
    expect(zipInput).toBeInTheDocument();
    expect(zipInput).not.toBeRequired();
  });

  it('on successful submit navigates to /login', async () => {
    renderCreateAccountPage();
    await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
    await userEvent.type(screen.getByLabelText(/first name/i), 'Bob');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Jones');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /let's go/i }));

    // After successful creation the page navigates away — the form disappears
    await waitFor(() => expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument());
  });

  it('on 409 response shows "username already taken" error', async () => {
    server.use(createSwapperConflict);
    renderCreateAccountPage();
    await userEvent.type(screen.getByLabelText(/username/i), 'existinguser');
    await userEvent.type(screen.getByLabelText(/first name/i), 'Bob');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Jones');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /let's go/i }));

    await waitFor(() => expect(screen.getByText(/already taken/i)).toBeInTheDocument());
  });

  it('submit button is disabled while request is in flight', async () => {
    renderCreateAccountPage();
    await userEvent.type(screen.getByLabelText(/username/i), 'newuser');
    await userEvent.type(screen.getByLabelText(/first name/i), 'Bob');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Jones');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');

    const button = screen.getByRole('button', { name: /let's go/i });
    userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
  });
});
