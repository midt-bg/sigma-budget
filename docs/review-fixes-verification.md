# Поправки след независимия преглед

Приложен е последният обхват: преименуванията са отделни, историческото сглобяване е извън производствения код, а операциите по изданията остават в cli.py. Празният release пакет и placeholder pipeline/tests са премахнати. Няма нов unittest пакет или CI стъпка за него.

Преходът към пакетно изпълнение вече беше завършен и проверен при промяната на обхвата, затова е запазен по разрешеното изключение. Командите използват `python -m`; няма смесен поддържан режим с директни файлови входове. При локална подготовка и CI се използва editable install след hash-locked зависимостите. Обвивката budget и Docker предоставят PYTHONPATH, така че editable install не е нужен в изолираното сглобяване.

## Статус по констатациите

| Констатация | Статус и доказателство |
|---|---|
| Операторски ръководства | Поправени root-based source и built config пътища в трите ръководства. Account-local конфигурацията е до source конфигурацията. Vite разрешава WRANGLER_CONFIG от корена. Основната, staging и account-local конфигурацията са проверени с локален migrations list; локалната конфигурация и с TypeScript; built deploy формата с dry-run. |
| Пакетен вход и bootstrap | Завършеният пакетен режим е запазен. Bootstrap текстът е премахнат и от docstrings; Python 3.12 е единното изискване. Чиста uv среда без editable install изпълнява CLI, examples, datasets и editorial --help, guide --check, производството и независимата проверка на двата примерни набора. |
| Историческо сглобяване | run_all.sh, генерирането на M01–M05, старият base и subprocess групите са в reference/. В производствения валидатор няма MOCK или donor REBUILD група. Няма sys.path манипулации, импорт или извикване на reference/ от pipeline/, apps/ или tests/. Текущият вход е budget build → build.rebuild. |
| Останала терминология | Поправени са data_io, datasets, loc.js, CI коментарите и текущите указания. Неработещият екстрактор на стария HTML е в reference/. Историческите записи и публикуваните данни са запазени. |
| Guide | Само build.guide е действащ; дубликатът е архивиран. --check завършва без проблеми. |
| Имена | Отделен rename commit. Слоят е в директорията, предметът - в snake_case името. Пълната таблица е в repository-layout-mapping.md, правилото - в ADR 0003. |
| Release модули и нов unittest пакет | Отпаднали по последното указание. Операциите остават в cli.py, а празните директории са премахнати. |

## Проверки

Python командите използват tmp/venv (Python 3.12); средите и браузърите са в tmp/. Release и restore са изпълнени в чист архив на окончателния код, за да не презаписват проверявания staging build. OpenSSL е предоставен от закования Docker образ чрез временна обвивка. Използвани са локални портове, различни от заетите портове на основния проект.

| Команда / проверка | Резултат |
|---|---|
| `npm ci` | PASS; pinned dependency versions retained |
| `npm run typecheck` | PASS: react-router typegen + tsc |
| `python -m budget_pipeline.validate.registry check` | RESULT: OK · 0 error(s) |
| `./budget validate --site` | validation: RESULT OK: 47297 checks, 0 problems, 14 warnings |
| `python -m budget_pipeline.validate.datasets` | RESULT OK: 47297 checks, 0 problems, 14 warnings, 1.4 s |
| `python -m budget_pipeline.validate.examples` | M06 PASS []; M07 PASS [] |
| `python -m tests.release.compat_check` | RESULT: PASS · 0 failed |
| `python -m apps.web.scripts.query_check` | 28 screens: every key the pages read is in its route's query list |
| `python -m apps.web.scripts.build --env staging --origin https://sigma-budget.my-data.bg --noindex` | RESULT: PASS · failures 0 · warnings 42; 777 screens checked (777 in the sitemap) in 218 s |
| `python -m tests.e2e.screens --url http://127.0.0.1:8814/` | routes 28 · checks 917 · browsers 3 · 322 s · failures 0 · warnings 16 · stubs 0 |
| `python -m tests.e2e.redirects` | redirects: 22 case(s), 0 problem(s) |
| `python -m tests.e2e.calc_check` | RESULT: PASS: 699 checks, 0 failures |
| `python -m tests.e2e.share_check` | RESULT: PASS: 285 checks, 0 failures |
| `python -m tests.e2e.accept` | RESULT: PASS: 815 checks, 0 failures, 0 notes |
| `python -m tests.e2e.motion` | RESULT: PASS: 73 checks, 0 failures |
| `python -m tests.release.release_check` | RESULT: PASS · 60 checks, 0 failed |
| `python -m tests.release.restore_drill` | RESULT: PASS · 17 checks, 0 failed |
| `docker build -t sigma-budget-r2 pipeline` | PASS |
| `docker run --rm -v "$PWD":/repo:ro sigma-budget-r2 python -m budget_pipeline.environment` | PASS; PyMuPDF 1.26.5 |
| `SSR parity against f03c9c4` | 41 sample routes · 41 byte-identical · 0 different |
| `Executable JS AST comparison against f03c9c4` | files=89, executable differences=0 |

## Чиста среда и регистри

Средата tmp/r2/clean е създадена с uv и само pipeline/requirements.lock. Пакетът не е инсталиран editable в нея. Командите се изпълняват с PYTHONPATH=$PWD/pipeline, както го задава обвивката. Метаданните на M06/M07 се проверяват с датата от публикуваните им файлове; не е въведена нова дата или числова стойност на ръка. И двата резултата са byte-identical. Независимият валидатор запазва ограниченията за тези два набора и използва текущото им означение „официална ставка“.

Imported modules: 74 resolved registry commands: 97

Проверени локални форми:

```bash
npx wrangler d1 migrations list DB --local -c apps/web/wrangler.jsonc
npx wrangler d1 migrations list DB --local -c apps/web/wrangler.jsonc --env staging
npx wrangler d1 migrations list DB --local -c apps/web/wrangler.local.jsonc --env staging
WRANGLER_CONFIG=apps/web/wrangler.local.jsonc npm run typecheck
npx wrangler deploy --dry-run -c apps/web/build/server/wrangler.json --outdir tmp/r2/deploy-dry-run
```

## Инварианти

- data: 70 файла, 0 разлики.
- css: 35 файла, 0 разлики.
- release: 71 файла, 0 разлики.

SSR сравнението е строго по статус и всички HTML байтове, без нормализиране. И двата staging Worker-а са стартирани с еднакви SITE_ORIGIN и NOINDEX, както при обхода на build скрипта; отделни портове избягват влияние от кеширания адрес на браузърната проверка. Базовият build е от точен git archive на f03c9c4. JavaScript сравнението използва TypeScript parser/printer с премахнати коментари. Публикуваното издание, включително историческите manifest и validation report, е непроменено. Зависимостта от mock-v2/mock-v4 остава и е проверена чрез извличане на входовете от таговете.

Няма push, PR или промяна на отдалечена среда. Release тестовете използват само локални синтетични издания, а deploy --dry-run проверява локалното пакетиране.
