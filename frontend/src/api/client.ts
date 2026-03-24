import type {
  Item,
  Swapper,
  LoginRequest,
  CreateSwapperRequest,
  SwapRequest,
  SwapResponse,
} from '../types/api';

const BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw { status: res.status, message: text };
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(credentials: LoginRequest): Promise<Swapper> {
  const res = await fetch(`${BASE}/swappers/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return handleResponse<Swapper>(res);
}

export async function createAccount(data: CreateSwapperRequest): Promise<Swapper> {
  const res = await fetch(`${BASE}/swappers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Swapper>(res);
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function getAllItems(): Promise<Item[]> {
  const res = await fetch(`${BASE}/items`);
  return handleResponse<Item[]>(res);
}

export async function getItemsByOwner(userId: string): Promise<Item[]> {
  const res = await fetch(`${BASE}/items/owner/${encodeURIComponent(userId)}`);
  return handleResponse<Item[]>(res);
}

export async function createItem(
  item: Omit<Item, 'id' | 'active'>,
  ownerId: string,
): Promise<Item> {
  const res = await fetch(`${BASE}/items?ownerId=${encodeURIComponent(ownerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  return handleResponse<Item>(res);
}

// ── Swaps ─────────────────────────────────────────────────────────────────────

export async function completeSwap(request: SwapRequest): Promise<SwapResponse> {
  const res = await fetch(`${BASE}/swaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<SwapResponse>(res);
}
