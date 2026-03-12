# ToySwap Test Automation Instructions

## Overview
Three test layers, each with a distinct responsibility:

| Layer | Tool | Scope |
|---|---|---|
| Backend integration | JUnit 5 + MockMvc / `@SpringBootTest` + H2 | API contracts, JPA queries |
| Frontend unit | Vitest + React Testing Library + MSW | Component rendering, user interaction, API mocking |
| End-to-end | Playwright + Playwright MCP | Full user journeys in a real browser |

---

## Part 1: Backend Integration Tests

### Approach
- **Controller tests** — `@SpringBootTest(webEnvironment = MOCK)` + MockMvc + `@MockitoBean` on repositories. Fast, in-process, no DB. Follow the pattern already in `ItemControllerTest` and `SwapperControllerTest`.
- **Repository tests** — `@SpringBootTest` + real H2 in-memory DB + `@Transactional` (rolls back after each test). Follow the pattern in `ItemRepositoryTest`.

No new dependencies needed — `spring-boot-starter-test` already covers JUnit 5, Mockito, MockMvc, AssertJ, and H2.

---

### New controller tests to add

#### `SwapperControllerTest` — add to existing file
- `POST /api/swappers/login` with valid credentials → `200 OK` with Swapper JSON (no `password` field)
- `POST /api/swappers/login` with wrong password → `401 Unauthorized`
- `POST /api/swappers/login` with missing `username` or `password` field → `400 Bad Request`
- `POST /api/swappers` where `userId` already exists → `409 Conflict`
- `POST /api/swappers` with valid body → `201 Created`

#### `SwapControllerTest` — new file
- `POST /api/swaps` with valid `offerItemId` and `requestItemId` (both active) → `200 OK`; response contains both items with `active: false` and ownership transferred
- `POST /api/swaps` where one item is already inactive → `409 Conflict`
- `POST /api/swaps` with a non-existent item ID → `404 Not Found`
- `POST /api/swaps` with missing body fields → `400 Bad Request`

#### `ItemControllerTest` — update existing tests
- `GET /api/items` → verify it calls `findByActiveTrue()`, not `findAll()`
- `GET /api/items/owner/{userId}` → verify it calls `findByCurrentOwnerAndActiveTrue()`
- `GET /api/items/type/{type}` → verify it calls `findByTypeAndActiveTrue()`
- `GET /api/items/age/{ageLevel}` → verify it calls `findByAgeLevelAndActiveTrue()`
- `POST /api/items` → verify created item has `active: true`

---

### New repository tests to add

#### `ItemRepositoryTest` — update existing file
Update all existing tests to use the new `ActiveTrue` finder methods, and add:
- `findByActiveTrue()` returns only items where `active = true`
- `findByCurrentOwnerAndActiveTrue()` returns only the owner's active items; inactive ones are excluded
- `findByTypeAndActiveTrue()` filters correctly
- `findByAgeLevelAndActiveTrue()` filters correctly

#### `SwapperRepositoryTest` — add to existing file
- `findByUsernameAndPassword()` returns the correct Swapper when credentials match
- `findByUsernameAndPassword()` returns empty when password is wrong
- `findByUsernameAndPassword()` returns empty when username doesn't exist

---

## Part 2: Frontend UI Unit Tests (React Testing Library)

### Setup

**Install dependencies:**

npm install --save-dev msw @testing-library/react @testing-library/user-event @testing-library/jest-dom

**Add to `vite.config.ts` test block:**

setupFiles: ['./src/test/setup.ts']

**Create `src/test/setup.ts`:**
- Import `@testing-library/jest-dom` for extended matchers (`toBeInTheDocument`, `toBeDisabled`, etc.)
- Start/reset/stop the MSW server (`beforeAll` / `afterEach` / `afterAll`)

**Create `src/test/handlers.ts`:**
Define MSW request handlers for every API endpoint the frontend calls. Each handler returns realistic mock data matching the TypeScript types. Define both happy-path and error-case variants (e.g., a `loginError` handler override that returns 401).

---

### Tests to write by file

#### `src/components/ItemCard.test.tsx`
- Renders item name, type badge, ageLevel badge, condition
- Shows "Needs batteries" label when `requireBatteries: true`; hidden when false
- Renders the action button with correct label when `actionLabel` prop is provided
- Clicking action button calls `onAction` with the item
- When `selectable` is true and clicked, calls `onSelect`
- Applies `.selected` CSS class when `selected` prop is true

#### `src/components/ProtectedRoute.test.tsx`
- Renders children when user is logged in (AuthContext has a user)
- Redirects to `/login` when no user in context

