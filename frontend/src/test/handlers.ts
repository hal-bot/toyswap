import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ── Mock data ──────────────────────────────────────────────────────────────

export const mockUser = {
  userId: 'alice',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'asmith',
};

export const mockItem = {
  id: 1,
  name: 'Lego Set',
  type: 'toy',
  condition: 'new',
  requireBatteries: false,
  ageLevel: 'child',
  active: true,
  currentOwner: 'alice',
};

export const mockItem2 = {
  id: 2,
  name: 'Puzzle',
  type: 'toy',
  condition: 'lite wear',
  requireBatteries: false,
  ageLevel: 'kid',
  active: true,
  currentOwner: 'bob',
};

// ── Handlers ───────────────────────────────────────────────────────────────

export const handlers = [
  // Auth
  http.post('/api/swappers/login', () =>
    HttpResponse.json(mockUser)
  ),

  // Swappers
  http.post('/api/swappers', () =>
    HttpResponse.json(mockUser, { status: 201 })
  ),

  // Items — owner
  http.get('/api/items/owner/:userId', () =>
    HttpResponse.json([mockItem])
  ),

  // Items — all
  http.get('/api/items', () =>
    HttpResponse.json([mockItem, mockItem2])
  ),

  // Items — create
  http.post('/api/items', () =>
    HttpResponse.json({ ...mockItem, id: 99 }, { status: 201 })
  ),

  // Swaps
  http.post('/api/swaps', () =>
    HttpResponse.json({
      offerItem: { ...mockItem, active: false },
      requestItem: { ...mockItem2, active: false },
    })
  ),
];

// ── Override helpers ───────────────────────────────────────────────────────

export const loginError = http.post('/api/swappers/login', () =>
  new HttpResponse(null, { status: 401 })
);

export const createSwapperConflict = http.post('/api/swappers', () =>
  new HttpResponse(null, { status: 409 })
);

export const ownerItemsEmpty = http.get('/api/items/owner/:userId', () =>
  HttpResponse.json([])
);

export const createItemError = http.post('/api/items', () =>
  new HttpResponse(null, { status: 500 })
);

export const swapError = http.post('/api/swaps', () =>
  new HttpResponse(null, { status: 409 })
);

// ── Server ─────────────────────────────────────────────────────────────────

export const server = setupServer(...handlers);
