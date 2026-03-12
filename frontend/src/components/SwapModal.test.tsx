import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SwapModal from './SwapModal';
import { server } from '../test/handlers';
import { swapError } from '../test/handlers';
import type { Item } from '../types/api';

const targetItem: Item = {
  id: 2,
  name: 'Puzzle',
  type: 'toy',
  condition: 'new',
  requireBatteries: false,
  ageLevel: 'kid',
  active: true,
  currentOwner: 'bob',
};

const userItem: Item = {
  id: 1,
  name: 'Lego Set',
  type: 'toy',
  condition: 'new',
  requireBatteries: false,
  ageLevel: 'child',
  active: true,
  currentOwner: 'alice',
};

function renderModal(userItems: Item[] = [userItem], onClose = vi.fn(), onSwapComplete = vi.fn()) {
  return render(
    <SwapModal
      targetItem={targetItem}
      userItems={userItems}
      onClose={onClose}
      onSwapComplete={onSwapComplete}
    />
  );
}

describe('SwapModal', () => {
  it('renders target item name in heading', () => {
    renderModal();
    expect(screen.getByText(/puzzle/i)).toBeInTheDocument();
  });

  it("lists the user's own active items as selectable cards", () => {
    renderModal();
    expect(screen.getByText('Lego Set')).toBeInTheDocument();
  });

  it('shows error message when user has no items', () => {
    renderModal([]);
    expect(screen.getByText(/don't have any items to swap/i)).toBeInTheDocument();
  });

  it('"Complete Swap" button is disabled until an item is selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /complete swap/i })).toBeDisabled();
  });

  it('clicking a user item selects/highlights it; clicking a different item changes selection', async () => {
    const secondItem: Item = {
      id: 3,
      name: 'Blocks',
      type: 'toy',
      condition: 'new',
      requireBatteries: false,
      ageLevel: 'baby',
      active: true,
    };
    renderModal([userItem, secondItem]);
    const firstCard = screen.getByText('Lego Set').closest('.card')!;
    const secondCard = screen.getByText('Blocks').closest('.card')!;

    await userEvent.click(firstCard);
    expect(firstCard).toHaveClass('selected');
    expect(secondCard).not.toHaveClass('selected');

    await userEvent.click(secondCard);
    expect(secondCard).toHaveClass('selected');
    expect(firstCard).not.toHaveClass('selected');
  });

  it('on successful swap shows "Toy swapped! 🎉" success message', async () => {
    renderModal();
    await userEvent.click(screen.getByText('Lego Set').closest('.card')!);
    await userEvent.click(screen.getByRole('button', { name: /complete swap/i }));

    await waitFor(() =>
      expect(screen.getByText(/toy swapped/i)).toBeInTheDocument()
    );
  });

  it('clicking "Awesome!" after success closes the modal', async () => {
    const onClose = vi.fn();
    renderModal([userItem], onClose);
    await userEvent.click(screen.getByText('Lego Set').closest('.card')!);
    await userEvent.click(screen.getByRole('button', { name: /complete swap/i }));
    await waitFor(() => screen.getByRole('button', { name: /awesome/i }));
    await userEvent.click(screen.getByRole('button', { name: /awesome/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('"Never mind" button calls onClose without making a swap API call', async () => {
    const onClose = vi.fn();
    renderModal([userItem], onClose);
    await userEvent.click(screen.getByRole('button', { name: /never mind/i }));

    expect(onClose).toHaveBeenCalled();
    // Success banner should never appear
    expect(screen.queryByText(/toy swapped/i)).not.toBeInTheDocument();
  });
});