#### `src/pages/LoginPage.test.tsx`
- Renders username and password fields and a login button
- On successful submit → calls `POST /api/swappers/login` and navigates to `/`
- On 401 response → shows "Oops! That username or password didn't work."
- Login button is disabled while the request is in flight
- "Make an account!" link navigates to `/create-account`

#### `src/pages/CreateAccountPage.test.tsx`
- Renders all required fields (username, first name, last name, password)
- Zip code field is present but not required
- On successful submit → navigates to `/login`
- On 409 response → shows "That username is already taken, try another one!"
- Submit button is disabled while the request is in flight

#### `src/pages/HomePage.test.tsx`
- Shows user's active items when API returns items
- Shows empty-state message when API returns an empty array
- "Add a Toy" button navigates to `/add-item`
- "Swap Toys!" button navigates to `/swap` when user has items
- "Swap Toys!" button shows inline error when user has no items (does not navigate)

#### `src/pages/AddItemPage.test.tsx`
- All four dropdowns render with correct options (type, condition, ageLevel; confirm all enum values are present)
- Requires Batteries checkbox toggles
- On successful submit → calls `POST /api/items?ownerId=...` and navigates to `/`
- On API error → shows error message

#### `src/pages/ItemSwapPage.test.tsx`
- Filters out the logged-in user's own items from the displayed list
- Displays up to 20 items without pagination controls
- When more than 20 items exist, pagination controls appear; Next/Prev page buttons work
- Clicking "Swap! 🔄" on an item opens the SwapModal

#### `src/components/SwapModal.test.tsx`
- Renders target item name in heading
- Lists the user's own active items as selectable cards
- Shows error message when user has no items
- "Complete Swap" button is disabled until an item is selected
- Clicking a user item selects/highlights it; clicking again deselects
- On successful swap → shows "Toy swapped! 🎉" success message
- Clicking "Awesome!" after success closes the modal (calls `onClose`)
- "Never mind" button calls `onClose` without making a swap API call

---

## Part 3: End-to-End Tests (Playwright)

### Setup

**Install Playwright:**

npm init playwright@latest

Accept defaults; choose TypeScript; choose `e2e` as the test directory.

**Install the Playwright MCP server** and configure it in VS Code settings so you can prompt it to generate and iterate on tests interactively.

---

### Startup automation

Create a `docker-compose.test.yml` (or a shell script `start-test-env.sh`) that:
1. Starts the Spring Boot backend (build with `./mvnw package -DskipTests`, run the jar, wait for port 8080)
2. Runs `npm run build && npm run preview` in `frontend/` (Vite preview serves the production build on port 4173)
3. Playwright's `webServer` block in `playwright.config.ts` should point to port 4173 and wait until it is ready

In `playwright.config.ts`:
- Set `baseURL: 'http://localhost:4173'`
- Configure `webServer.command` to run the startup script
- Set `use.trace: 'on-first-retry'` for debugging test failures

---

### E2E test scenarios

#### `e2e/auth.spec.ts`
- **Login with invalid credentials** — fill username/password, submit, assert error message appears
- **Login with valid credentials** — submit, assert redirected to home page, user's first name is visible in greeting
- **Unauthenticated redirect** — navigate directly to `/`, assert redirected to `/login`
- **Create account and login** — fill all create-account fields, submit, get redirected to login, log in with new credentials, assert homepage loads

#### `e2e/items.spec.ts`
- **Add an item** — log in, click "Add a Toy", fill the form, submit, assert new item appears on the homepage
- **Empty home state** — log in as a user with no items, assert empty-state message is visible; "Swap Toys!" shows inline error rather than navigating
- **View swap page** — log in, add an item, navigate to `/swap`, assert available items are listed (does not include the user's own items)
- **Pagination** — if more than 20 items exist, assert pagination controls appear and clicking "Next →" advances the page

#### `e2e/swap.spec.ts`
- **Complete a swap** — set up two users each with one item (via API calls in `test.beforeEach`), log in as user A, open the swap page, click "Swap!" on user B's item, select user A's item in the modal, click "Complete Swap", assert success banner appears, assert both items disappear from the list
- **Close modal without swapping** — open the swap modal, click "Never mind", assert modal is dismissed and item list is unchanged
- **Complete Swap button is disabled before selection** — open swap modal, assert button is disabled before any item is selected

---

### Using Playwright MCP
Once the Playwright MCP server is running, use it to:
1. **Record initial test skeletons** — navigate through each flow in the browser while Playwright MCP records selectors and actions
2. **Generate assertions** — ask the MCP to assert on visible text, element state (disabled/enabled), and URL changes
3. **Iterate on flaky tests** — use the MCP's trace viewer integration to identify timing issues and insert `waitFor` calls
