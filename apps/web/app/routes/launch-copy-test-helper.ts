import { parseHTML } from 'linkedom';

// The owner retired the working-group identity. Historical captures stay unchanged.
export const publicOrganization = (html: string) =>
  html
    .replaceAll('Работна група „Бюджет на светло“', 'СИГМА Бюджет')
    .replaceAll(',"alternateName":"СИГМА Бюджет"', '');

// The owner renamed two screens (their addresses stay), reordered the «Бюджет» menu group and removed the footer legend entry (the legend
// stays on the pages). Historical captures keep the old chrome and names; adapt exactly these parts and fail if one is not found.
// (the old names are split, so that the scan of live files in navigation.test.tsx does not match them here)
export const SCREEN_RENAMES = [
  ['Отворени данни и ' + 'API', 'Отворени данни и MCP'],
  ['Данни и ' + 'методика', 'Методология'],
  ['Данни и ' + 'проверка', 'Проверка на данните'],
] as const;
export const BUDGET_GROUP = ['S34', 'S05', 'S07', 'S06', 'S10', 'S12', 'S13', 'S20', 'S14'];
export const currentScreenNames = (html: string) =>
  SCREEN_RENAMES.reduce((s, [from, to]) => s.replaceAll(from, to), html).replaceAll(
    'Отворени <em>данни</em> и ' + 'API',
    'Отворени <em>данни</em> и MCP',
  );
export function currentNavigation(html: string) {
  const legend =
    /\s*<button type="button" class="link-btn" data-action="legend">Легенда: какво означават белезите<\/button>/;
  const group = /(<summary[^>]*>Бюджет<\/summary><ul>)([\s\S]*?)(<\/ul>)/;
  if (!legend.test(html) || !group.test(html))
    throw new Error('the capture has no footer legend or «Бюджет» group');
  return currentScreenNames(html)
    .replace(legend, '')
    .replace(group, (_, open: string, items: string, close: string) => {
      const byRoute = new Map(
        [...items.matchAll(/<li>[\s\S]*?<\/li>/g)].map(([li]) => [
          /data-route="(S\d+)"/.exec(li)![1],
          li,
        ]),
      );
      if ([...byRoute.keys()].sort().join() !== [...BUDGET_GROUP].sort().join())
        throw new Error(`unexpected «Бюджет» group: ${[...byRoute.keys()].join()}`);
      return open + BUDGET_GROUP.map((id) => byRoute.get(id)).join('') + close;
    });
}

// Historical captures retain «За проекта» and the old fine print; adapt exactly these parts and fail if one is not found.
// The legal pages (S36, S37, client/legal.js) precede the open code link.
export const FOOTER_LEGAL = [
  ['S36', '/poveritelnost', 'Поверителност'],
  ['S37', '/usloviya', 'Условия за ползване'],
] as const;
export function currentFooter(html: string) {
  const entry = /<li><a href="\/za-proekta" data-route="S26"[^>]*>За проекта<\/a><\/li>/;
  const sigma = /(\s*)(<span><a class="sister-link")/;
  if (!entry.test(html) || !sigma.test(html))
    throw new Error('the capture has no «За проекта» footer entry or СИГМА link');
  const beta =
    /\s*<span>Бета версия: няколко стойности са примерни и са означени със щриховка\.<\/span>/;
  const start = /(<summary[^>]*>Начало<\/summary><ul>)([\s\S]*?)(<\/ul>)/;
  const glossary = /<li><a href="\/rechnik" data-route="S03"[^>]*>Речник<\/a><\/li>/;
  const project = /(<summary[^>]*>Данни и проект<\/summary><ul>)/;
  if (!beta.test(html) || !glossary.test(start.exec(html)?.[2] ?? '') || !project.test(html))
    throw new Error('the capture has no beta note, «Речник» in «Начало» or «Данни и проект» group');
  return html
    .replace(entry, '')
    .replace(beta, '')
    .replace(start, (_, open, items, close) => open + items.replace(glossary, '') + close)
    .replace(project, '$1<li><a href="/rechnik" data-route="S03">Речник</a></li>')
    .replace(
      sigma,
      (_, space: string, link: string) =>
        FOOTER_LEGAL.map(
          ([id, path, label]) =>
            `${space}<span><a href="${path}" data-route="${id}">${label}</a></span>`,
        ).join('') +
        `${space}<span><a class="code-link" href="https://github.com/midt-bg/sigma-budget" target="_blank" rel="noopener"><span><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>Отворен код</span><span class="sr-only"> (друг сайт, в нов раздел)</span></a></span>` +
        space +
        link,
    );
}

// Only the shared missing-data presentation changes; preserve headings, links and controls.
export function finalPendingCopy(html: string) {
  const { document } = parseHTML(html.replaceAll('Предстои', 'Няма данни'));
  document.querySelectorAll('.state-pending').forEach((state) => {
    state.querySelector('.state-text')!.textContent =
      'Не показваме число без налични официални данни за този показател.';
    state.querySelectorAll('.state-text.small').forEach((note) => note.remove());
  });
  return document.toString();
}

// Adapt only the retired API proposal and launch copy; retain the rest of the frozen oracle.
export function finalApiCopy(html: string) {
  html = html
    .replace(
      /, а още \d+ набора предстоят\. Истински API има само като предложение за втората фаза: виж по-долу\./g,
      '.',
    )
    .replaceAll(
      'Статус на данните: real (официални), partial (частични), forecast (прогнозни), mock (примерни) или pending (предстоящи).',
      'Статус на публикувания набор: real (официални), partial (частични) или forecast (прогнозни).',
    )
    .replaceAll(
      'Какво още предстои да се добави, когато има такова.',
      'Описание на липсващите данни, ако е включено във файла.',
    )
    .replaceAll('true, ако стойностите са измислени.', 'В публикуваните набори стойността е false.')
    .replaceAll(
      'Сайтът е в бета версия: адресите и полетата във файловете още могат да се променят без предупреждение. Затова при ползване записвай версията и датата „Данни към“ от блока ',
      'При използване на данните посочвай версията и датата „Данни към“ от блока ',
    )
    .replaceAll('Това е действителният блок', 'Това е блокът с основните полета от');
  const { document } = parseHTML(html);
  document.getElementById('s25-proposal')?.closest('section')?.remove();
  document.querySelectorAll('a[href*="to=s25-proposal"]').forEach((link) => link.remove());
  document
    .querySelectorAll('#s25-files ~ *, section[aria-labelledby="s25-files"] p.small.muted')
    .forEach((node) => {
      if (node.tagName === 'P' && node.textContent?.startsWith('Още ')) node.remove();
    });
  document.querySelectorAll('li').forEach((node) => {
    if (node.textContent === 'Примерните набори са измислени и не се цитират като действителни.')
      node.remove();
  });
  document.querySelectorAll('p').forEach((node) => {
    if (node.textContent?.startsWith('В истинския портал предлагаме'))
      node.innerHTML = 'Историята на изданията е в <a href="/proverka">„Проверка на данните“</a>.';
  });
  document.querySelector('.s25-set-d')?.remove(); // Dataset descriptions contain internal release notes.
  const meta = document.getElementById('s25-c-meta');
  if (meta) {
    const data = JSON.parse(meta.textContent!);
    delete data.pending;
    delete data.sourceNote;
    meta.textContent = JSON.stringify(data, null, 2);
    if (!meta.textContent.includes('…')) {
      const note = meta.closest('.s25-snip')!.previousElementSibling!;
      note.textContent = note.textContent!.replace(': дългите текстове са съкратени.', '.');
    }
  }
  return finalPendingCopy(document.toString());
}
