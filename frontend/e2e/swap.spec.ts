import { test, expect, request } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api';

async function createSwapper(
  req: Awaited<ReturnType<typeof request.newContext>>,
  userId: string,
  username: string,
) {
  await req.post(`${BASE_API}/swappers`, {
    data: { userId, username, firstName: 'Swap', lastName: 'Tester', password: 'pass123' },
  });
}

async function createItem(
  req: Awaited<ReturnType<typeof request.newContext>>,
  ownerId: string,
  name: string,
) {
  const res = await req.post(`${BASE_API}/items?ownerId=${ownerId}`, {
    data: {
      name,
      type: 'Action Figure',
      ageLevel: '5+',
      description: 'E2E test item',
      imageUrl: 'http://example.com/img.jpg',
    },
  });
  return res.json();
}

async function loginAs(page: import('@playwright/test').Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill('pass123');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Swap', () => {
  test('complete a swap — success banner appears and both items disappear', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const uidA = `e2e_swapA_${ts}`;
    const uidB = `e2e_swapB_${ts}`;
    await createSwapper(request, uidA, uidA);
    await createSwapper(request, uidB, uidB);
    const itemA = await createItem(request, uidA, `ItemA_${ts}`);
    const itemB = await createItem(request, uidB, `ItemB_${ts}`);

    await loginAs(page, uidA);

    // Navigate to swap page
    await page.getByRole('button', { name: /swap toys/i }).click();
    await expect(page).toHaveURL('/swap');

    // User A's item should NOT be visible
    await expect(page.getByText(itemA.name)).toHaveCount(0);

    // Click Swap on User B's item
    const itemBCard = page.getByText(itemB.name).locator('..').locator('..');
    await page.getByText(itemB.name).locator('..').getByRole('button', { name: /swap/i }).click();

    // SwapModal should open — pick user A's item
    await expect(page.getByRole('heading', { name: new RegExp(itemB.name, 'i'), level: 2 })).toBeVisible();
    await page.getByText(itemA.name).click();

    // Complete Swap button should now be enabled
    const completeBtn = page.getByRole('button', { name: /complete swap/i });
    await expect(completeBtn).toBeEnabled();
    await completeBtn.click();

    // Success banner
    await expect(page.getByText(/toy swapped/i)).toBeVisible();

    // Click Awesome! to close
    await page.getByRole('button', { name: /awesome/i }).click();

    // Both items should be gone from the page
    await expect(page.getByText(itemB.name)).toHaveCount(0);
  });

  test('close modal without swapping — item list unchanged', async ({ page, request }) => {
    const ts = Date.now();
    const uidA = `e2e_closemodalA_${ts}`;
    const uidB = `e2e_closemodalB_${ts}`;
    await createSwapper(request, uidA, uidA);
    await createSwapper(request, uidB, uidB);
    await createItem(request, uidA, `MyToy_${ts}`);
    const itemB = await createItem(request, uidB, `TheirToy_${ts}`);

    await loginAs(page, uidA);
    await page.getByRole('button', { name: /swap toys/i }).click();
    await expect(page).toHaveURL('/swap');

    // Open modal for itemB
    await page.getByText(itemB.name).locator('..').getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(itemB.name, 'i'), level: 2 })).toBeVisible();

    // Click Never mind
    await page.getByRole('button', { name: /never mind/i }).click();

    // Modal should be gone and item still visible
    await expect(page.getByRole('heading', { name: new RegExp(itemB.name, 'i'), level: 2 })).toHaveCount(0);
    await expect(page.getByText(itemB.name)).toBeVisible();
  });

  test('Complete Swap button is disabled before an item is selected', async ({ page, request }) => {
    const ts = Date.now();
    const uidA = `e2e_disabledA_${ts}`;
    const uidB = `e2e_disabledB_${ts}`;
    await createSwapper(request, uidA, uidA);
    await createSwapper(request, uidB, uidB);
    await createItem(request, uidA, `OfferToy_${ts}`);
    const itemB = await createItem(request, uidB, `TargetToy_${ts}`);

    await loginAs(page, uidA);
    await page.getByRole('button', { name: /swap toys/i }).click();
    await expect(page).toHaveURL('/swap');

    // Open modal
    await page.getByText(itemB.name).locator('..').getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(itemB.name, 'i'), level: 2 })).toBeVisible();

    // Verify Complete Swap is disabled before selection
    await expect(page.getByRole('button', { name: /complete swap/i })).toBeDisabled();
  });

  test('after a swap, received toy appears on home page and given toy does not', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const uidA = `e2e_swapHomeA_${ts}`;
    const uidB = `e2e_swapHomeB_${ts}`;
    await createSwapper(request, uidA, uidA);
    await createSwapper(request, uidB, uidB);
    const itemA = await createItem(request, uidA, `GiveAway_${ts}`);
    const itemB = await createItem(request, uidB, `Received_${ts}`);

    await loginAs(page, uidA);

    // Navigate to swap page
    await page.getByRole('button', { name: /swap toys/i }).click();
    await expect(page).toHaveURL('/swap');

    // Click Swap on User B's item
    await page.getByText(itemB.name).locator('..').getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(itemB.name, 'i'), level: 2 })).toBeVisible();
    await page.getByText(itemA.name).click();

    // Complete the swap
    await page.getByRole('button', { name: /complete swap/i }).click();
    await expect(page.getByText(/toy swapped/i)).toBeVisible();
    await page.getByRole('button', { name: /awesome/i }).click();

    // Navigate back to home page
    await page.getByRole('button', { name: /my toys/i }).click();
    await expect(page).toHaveURL('/');

    // Received item should appear; given-away item should not
    await expect(page.getByText(itemB.name)).toBeVisible();
    await expect(page.getByText(itemA.name)).toHaveCount(0);
  });
});
