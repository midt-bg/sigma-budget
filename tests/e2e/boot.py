"""Fresh mobile navigation: the first tap must survive a slow module boot.

Run against the built Worker: python -m tests.e2e.boot --url http://127.0.0.1:8980
"""
import argparse
import asyncio
import re
from playwright.async_api import async_playwright

async def check(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for route, phase in [(route, phase) for route in ['/', '/razhodi', '/za-proekta'] for phase in ['domcontentloaded', 'commit']]:
            context = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, service_workers='block')
            page = await context.new_page()
            # Deterministically keep the essential module graph pending beyond DOMContentLoaded.
            async def delay(request):
                await asyncio.sleep(1)
                await request.continue_()
            await page.route('**/js/main.js', delay)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto(url.rstrip('/') + route, wait_until=phase)
            await page.locator('#btn-menu').tap()
            await page.wait_for_selector('dialog.sheet-drawer[open]', timeout=20000)
            await page.wait_for_selector('article[data-ready="1"]', timeout=30000)
            assert await page.locator('dialog.sheet-drawer').is_visible(), route
            assert await page.locator('#btn-menu').get_attribute('aria-expanded') == 'true', route
            assert not errors, errors
            await context.close()
            print(f'PASS first tap {route} at {phase}')
        for route, screen in [('/za-proekta', 'S26'), ('/nyama-takava', 'S30'), ('/api', 'S25'), ('/proverka', 'S35'), ('/zakon', 'S14'), ('/novo', 'S16')]:
            context = await browser.new_context(service_workers='block')
            page = await context.new_page()
            loaded = set()
            errors = []
            page.on('request', lambda request: loaded.update(re.findall(r'/screen-(S\d+)-', request.url)))
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' and 'React error' in message.text else None)
            await page.goto(url.rstrip('/') + route, wait_until='domcontentloaded')
            await page.wait_for_selector('#view[data-react-owned] article[data-ready="1"]', timeout=30000)
            assert loaded == {screen}, (route, loaded)
            assert not errors, (route, errors)
            await context.close()
            print(f'PASS isolated screen {screen}')
        await browser.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    asyncio.run(check(parser.parse_args().url))
