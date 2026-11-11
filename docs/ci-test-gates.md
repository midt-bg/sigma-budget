# CI проверки и покритие

`site.yml` изпълнява всички Node suites веднъж в job `coverage`, с V8 coverage от Vitest 4.1.12. Самостоятелните wave jobs запазват независимите Python, frozen-donor, provenance и CLI candidate проверки. Тестовите parity отчети се качват от `coverage`. Сглобеният web артефакт се използва повторно от browser проверките и staging deploy.

`required-validation` зависи от всички останали проверки, включително wave14, wave15, wave15b, wave17a/b/c, wave18, aggregation/catalog parity, data-image, node-import и reusable security workflow (semgrep и dependencies-and-secrets). Изпълнява се с `always()` и приема само `success` за всяка зависимост; failure, cancellation и skipped блокират deploy. Staging deploy зависи само от тази бариера. Security и wave15b се извикват от site workflow; имат и ръчно стартиране, без дублиращи PR/push изпълнения.

Операторска стъпка: branch protection трябва да изисква `required-validation` и `coverage`. Тази промяна не настройва GitHub branch protection и не разрешава production deploy.

## Coverage baseline

`coverage-baseline.json` съдържа измерените начални lines/branches проценти за всеки workspace с тестова команда. `coverage-summary.md` показва също functions/statements. Ниското покритие се отчита честно; базата не е твърдение за достатъчност на тестовете.

Включени са всички производствени TS/JS файлове в `src` и CLI launcher-ите в `bin`, а за web - `app`, `client`, `workers`, service worker и candidate-data adapter, дори когато никой тест не ги импортира. Изключени са само тестове, декларации и fixture директории. CLI subprocess изпълненията проверяват реалната компилирана граница, но V8 отчетът на родителския Vitest процес не приписва тяхното покритие на изходния TypeScript.

Локално: `pnpm test -- --coverage`, после `pnpm check:coverage`. Липсващ workspace/отчет или невалидни метрики провалят gate. Допустимият шум е 0.5 процентни пункта за lines/branches по workspace, както в СИГМА. Базата се обновява само след преглед с `node scripts/check-coverage.mjs --update`; не се обновява автоматично в CI.

Умишлена временна регресия се описва в `coverage-exceptions.json`: `workspace`, `metric` (`lines`/`branches`), `minimum`, конкретно `reason`, `review` (URL към PR в това хранилище) и `expires` (UTC YYYY-MM-DD). Записът подлежи на преглед като код; празни причини, дублирани/неизвестни обхвати и изтекли изключения провалят проверката. Първоначално няма изключения. Не се добавят изключения за неуспешни тестове.

## Формат

`pnpm format:check` проверява целия поддържан от Prettier набор с `--ignore-unknown`; `pnpm format` го форматира. Това е format gate, не semantic lint. Python, shell и другите неподдържани езици се проверяват чрез съответните тестове, а не се представят като форматирани от Prettier.

Прегледаните изключения в `.prettierignore` пазят `data/`, `reference/`, историческия `pipeline/`, frozen fixtures/oracles, vendored и генерирани файлове. Масовото форматиране е отделен последен commit върху main след сливането на PR #57 (тема), #58 (име) и #59 (формулировки и източници). При следващи паралелни client JS промени format pass се изпълнява отново. Замразените bytes не се форматират.

## Изходно CI време

Измерено чрез `gh run list` и `gh run view` за успешния site run `42945661686` от 2026-11-11: build 1036 s, от които Node tests 696 s; зависимият browser check 1095 s. Последователният път е 2131 s (35 min 31 s), без опашката за runner. Самостоятелният повторен wave17a suite е 723 s. По-новият неуспешен run `43014760197` има build 928 s и wave17a 659 s.

При същите останали времена изваждането на Node tests от build дава приблизително 1435 s (23 min 55 s) за build + browser check, около 33% по-кратък път. Отделният coverage job също трябва да завърши преди общата бариера. Това е оценка от исторически стъпки, не обещание за runner време; опашката, натоварването и V8 overhead се отчитат отделно при сравнение с PR run.

Literal HTML/CSS и кодовите примери в низове не се преформатират (`embeddedLanguageFormatting: off`): те участват в byte-level oracle договори. JSONC се форматира без trailing commas за съвместимост с текущите проверяващи parsers. Това запазва съдържанието на договорите, без да изключва поддържаните JS/TS/JSONC файлове от format gate.

Browser bootstrap използва официалния Ubuntu archive mirror вместо Azure mirror след повторени DNS откази в main и PR CI. Запазени са security/third-party repositories, apt signing keys и всички Playwright зависимости и проверки. Тази CI-only поправка следва вече публикувания отделен format commit; публикуваната история не се пренаписва.
