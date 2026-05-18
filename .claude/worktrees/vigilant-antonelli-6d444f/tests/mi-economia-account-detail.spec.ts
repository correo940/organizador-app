import { expect, test, type Page } from '@playwright/test';

const loginEmail = process.env.MI_HOGAR_TEST_EMAIL ?? process.env.ADMIN_EMAIL;
const loginPassword = process.env.MI_HOGAR_TEST_PASSWORD ?? process.env.ADMIN_PASSWORD;

test.skip(!loginEmail || !loginPassword, 'ADMIN_EMAIL and ADMIN_PASSWORD are required for this finance flow test.');
test.setTimeout(120_000);

async function loginToMiHogar(page: Page) {
  await page.goto('/apps/mi-hogar/login');

  await page.locator('input[type="email"]').fill(loginEmail!);
  await page.locator('input[type="password"]').fill(loginPassword!);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/apps/mi-hogar', { timeout: 20_000 });
}

test('mi economia permite abrir una cuenta en vista grande y editar movimientos', async ({ page }) => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const accountName = `Cuenta QA ${uniqueSuffix}`;
  const firstConcept = `Movimiento inicial ${uniqueSuffix}`;
  const editedConcept = `Movimiento corregido ${uniqueSuffix}`;

  await loginToMiHogar(page);
  await page.goto('/apps/mi-hogar/savings');

  await page.getByRole('button', { name: 'Cuentas' }).click();
  await page.getByText(/Añadir Nueva Cuenta|AÃ±adir Nueva Cuenta/).click();

  const createDialog = page.getByRole('dialog').filter({ hasText: /Añadir Cuenta|AÃ±adir Cuenta/ }).first();
  await expect(createDialog).toBeVisible();

  await createDialog.locator('input').first().fill(accountName);
  await createDialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'BBVA' }).click();
  await createDialog.getByRole('button', { name: 'Crear Cuenta' }).click();

  await expect(createDialog).toBeHidden();
  const accountCardHeading = page.getByRole('heading', { name: accountName, exact: true }).last();
  await expect(accountCardHeading).toBeVisible();
  await accountCardHeading.click();

  const detailDialog = page.locator('[role="dialog"]').last();
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText(accountName)).toBeVisible();
  await expect(detailDialog.getByRole('tab', { name: 'Resumen' })).toBeVisible();
  await expect(detailDialog.getByRole('tab', { name: 'Movimientos' })).toBeVisible();
  await expect(detailDialog.getByRole('tab', { name: 'Detalles' })).toBeVisible();

  const detailBox = await detailDialog.boundingBox();
  expect(detailBox?.width ?? 0).toBeGreaterThan(900);
  expect(detailBox?.height ?? 0).toBeGreaterThan(600);

  await detailDialog.getByRole('spinbutton').fill('123.45');
  await detailDialog.getByPlaceholder(/Ej: nomina|Ej: nómina/i).fill(firstConcept);
  await detailDialog.getByRole('button', { name: 'Registrar movimiento' }).click();

  await expect(detailDialog.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('data-state', 'active');
  await expect(detailDialog.getByText(firstConcept)).toBeVisible();

  const firstRow = detailDialog.getByRole('row').filter({ hasText: firstConcept }).first();
  await firstRow.getByRole('button').first().click();

  await expect(detailDialog.getByText('Editar movimiento')).toBeVisible();
  await detailDialog.getByRole('spinbutton').fill('150');
  await detailDialog.locator('input').nth(1).fill(editedConcept);
  await detailDialog.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(detailDialog.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('data-state', 'active');
  await expect(detailDialog.getByText(editedConcept)).toBeVisible();
  await expect(detailDialog.getByRole('row').filter({ hasText: editedConcept }).first()).toContainText('150');

  await detailDialog.getByRole('tab', { name: 'Detalles' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await detailDialog.getByRole('button', { name: 'Eliminar cuenta' }).click();

  await expect(detailDialog).toBeHidden();
  await expect(page.getByRole('heading', { name: accountName, exact: true })).toHaveCount(0);
});
