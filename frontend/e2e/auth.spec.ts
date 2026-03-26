import { test, expect, request } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api';

// Helper to create a swapper via API
async function createSwapper(req: Awaited<ReturnType<typeof request.newContext>>, userId: string, username: string, password: string) {
  await req.post(`${BASE_API}/swappers`, {
    data: { userId, username, firstName: 'Test', lastName: 'User', password },
  });
}

test.describe('Authentication', () => {
  test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('nobody');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText(/that username or password didn't work/i)).toBeVisible();
  });

  test('login with valid credentials redirects to home page and shows first name', async ({ page, request }) => {
    await createSwapper(request, 'e2e_alice', 'e2e_alice_user', 'pass123');

    await page.goto('/login');
    await page.getByLabel(/username/i).fill('e2e_alice_user');
    await page.getByLabel(/password/i).fill('pass123');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/hey, test/i)).toBeVisible();
  });

  test('unauthenticated user navigating to / is redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('create account and login', async ({ page }) => {
    const uid = `e2e_new_${Date.now()}`;
    await page.goto('/create-account');
    await page.getByLabel(/username/i).fill(uid);
    await page.getByLabel(/first name/i).fill('New');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/password/i).fill('testpass');
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(page).toHaveURL('/login');

    await page.getByLabel(/username/i).fill(uid);
    await page.getByLabel(/password/i).fill('testpass');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/hey, new/i)).toBeVisible();
  });

  test('logout redirects to login page', async ({ page, request }) => {
    const uid = `e2e_logout_${Date.now()}`;
    await createSwapper(request, uid, uid, 'pass123');

    await page.goto('/login');
    await page.getByLabel(/username/i).fill(uid);
    await page.getByLabel(/password/i).fill('pass123');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL('/login');
  });
});
