import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ItemSwapPage from './ItemSwapPage';
import { AuthContext } from '../context/AuthContext';
import { server } from '../test/handlers';
import { http, HttpResponse } from 'msw';
import type { Swapper, Item } from '../types/api';

const mockUser: Swapper = {
  userId: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'asmith',
};

// Build 25 items owned by "bob" for pagination tests
function makeManyItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 10,
    name: `Item ${i + 1}`,
    type: 'toy' as const,
    condition: 'new' as const,
    requireBatteries: false,
    ageLevel: 'child' as const,
    active: true,
    currentOwner: 'bob',
  }));
}

function renderSwapPage(user = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, login: () => {}, logout: () => {} }}>
      <MemoryRouter>
        <ItemSwapPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ItemSwapPage', () => {
  it("filters out the logged-in user's own items from the displayed list", async () => {
    // Default handlers return mockItem (alice's) and mockItem2 (bob's)
    // alice's item should be filtered out
    renderSwapPage();
    await waitFor(() => expect(screen.getByText('Puzzle')).toBeInTheDocument());
    expect(screen.queryByText('Lego Set')).not.toBeInTheDocument();
  });

  it('displays up to 20 items without pagination controls', async () => {
    server.use(http.get('/api/items', () => HttpResponse.json(makeManyItems(10))));
    renderSwapPage();
    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('shows pagination controls when more than 20 items exist', async () => {
    server.use(http.get('/api/items', () => HttpResponse.json(makeManyItems(25))));
    renderSwapPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());
  });

  it('Next/Prev page buttons advance and retreat the page', async () => {
    server.use(http.get('/api/items', () => HttpResponse.json(makeManyItems(25))));
    renderSwapPage();
    await waitFor(() => screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 21')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Item 21')).toBeInTheDocument());
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());
  });

  it('clicking "Swap! 🔄" on an item opens the SwapModal', async () => {
    renderSwapPage();
    await waitFor(() => screen.getByText('Puzzle'));
    await userEvent.click(screen.getByRole('button', { name: /swap/i }));
    await waitFor(() => expect(screen.getByText(/pick a toy to swap/i)).toBeInTheDocument());
  });
});
