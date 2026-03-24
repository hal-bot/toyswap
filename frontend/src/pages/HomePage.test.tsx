import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import { AuthContext } from '../context/AuthContext';
import { server } from '../test/handlers';
import { ownerItemsEmpty } from '../test/handlers';
import type { Swapper } from '../types/api';

const mockUser: Swapper = {
  userId: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'asmith',
};

function renderHomePage(user = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, login: () => {}, logout: () => {} }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add-item" element={<div>Add Item Page</div>} />
          <Route path="/swap" element={<div>Swap Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('HomePage', () => {
  it("shows user's active items when API returns items", async () => {
    renderHomePage();
    await waitFor(() => expect(screen.getByText('Lego Set')).toBeInTheDocument());
  });

  it('shows empty-state message when API returns an empty array', async () => {
    server.use(ownerItemsEmpty);
    renderHomePage();
    await waitFor(() => expect(screen.getByText(/add some toys/i)).toBeInTheDocument());
  });

  it('"Add Item" link navigates to /add-item', async () => {
    renderHomePage();
    await userEvent.click(screen.getByRole('link', { name: /add item/i }));
    await waitFor(() => expect(screen.getByText('Add Item Page')).toBeInTheDocument());
  });

  it('"Swap Toys!" button navigates to /swap when user has items', async () => {
    renderHomePage();
    await waitFor(() => screen.getByText('Lego Set'));
    await userEvent.click(screen.getByRole('button', { name: /swap toys/i }));
    await waitFor(() => expect(screen.getByText('Swap Page')).toBeInTheDocument());
  });

  it('"Swap Toys!" button shows inline error when user has no items', async () => {
    server.use(ownerItemsEmpty);
    renderHomePage();
    await waitFor(() => screen.getByText(/add some toys/i));
    await userEvent.click(screen.getByRole('button', { name: /swap toys/i }));
    expect(screen.getByText(/need to add items/i)).toBeInTheDocument();
    expect(screen.queryByText('Swap Page')).not.toBeInTheDocument();
  });
});
