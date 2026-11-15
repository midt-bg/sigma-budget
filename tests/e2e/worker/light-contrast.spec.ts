import { test, expect } from '../audit-fixtures.ts';
import { expandContent, measureContrast, type ContrastResult } from '../contrast.ts';

type RouteCase = {
  id: string;
  path: string;
  categories: (keyof Pick<ContrastResult, 'texts' | 'fields' | 'placeholders' | 'boundaries'>)[];
};
const routes: RouteCase[] = [
  {
    id: 'S01',
    path: '/',
    categories: [],
  },
  {
    id: 'S04',
    path: '/5-minuti',
    categories: [],
  },
  {
    id: 'S03',
    path: '/rechnik',
    categories: ['fields', 'placeholders', 'boundaries'],
  },
  {
    id: 'S15',
    path: '/izpalnenie',
    categories: ['texts'],
  },
  {
    id: 'S16',
    path: '/novo',
    categories: ['fields', 'boundaries'],
  },
  {
    id: 'S34',
    path: '/byudzhet-2027',
    categories: ['texts', 'fields', 'boundaries'],
  },
  {
    id: 'S05',
    path: '/pari',
    categories: [],
  },
  {
    id: 'S07',
    path: '/razhodi',
    categories: ['texts'],
  },
  {
    id: 'S08',
    path: '/razhodi/obrazovanie',
    categories: ['texts'],
  },
  {
    id: 'S06',
    path: '/prihodi',
    categories: ['texts'],
  },
  {
    id: 'S10',
    path: '/vedomstva',
    categories: ['texts', 'fields', 'boundaries'],
  },
  {
    id: 'S11',
    path: '/vedomstvo/1300',
    categories: [],
  },
  {
    id: 'S12',
    path: '/merki',
    categories: [],
  },
  {
    id: 'S13',
    path: '/prognoza',
    categories: ['texts'],
  },
  {
    id: 'S20',
    path: '/obshtini',
    categories: ['fields', 'boundaries'],
  },
  {
    id: 'S21',
    path: '/obshtina/BLG03',
    categories: [],
  },
  {
    id: 'S14',
    path: '/zakon',
    categories: [],
  },
  {
    id: 'S18',
    path: '/danaci',
    categories: ['fields', 'boundaries'],
  },
  {
    id: 'S17',
    path: '/dalg',
    categories: ['texts'],
  },
  {
    id: 'S31',
    path: '/bvp',
    categories: ['texts'],
  },
  {
    id: 'S24',
    path: '/danni',
    categories: ['fields', 'boundaries'],
  },
  {
    id: 'S35',
    path: '/proverka',
    categories: [],
  },
  {
    id: 'S25',
    path: '/api',
    categories: [],
  },
  {
    id: 'S27',
    path: '/vrazka',
    categories: ['fields', 'boundaries'],
  },
  {
    id: 'S28',
    path: '/tarsene',
    categories: ['fields', 'placeholders', 'boundaries'],
  },
  {
    id: 'S30',
    path: '/nyama-takava',
    categories: ['fields', 'placeholders', 'boundaries'],
  },
];
const viewports = [
  { width: 1280, height: 900 },
  { width: 400, height: 800 },
];

test.describe('light contrast route coverage', () => {
  test.use({ serviceWorkers: 'block', colorScheme: 'light', reducedMotion: 'reduce' });
  test('catalogue includes every non-bare route', async ({ page, visit }) => {
    await visit('/');
    const discovered = await page.evaluate((): { id: string; path: string }[] => {
      const catalogue = (
        window as unknown as { __ROUTES__: { id: string; bare?: boolean; samples?: string[] }[] }
      ).__ROUTES__;
      return catalogue
        .filter((route) => !route.bare)
        .map((route) => ({
          id: route.id,
          path: (route.samples?.[0] ?? '/nyama-takava').replace(/^#/, ''),
        }));
    });
    expect(discovered.length).toBeGreaterThan(0);
    expect(discovered).toEqual(routes.map(({ id, path }) => ({ id, path })));
  });
  for (const viewport of viewports) {
    test.describe(`${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport });
      for (const route of routes) {
        test(`${route.id} ${route.path}: chart text, placeholders and field boundaries`, async ({
          page,
          visit,
        }, testInfo) => {
          await visit(route.path);
          await expandContent(page);
          const result = await measureContrast(page);
          await testInfo.attach('contrast', {
            body: JSON.stringify(result, null, 2),
            contentType: 'application/json',
          });
          for (const category of route.categories)
            expect(result[category], category + ' coverage').toBeGreaterThan(0);
          expect(result.textViolations, 'chart labels: 4.5 small text, 3 large text').toEqual([]);
          expect(result.placeholderViolations, 'placeholders: 4.5').toEqual([]);
          expect(result.boundaryViolations, 'field boundaries: 3').toEqual([]);
        });
      }
    });
  }
});

test.describe('contrast threshold controls', () => {
  // The independent fixture permits service workers; route visits above block them.
  test.use({ serviceWorkers: 'allow', colorScheme: 'light' });
  test('small and large labels, placeholders and field boundaries straddle the thresholds', async ({
    page,
  }) => {
    await page.setContent(`<style>
      body { background:#fff; }
      input { background:#fff; outline:none; border:1px solid; }
      #bad-field { border-color:#969696; }
      #bad-field::placeholder { color:#777; opacity:1; }
      #good-field { border-color:#949494; }
      #good-field::placeholder { color:#767676; opacity:1; }
    </style><div id="view"><div class="chart" data-ready="1">
      <svg width="500" height="150">
        <text x="10" y="20" fill="#777" font-size="12">small-fail</text>
        <text x="10" y="50" fill="#767676" font-size="12">small-pass</text>
        <text x="10" y="90" fill="#969696" font-size="24">large-fail</text>
        <text x="10" y="130" fill="#949494" font-size="24">large-pass</text>
      </svg></div>
      <input id="bad-field" placeholder="Unreadable placeholder">
      <input id="good-field" placeholder="Readable placeholder">
    </div>`);
    const result = await measureContrast(page);
    expect(
      result.textViolations.map((item) => item.text).sort(),
      '4.5 small / 3 large text',
    ).toEqual(['large-fail', 'small-fail']);
    expect(
      result.placeholderViolations.map((item) => item.name),
      '4.5 placeholder',
    ).toEqual(['bad-field']);
    expect(
      result.boundaryViolations.map((item) => item.name),
      '3 field boundary',
    ).toEqual(['bad-field']);
  });
});
