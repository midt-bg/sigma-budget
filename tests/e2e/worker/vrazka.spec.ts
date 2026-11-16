import { expect, test } from '@playwright/test';

const site = process.env.E2E_WORKER_URL || 'http://127.0.0.1:8814';
test('sends block context and displays a receipt; a later 429 preserves the draft', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(site).origin && request.url().startsWith('http'))
      external.push(request.url());
  });
  await page.goto(site + '/vrazka?val=123%20EUR&from=vedomstva&block=s10-bill-totals');
  const form = page.locator('[data-s27-form="greshka"]');
  const text = 'Тестов сигнал за проверка на числото.';
  expect(external).toEqual([]);
  await form.locator('textarea').fill(text);
  const send = form.getByRole('button', { name: 'Изпрати', exact: true });
  await expect(send).toBeEnabled({ timeout: 60000 });
  const submitted = page.waitForRequest(
    (r) => r.url().endsWith('/api/vrazka') && r.method() === 'POST',
  );
  const response = page.waitForResponse((r) => r.url().endsWith('/api/vrazka'));
  await send.click();
  expect((await submitted).postDataJSON()).toMatchObject({
    value: '123 EUR',
    block: 's10-bill-totals',
    text,
  });
  const receipt = await response;
  expect(receipt.status()).toBe(201);
  const { id } = await receipt.json();
  await expect(page.locator('[data-s27-ok="greshka"]')).toContainText(`Номер на сигнала: ${id}`);
  await page.getByRole('button', { name: 'Изпрати още едно', exact: true }).first().click();
  await page.route('**/api/vrazka', (route) =>
    route.fulfill({ status: 429, json: { error: 'limited' } }),
  );
  await form.locator('textarea').fill(text);
  await expect(send).toBeEnabled({ timeout: 60000 });
  await send.click();
  await expect(form.locator('[data-feedback-status]')).toContainText('Опитай след малко');
  await expect(form.locator('textarea')).toHaveValue(text);
  expect(external.length).toBeGreaterThan(0);
  expect(external.filter((url) => new URL(url).hostname !== 'challenges.cloudflare.com')).toEqual(
    [],
  );
  expect(errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
