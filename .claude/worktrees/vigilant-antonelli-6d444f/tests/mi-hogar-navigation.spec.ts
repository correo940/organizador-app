import { expect, test, type Page } from '@playwright/test';

const loginEmail = process.env.MI_HOGAR_TEST_EMAIL ?? process.env.ADMIN_EMAIL;
const loginPassword = process.env.MI_HOGAR_TEST_PASSWORD ?? process.env.ADMIN_PASSWORD;

test.skip(!loginEmail || !loginPassword, 'ADMIN_EMAIL and ADMIN_PASSWORD are required for this navigation test.');

async function loginToMiHogar(page: Page) {
  await page.goto('/apps/mi-hogar/login');

  await page.locator('input[type="email"]').fill(loginEmail!);
  await page.locator('input[type="password"]').fill(loginPassword!);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/apps/mi-hogar', { timeout: 20_000 });
}

async function expectPageStableAfterRoundTrip(
  page: Page,
  route: string,
  readySelector: string
) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
  await expect(page.locator(readySelector)).toBeVisible();

  await page.goto('/apps/mi-hogar');
  await expect(page).toHaveURL(/\/apps\/mi-hogar$/);

  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
  await expect(page.locator(readySelector)).toBeVisible();

  await expect(page.getByText('Cargando')).toHaveCount(0);
}

test('savings page does not get stuck loading after navigating away and back', async ({ page }) => {
  await loginToMiHogar(page);

  await expectPageStableAfterRoundTrip(page, '/apps/mi-hogar/savings', 'text=Volver');
});

test('garage page does not get stuck loading after navigating away and back', async ({ page }) => {
  await loginToMiHogar(page);

  await expectPageStableAfterRoundTrip(page, '/apps/mi-hogar/garage', 'text=Añadir Vehículo');
});

test('pharmacy page does not get stuck loading after navigating away and back', async ({ page }) => {
  await loginToMiHogar(page);

  await expectPageStableAfterRoundTrip(page, '/apps/mi-hogar/pharmacy', 'text=Añadir Medicamento');
});

test('manuals page does not get stuck loading after navigating away and back', async ({ page }) => {
  await loginToMiHogar(page);

  await expectPageStableAfterRoundTrip(page, '/apps/mi-hogar/manuals', 'text=Volver a Mi Hogar');
});
