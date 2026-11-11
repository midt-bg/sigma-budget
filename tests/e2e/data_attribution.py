"""DATA audit regressions against the built Worker at desktop and 390px."""
import argparse
from playwright.sync_api import sync_playwright, expect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    args = parser.parse_args()
    checks = 0
    periods = {
        '2024.report': 'Отчетни данни за 2024 г.',
        '2025.report': 'Отчетни данни за 2025 г.',
        '2026.law': 'Приет закон за 2026 г., Приложение 1.',
        '2026.expected': 'Очаквано изпълнение за 2026 г., Приложение 3',
        '2027.draft': 'Проект за 2027 г., Приложение 3',
        '2028.forecast': 'Прогноза за 2028 г., Приложение 3',
        '2029.forecast': 'Прогноза за 2029 г., Приложение 3',
    }
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width in (1440, 390):
            ctx = browser.new_context(viewport={'width': width, 'height': 900},
                                      service_workers='block', reduced_motion='reduce')
            page = ctx.new_page()
            for period, attribution in periods.items():
                for route, block in [('prognoza', 's13-sum'), ('prihodi', 's06-notes'),
                                     ('razhodi', 's07-notes')]:
                    if period == '2026.law' and route != 'prognoza':
                        block = 's06-annual-coverage' if route == 'prihodi' else 's07-annual-coverage'
                    page.goto(args.url.rstrip('/') + '/' + route + '?per=' + period)
                    page.locator('article[data-ready="1"]').wait_for()
                    expect(page.locator('#' + block)).to_contain_text(attribution)
                    checks += 1
                    expect(page.locator('article')).not_to_contain_text('Приетият закон може да се различава от проекта')
                    checks += 1
                page.goto(args.url.rstrip('/') + '/bvp?per=' + period)
                page.locator('article[data-ready="1"]').wait_for()
                sector = page.locator('#s31-b-sectors')
                for text in ['замразена снимка', 'Има по-късни ревизии',
                             'част от историческите оригинали липсват',
                             'Версия на източника: 07.10.2026', 'Придобиване: 09.10.2026']:
                    expect(sector).to_contain_text(text)
                    checks += 1
                expect(sector.get_by_role('link', name='Ограничения на изданието')).to_have_attribute('href', '/proverka?to=s35-coverage')
                checks += 1
            page.goto(args.url.rstrip('/') + '/danni')
            page.locator('article[data-ready="1"]').wait_for()
            for text in ['само за старите масиви към проекта за 2026',
                         '2026.expected е очаквано изпълнение', '2027.draft е проект',
                         '2028.forecast и 2029.forecast са прогнози']:
                expect(page.locator('.s24-item[data-id="two-versions"]')).to_contain_text(text)
                checks += 1
            ctx.close()
        browser.close()
    print(f'DATA attribution: {checks} checks, 0 failures; 1440px and 390px')


if __name__ == '__main__':
    main()
