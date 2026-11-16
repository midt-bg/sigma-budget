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
  let releaseScript!: () => void;
  const scriptGate = new Promise<void>((resolve) => {
    releaseScript = resolve;
  });
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    async (route) => {
      await scriptGate;
      await route.continue();
    },
  );
  const value = 'Кирилица '.repeat(12).trim();
  const query = new URLSearchParams({ val: value, from: 'vedomstva', block: 's10-bill-totals' });
  await page.goto(site + '/vrazka?' + query);
  await expect(page.locator('article.page[data-route="S27"]')).toHaveAttribute('data-ready', '1');
  const form = page.locator('[data-s27-form="greshka"]');
  const text = 'Тестов сигнал за проверка на числото.';
  expect(external).toEqual([]);
  await form.locator('textarea').fill(text);
  await form.locator('textarea').press('Control+Enter');
  await expect(form.locator('[data-feedback-status]')).toContainText('Изчакай проверката');
  releaseScript();
  const send = form.getByRole('button', { name: 'Изпрати', exact: true });
  await expect(send).toBeEnabled({ timeout: 60000 });
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(1);
  await expect(form.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('');
  const submitted = page.waitForRequest(
    (r) => r.url().endsWith('/api/vrazka') && r.method() === 'POST',
  );
  const response = page.waitForResponse((r) => r.url().endsWith('/api/vrazka'));
  await send.click();
  expect((await submitted).postDataJSON()).toMatchObject({
    value,
    website: '',
    block: 's10-bill-totals',
    text,
  });
  const payload = (await submitted).postDataJSON();
  expect(payload.token).toBeTruthy();
  expect(payload.url).not.toContain('val=');
  expect(payload.url).toContain('from=vedomstva');
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
