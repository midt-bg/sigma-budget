# Проверка на преструктурирането

Работното дърво фактически започна от `f03c9c4`, въпреки посочения в задачата `8f65861`. Допълненията от `8f65861` са пренесени в новите места: трите оригинала за бюджет 2027, пиновете, регистърът и пътищата на обработващите скриптове. Базовият сайт за SSR сравнението е сглобен от точния архив на `8f65861`, със същата staging конфигурация и обработка на статичните файлове.

Структурата и правилата са в [ADR 0003](adr/0003-repository-layout.md). Пълното съответствие на старите и новите файлови групи е в [историческата таблица](repository-layout-mapping.md).

## Промени освен преместванията

- Коренен npm workspace и един lockfile; запазени са всички предишни версии на зависимостите.
- Обновени Python корени, пакетни импорти, регистри, пинове, shell команди, Docker документация, CI и ръководства.
- Vite съставя статичните assets от public/, client/ и единственото копие на публикуваните данни. Адресите са същите.
- Статичните проверки съставят временен сайт със символни връзки в tmp/; няма дублирани данни в git.
- SSR parity поддържа строго сравнение на статус и всички HTML байтове между два Worker-а за всички runtime примери от таблицата на маршрутите.
- Имената в отчетите на действащите браузърни проверки са обновени. Очакванията и допустимите отклонения са запазени.

## Изпълнени проверки

Използвани са uv среди с Python 3.12 и lockfile-ите с хешове. Браузърите и средите са в tmp/. Командите с `python` са изпълнени с `tmp/venv/bin/python`; `budget` използва `tmp/venv-data/bin/python`. Липсващият на хоста OpenSSL е предоставен с временна обвивка към OpenSSL от закования pipeline образ; самите криптографски проверки са непроменени.

| Команда | Резултат |
|---|---|
| `npm ci` | успешно; версиите в lockfile са запазени |
| `npm run typecheck` | react-router typegen + tsc: успешно |
| `python pipeline/budget_pipeline/validate/registry.py check` | RESULT: OK · 0 error(s) |
| `./budget validate --site` | validation: RESULT OK: 47299 checks, 0 problems, 14 warnings |
| `python pipeline/budget_pipeline/validate/datasets.py` | RESULT OK: 47299 checks, 0 problems, 14 warnings, 1.3 s |
| `python tests/release/compat_check.py` | RESULT: PASS · 0 failed |
| `python apps/web/scripts/query_check.py` | 28 screens: every key the pages read is in its route's query list |
| `python apps/web/scripts/build.py --env staging --noindex` | RESULT: PASS · failures 0 · warnings 42; 777 screens checked (777 in the sitemap) in 208 s |
| `python tests/e2e/screens.py --url http://127.0.0.1:8814/` | routes 28 · checks 917 · browsers 3 · 348 s · failures 0 · warnings 16 · stubs 0 |
| `python tests/e2e/redirects.py` | redirects_v5: 22 case(s), 0 problem(s) |
| `python tests/e2e/calc_check.py` | RESULT: PASS: 699 checks, 0 failures |
| `python tests/e2e/share_check.py` | RESULT: PASS: 285 checks, 0 failures |
| `python tests/e2e/accept.py` | RESULT: PASS: 815 checks, 0 failures, 0 notes |
| `python tests/e2e/motion.py` | RESULT: PASS: 73 checks, 0 failures |
| `python tests/release/release_check.py` | RESULT: PASS · 60 checks, 0 failed |
| `python tests/release/restore_drill.py` | RESULT: PASS · 17 checks, 0 failed |
| `docker build -t sigma-budget-layout pipeline` | успешно |
| `Docker import smoke: fitz, xlrd, yaml, docx, pdfplumber, py7zr` | успешно; PyMuPDF 1.26.5 |
| `python apps/web/scripts/ssr_parity.py --baseline-url http://127.0.0.1:8815 --url http://127.0.0.1:8814 --host sigma-budget.my-data.bg` | 41 sample routes · 41 byte-identical · 0 different |
| `python pipeline/budget_pipeline/build/originals_sums.py --check` | 0 stale entries |
| `python -m compileall -q pipeline tests apps/web/scripts` | успешно |
| `git diff --check` | успешно |

## Исторически записи и неизменяеми данни

71 публикувани файла са сравнени байт по байт с `8f65861`: няма разлики. Това включва историческия манифест и validation report. Статусите на наборите и публичните адреси на примерните набори остават същите. Историческите тагове са непроменени; извличането на терминологията от двата тага е проверено отделно.

Буквалният grep има две неизбежни съвпадения извън историческата таблица и манифеста: старото име на инструмента в неизменяемия исторически validation report и случайна версионна последователност в компресиран поток на оригиналния АСБП PDF. Те са запазени, защото промяната им би нарушила изискването за идентични публикувани данни и оригинали. Извън тези неизменяеми записи и reference/ няма съвпадения.

Замразените извлечения остават в data/inputs/ с произхода си в регистъра. Пълното им заменяне с генериране в cache/ би променило последователността на текущото сглобяване; това е обяснено в ADR. Пълно ново преизграждане на всички набори не е изпълнявано: този checkout няма всички външни входове. Изпълнени са всички проверки на публикуваното издание и референтната среда, посочени по-горе.

Няма push, PR, release или deploy. Оригиналният проект СИГМА е използван само за четене.
