import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AddItemPage from './AddItemPage';
import { AuthContext } from '../context/AuthContext';
import { server } from '../test/handlers';
import { createItemError } from '../test/handlers';
import type { Swapper } from '../types/api';

const mockUser: Swapper = {
  userId: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'asmith',
};

function renderAddItemPage() {
  return render(
    <AuthContext.Provider value={{ user: mockUser, login: () => {}, logout: () => {} }}>
      <MemoryRouter initialEntries={['/add-item']}>
        <Routes>
          <Route path="/add-item" element={<AddItemPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AddItemPage', () => {
  it('renders toy type select with all enum values', () => {
    renderAddItemPage();
    expect(screen.getByLabelText(/toy type/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^toy$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^book$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^misc$/i })).toBeInTheDocument();
  });

  it('renders condition dropdown with all enum values', () => {
    renderAddItemPage();
    expect(screen.getByRole('option', { name: /brand new/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /lite wear/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /medium wear/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /heavy wear/i })).toBeInTheDocument();
  });

  it('renders age level select with all enum values', () => {
    renderAddItemPage();
    expect(screen.getByLabelText(/age level/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /baby/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /crawler/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /toddler/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /child/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /kid/i })).toBeInTheDocument();
  });

  it('requires batteries checkbox toggles', async () => {
    renderAddItemPage();
    const checkbox = screen.getByLabelText(/requires batteries/i);
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('on successful submit calls POST /api/items and navigates to /', async () => {
    renderAddItemPage();
    await userEvent.type(screen.getByLabelText(/toy name/i), 'My Cool Toy');
    await userEvent.click(screen.getByRole('button', { name: /add my toy/i }));

    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });

  it('on API error shows error message', async () => {
    server.use(createItemError);
    renderAddItemPage();
    await userEvent.type(screen.getByLabelText(/toy name/i), 'Broken Toy');
    await userEvent.click(screen.getByRole('button', { name: /add my toy/i }));

    await waitFor(() => expect(screen.getByText(/could not add your toy/i)).toBeInTheDocument());
  });
});
