import { test, expect, request } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api';

async function createSwapper(req: Awaited<ReturnType<typeof request.newContext>>, userId: string, username: string) {
  await req.post(`${BASE_API}/swappers`, {
    data: { userId, username, firstName: 'Item', lastName: 'User', password: 'pass123' },
  });
}

async function createItem(req: Awaited<ReturnType<typeof request.newContext>>, ownerId: string, name: string, type: string, ageLevel: string) {
  return await req.post(`${BASE_API}/items?ownerId=${ownerId}`, {
    data: { name, type, ageLevel, description: 'Test item', imageUrl: 'http://example.com/img.jpg' },
  });
}

async function loginAs(page: import('@playwright/test').Page, username: string, password = 'pass123') {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Items', () => {
  test('user with no items sees empty-state message', async ({ page, request }) => {
    const uid = `e2e_empty_${Date.now()}`;
    await createSwapper(request, uid, uid);
    await loginAs(page, uid);

    await expect(page.getByText(/you don't have any toys listed/i)).toBeVisible();
    await expect(page.getByText(/swap toys/i)).toBeVisible();
  });

  test('add an item appears on the home page', async ({ page, request }) => {
    const uid = `e2e_add_${Date.now()}`;
    await createSwapper(request, uid, uid);
    await loginAs(page, uid);

    await page.getByRole('link', { name: /add item/i }).click();
    await page.getByLabel(/toy name/i).fill('Super Toy');
    await page.getByLabel(/toy type/i).fill('Action Figure');
    await page.getByLabel(/age level/i).fill('5+');
    await page.getByLabel(/description/i).fill('A great toy');
    await page.getByLabel(/image url/i).fill('http://example.com/toy.jpg');
    await page.getByRole('button', { name: /add my toy/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Super Toy')).toBeVisible();
  });

  test("viewing the swap page does not show the user's own items", async ({ page, request }) => {
    const uid = `e2e_swap_view_${Date.now()}`;
    await createSwapper(request, uid, uid);
    await createItem(request, uid, 'My Own Toy', 'Puzzle', '3+');
    await loginAs(page, uid);

    await page.getByRole('link', { name: /swap/i }).click();
    await expect(page).toHaveURL('/swap');

    const ownToyCard = page.getByText('My Own Toy');
    await expect(ownToyCard).toHaveCount(0);
  });

  test('pagination controls appear when there are more than 20 items', async ({ page, request }) => {
    const ownerUid = `e2e_paginate_owner_${Date.now()}`;
    const viewerUid = `e2e_paginate_viewer_${Date.now()}`;
    await createSwapper(request, ownerUid, ownerUid);
    await createSwapper(request, viewerUid, viewerUid);

    // Create 21 items under the owner
    for (let i = 1; i <= 21; i++) {
      await createItem(request, ownerUid, `Paginated Toy ${i}`, 'Action Figure', '5+');
    }

    await loginAs(page, viewerUid);
    await page.getByRole('link', { name: /swap/i }).click();

    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
  });

  test('swap button shows error when user has no items', async ({ page, request }) => {
    const uid = `e2e_noitems_${Date.now()}`;
    await createSwapper(request, uid, uid);
    await loginAs(page, uid);

    await page.getByRole('button', { name: /swap toys/i }).click();

    await expect(page.getByText(/you need to add items before you can swap/i)).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});
