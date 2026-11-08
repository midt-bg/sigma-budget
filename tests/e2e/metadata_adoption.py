"""Verify the metadata islands adopt the actual built Worker's server DOM.

    python -m tests.e2e.metadata_adoption --url http://127.0.0.1:8895
"""
import argparse
import json
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--url', required=True)
    base = ap.parse_args().url.rstrip('/')
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for path in ['/api', '/api?set=execution', '/api?set=ministries-programs', '/proverka']:
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.add_init_script("window.firstArticle=null;new MutationObserver(()=>{window.firstArticle ||= document.querySelector('article.page');}).observe(document,{subtree:true,childList:true});")
            page.goto(base + path)
            page.wait_for_selector('article[data-ready="1"]')
            adopted = page.evaluate("window.firstArticle === document.querySelector('article.page')")
            results.append({'path': path, 'adopted': adopted, 'errors': errors})
            page.close()
        browser.close()
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if all(r['adopted'] and not r['errors'] for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
