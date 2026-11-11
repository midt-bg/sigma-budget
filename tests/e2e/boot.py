"""Fresh mobile navigation: the first tap must survive a slow module boot.

Run against the built Worker: python -m tests.e2e.boot --url http://127.0.0.1:8980
"""
import argparse
import asyncio
from playwright.async_api import async_playwright

async def check(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for route in ['/', '/razhodi', '/za-proekta']:
            context = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, service_workers='block')
            page = await context.new_page()
            # Deterministically keep the essential module graph pending beyond DOMContentLoaded.
            async def delay(request):
                await asyncio.sleep(1)
                await request.continue_()
            await page.route('**/js/main.js', delay)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto(url.rstrip('/') + route, wait_until='domcontentloaded')
            await page.locator('#btn-menu').tap(force=True)
            await page.wait_for_selector('dialog.sheet-drawer[open]', timeout=20000)
            await page.wait_for_selector('article[data-ready="1"]', timeout=30000)
            assert await page.locator('dialog.sheet-drawer').is_visible(), route
            assert not errors, errors
            await context.close()
            print(f'PASS first tap {route}')
        await browser.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    asyncio.run(check(parser.parse_args().url))
