# ToySwap Frontend Instructions (Updated)

## Objective
Build a React TypeScript frontend using Vite that connects to the toy swap API.  
- Reinforce component design, API integration, and testing fundamentals.  
- Use Vite for project scaffolding.

---

## API Changes Required (complete before frontend work)

1. **Add `active` boolean field** to the `Item` schema (default `true`). All item-listing endpoints should only return active items by default.

2. **Add `POST /api/login` endpoint** — accepts `{ username, password }`, returns the full `Swapper` object on success, or `401 Unauthorized` on failure.

3. **Add `POST /api/swaps` endpoint** — accepts `{ offerItemId, requestItemId }`, validates both items are active:
   - Marks both items as `active: false`
   - Transfers ownership: item A's `currentOwner` becomes the previous owner of item B, and vice versa
   - Returns a confirmation (e.g. the two updated `Item` objects)

4. **`userId` = `username`** — when a user creates an account, `userId` is set to the same value as the `username` they choose. This ensures `username` is unique (since `userId` is the unique primary key). `userId` is never shown in the UI.

5. **Image handling** — no API changes needed. The frontend will auto-fetch an image from a free image search API (e.g. Unsplash) using the item name as the search term, and display the first result. If auto-search is unavailable, fall back to storing the image as a Base64 string in a new `imageData` field on the `Item` schema.

---

## Frontend Pages & Behavior

### Login Page
- Fields: **Username**, **Password**
- `userId` is internal only and never shown in the UI
- On submit: calls `POST /api/login`
  - On success: stores the logged-in Swapper in React Context and `userId` in localStorage; redirects to Homepage
  - On failure: shows error message "Oops! That username or password didn't work."
- Link to Create Account page

### Create Account Page
- Fields:
  - **Username** — maps to both `username` and `userId` (auto-set to same value)
  - **First Name** (`firstName`)
  - **Last Name** (`lastName`)
  - **Password** (`password`)
  - **Zip Code** (`zipCode`) — optional
  - `birthday`, `whenPurchased`, `estimatedValue` — deferred for a later release
- On submit: calls `POST /api/swappers`
- On success: redirect to Login
- On `409 Conflict`: show "That username is already taken, try another one!"

### Homepage (requires login)
- Shows only the logged-in user's **active** items (via `GET /api/items/owner/{userId}`, filter `active: true`)
- If user has no active items: display "You need to add some toys before you can swap!"
- **"Add a Toy"** button → navigates to Add an Item page
- **"Swap Toys!"** button → navigates to Item Swap page
  - If the user has no active items, clicking shows error: "You need to add items before you can swap!"

### Item Swap Page (requires login, requires at least one active item)
- Shows all **active** items NOT owned by the logged-in user (via `GET /api/items`, filter out items where `currentOwner.userId === loggedInUserId` and `active === false`)
- Shows 20 items before pagination begins
- Each item card shows: name, type, condition, age level, auto-fetched image
- Each item has a **"Swap!"** button

**Swap Modal (opens when "Swap!" is clicked):**
- Lists the logged-in user's **active** items
- User clicks an item to highlight/select it
- If the user has no active items: show error "You don't have any items to swap!"
- **"Complete Swap"** button — disabled until an item is selected
- When "Complete Swap" is clicked (active state):
  - Calls `POST /api/swaps` with `{ offerItemId: selectedUserItem.id, requestItemId: targetItem.id }`
  - On success: shows "Toy swapped! 🎉" — closing this message also closes the modal
  - Both items are removed from all lists (now inactive, ownership transferred)
- User can close the modal at any time without completing a swap

### Add an Item Page (requires login)
- Fields (from `ItemRequest`):
  - **Item Name** (`name`) — text input
  - **Type** (`type`) — dropdown: Toy / Book / Misc
  - **Condition** (`condition`) — dropdown: New / Lite Wear / Medium Wear / Heavy Wear
  - **Age Level** (`ageLevel`) — dropdown: Baby / Crawler / Toddler / Child / Kid
  - **Requires Batteries?** (`requireBatteries`) — checkbox
  - `whenPurchased`, `estimatedValue` — deferred for a later release
- On submit: calls `POST /api/items?ownerId={userId}`
- On success: redirect to Homepage

---

## Auth & Session
- Logged-in user state stored in React Context
- `userId` persists in localStorage so the session survives a page refresh
- All pages except Login and Create Account redirect to Login if no session exists
- Inactive items are **never** shown anywhere in the UI

---

## Look & Feel
- Kid-friendly, crayon-style aesthetic
- Hand-drawn / crayon fonts (e.g. "Schoolbell" or "Patrick Hand" from Google Fonts)
- Crayon-texture flourishes, bright playful colors
- Occasional backwards letters in decorative headings and logo
- Large, tappable buttons suitable for parent/child use
