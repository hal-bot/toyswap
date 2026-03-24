import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItemCard from './ItemCard';
import type { Item } from '../types/api';

const baseItem: Item = {
  id: 1,
  name: 'Lego Set',
  type: 'toy',
  condition: 'new',
  requireBatteries: false,
  ageLevel: 'child',
  active: true,
};

describe('ItemCard', () => {
  it('renders item name, type badge, ageLevel badge, and condition', () => {
    render(<ItemCard item={baseItem} />);
    expect(screen.getByText('Lego Set')).toBeInTheDocument();
    expect(screen.getByText('toy')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(screen.getByText(/brand new/i)).toBeInTheDocument();
  });

  it('shows "Needs batteries" label when requireBatteries is true', () => {
    render(<ItemCard item={{ ...baseItem, requireBatteries: true }} />);
    expect(screen.getByText(/needs batteries/i)).toBeInTheDocument();
  });

  it('does not show "Needs batteries" label when requireBatteries is false', () => {
    render(<ItemCard item={baseItem} />);
    expect(screen.queryByText(/needs batteries/i)).not.toBeInTheDocument();
  });

  it('renders action button with correct label when actionLabel prop is provided', () => {
    render(<ItemCard item={baseItem} actionLabel="Swap! 🔄" onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /swap/i })).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is not provided', () => {
    render(<ItemCard item={baseItem} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction with the item when action button is clicked', () => {
    const onAction = vi.fn();
    render(<ItemCard item={baseItem} actionLabel="Swap! 🔄" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /swap/i }));
    expect(onAction).toHaveBeenCalledWith(baseItem);
  });

  it('calls onSelect when selectable card is clicked', () => {
    const onSelect = vi.fn();
    render(<ItemCard item={baseItem} selectable onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Lego Set'));
    expect(onSelect).toHaveBeenCalledWith(baseItem);
  });

  it('applies .selected CSS class when selected prop is true', () => {
    const { container } = render(
      <ItemCard item={baseItem} selectable selected onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toHaveClass('selected');
  });

  it('does not apply .selected CSS class when selected prop is false', () => {
    const { container } = render(
      <ItemCard item={baseItem} selectable selected={false} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).not.toHaveClass('selected');
  });
});
