# ToySwap

A full-stack toy-swapping application. Parents and kids can list toys they no longer want and trade them with other users.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 17, Spring Boot 4, Spring Data JPA, H2 (in-memory) |
| Frontend | React 19, TypeScript, Vite, React Router v7 |
| Backend tests | JUnit 5, MockMvc, Mockito, H2 |
| Frontend unit tests | Vitest, React Testing Library, MSW |
| End-to-end tests | Playwright (Chromium) |
| Mutation testing | PIT (pitest-maven) |

---

## Prerequisites

- Java 17+
- Node.js 18+
- npm

---

## Project Structure

```
toyswap/
├── backend/          # Spring Boot application
│   └── src/
│       ├── main/java/com/example/toyswap/
│       │   ├── controller/   # REST controllers
│       │   ├── model/        # JPA entities (Item, Swapper)
│       │   └── repository/   # Spring Data repositories
│       └── test/             # Backend tests
├── frontend/         # React + Vite application
│   ├── e2e/          # Playwright end-to-end specs
│   └── src/
│       ├── api/      # fetch wrappers
│       ├── components/
│       ├── context/  # AuthContext
│       ├── pages/
│       ├── test/     # MSW handlers and Vitest setup
│       └── types/    # TypeScript interfaces
├── seed.mjs          # Dev data seed script
└── start-test-env.sh # Builds and starts backend + frontend preview
```

---

## Running Locally (Development)

### 1. Start the backend

```bash
cd backend
./mvnw spring-boot:run
```

The API will be available at `http://localhost:8080/api`.

The H2 console is available at `http://localhost:8080/h2-console`:
- JDBC URL: `jdbc:h2:mem:toyswapdb`
- Username: `sa`
- Password: *(leave blank)*

> **Note:** The database is in-memory and is wiped on every restart. Use `seed.mjs` to repopulate it.

### 2. Start the frontend (dev server)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`. API calls are proxied to `http://localhost:8080`.

---

## Seeding Test Data

With the backend running, execute from the project root:

```bash
node seed.mjs
```

This creates 10 Bluey-character swappers (all with password `password123`) and 6 items each (60 items total). It is safe to run multiple times — existing swappers produce a warning and are skipped.

| Username | Name |
|---|---|
| `bluey_heeler` | Bluey Heeler |
| `bingo_heeler` | Bingo Heeler |
| `bandit_heeler` | Bandit Heeler |
| `chilli_heeler` | Chilli Heeler |
| `jack_wheeler` | Jack Wheeler |
| `chloe_heeler` | Chloe Heeler |
| `judo_malik` | Judo Malik |
| `mackenzie_dog` | Mackenzie Dog |
| `coco_parrot` | Coco Parrot |
| `calypso_teacher` | Calypso Teacher |

---

## Running Tests

### Backend — Unit & Integration Tests

```bash
cd backend
./mvnw test
```

This runs all JUnit 5 tests. Reports are written to `backend/target/surefire-reports/`.

To run a single test class:

```bash
./mvnw test -Dtest=ItemControllerTest
```

To run a single test method:

```bash
./mvnw test -Dtest=ItemControllerTest#createItem_returnsCreated
```

#### Test layout

| File | Coverage |
|---|---|
| `ItemControllerTest` | All `GET`/`POST`/`PUT`/`DELETE` item endpoints via MockMvc |
| `SwapperControllerTest` | Account creation, login (success/failure), conflict handling |
| `ItemRepositoryTest` | JPA queries against a real H2 database (`@Transactional` rollback) |
| `SwapperRepositoryTest` | `findByUsernameAndPassword` happy and failure paths |

---

### Backend — Mutation Testing (PIT)

Mutation testing verifies that your tests actually catch bugs, not just that they pass.

```bash
cd backend
./mvnw test pitest:mutate
```

The HTML report is written to `backend/target/pit-reports/index.html`. Open it in a browser to see which mutants were killed vs. survived.

> This can take 1–3 minutes depending on test count.

---

### Frontend — Unit Tests (Vitest + React Testing Library)

```bash
cd frontend
npm test
```

Runs all `*.test.tsx` files once and exits. API calls are intercepted by MSW handlers defined in `src/test/handlers.ts` — no real backend needed.

To run in **watch mode** (re-runs on file save):

```bash
npm run test:watch
```

To run a single test file:

```bash
npx vitest run src/pages/LoginPage.test.tsx
```

To run tests matching a name pattern:

```bash
npx vitest run --reporter=verbose -t "shows error on 401"
```

#### Test layout

| File | Coverage |
|---|---|
| `components/ItemCard.test.tsx` | Rendering, badges, action button, `onAction` callback |
| `components/ProtectedRoute.test.tsx` | Redirects unauthenticated users to `/login` |
| `pages/LoginPage.test.tsx` | Login flow, 401 error message, loading state |
| `pages/CreateAccountPage.test.tsx` | Account creation flow, 409 conflict message |
| `pages/HomePage.test.tsx` | Item list, empty state, navigation buttons |
| `pages/AddItemPage.test.tsx` | Add item form submission |
| `pages/ItemSwapPage.test.tsx` | Displays other users' items, owner filter |
| `components/SwapModal.test.tsx` | Swap confirmation flow |

---

### End-to-End Tests (Playwright)

E2E tests run against the **built frontend preview** (`localhost:4173`) and **live backend** (`localhost:8080`). Both must be running.

#### Option A — Use the startup script

```bash
# From the project root — builds and starts both servers, then leave running
./start-test-env.sh
```

In a separate terminal:

```bash
cd frontend
npx playwright test
```

#### Option B — Start servers manually

```bash
# Terminal 1 — backend
cd backend && ./mvnw spring-boot:run

# Terminal 2 — frontend preview
cd frontend && npm run build && npm run preview

# Terminal 3 — run tests
cd frontend && npx playwright test
```

#### Useful Playwright options

```bash
# Run a specific spec file
npx playwright test e2e/auth.spec.ts

# Run in headed mode (watch the browser)
npx playwright test --headed

# Run a specific test by title
npx playwright test -g "login with valid credentials"

# Show the HTML report after a run
npx playwright show-report
```

#### E2E spec layout

| File | Coverage |
|---|---|
| `e2e/auth.spec.ts` | Login, create account, invalid credentials, redirect when unauthenticated |
| `e2e/items.spec.ts` | Add a toy, appears on home page |
| `e2e/swap.spec.ts` | Complete a swap, modal close, items disappear after swap |

---

## API Reference

### Swappers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/swappers` | List all swappers |
| `GET` | `/api/swappers/{userId}` | Get swapper by ID |
| `POST` | `/api/swappers` | Create account (`201`; `409` if userId already taken) |
| `POST` | `/api/swappers/login` | Login (`200` with Swapper; `401` on failure) |
| `PUT` | `/api/swappers/{userId}` | Update swapper |

### Items

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/items` | All active items |
| `GET` | `/api/items/{id}` | Item by ID |
| `GET` | `/api/items/owner/{userId}` | Active items owned by a swapper |
| `GET` | `/api/items/type/{type}` | Filter by type (`toy`, `book`, `misc`) |
| `GET` | `/api/items/age/{ageLevel}` | Filter by age level (`baby`, `crawler`, `toddler`, `child`, `kid`) |
| `POST` | `/api/items?ownerId={userId}` | Create item and assign owner |
| `PUT` | `/api/items/{id}?ownerId={userId}` | Update item |

### Swaps

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/swaps` | Execute a swap — body: `{ offerItemId, requestItemId }` |
