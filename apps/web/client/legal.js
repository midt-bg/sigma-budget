// The copy of the two legal pages, S36 „Поверителност“ (/poveritelnost) and S37 „Условия за ползване“ (/usloviya), shared by the React screens
// (app/routes/legal-content.tsx) and their legacy twins (client/pages/s36-poveritelnost.js, s37-usloviya.js), so the text exists once.
// A section is {id, title, body}; a body item is {p: parts} or {list: [parts, …]}; parts is a string or a list of a string,
// {route: [id, params, query], text} (a screen of the site), {url, text} (another site) or {contact: true} (the feedback page).
// Claims are backed by client/store.js (preferences and notices), pages/s27-vrazka.js (session-only drafts),
// public/sw.js (offline cache), and client/feedback.js (lazy Turnstile and POST transport, no receipt archive).
// workers/api/vrazka.ts stores text/context/optional contact in private R2; vrazka-window.ts expires keyed IP hashes
// at the hourly boundary. workers/release-rate-limit.ts handles the separate minute-long request limit.
// wrangler.jsonc disables invocation logs; workers/mcp/handler.ts does not log conversation arguments.
// Team access, possible external AI processing, and manual deletion are described in docs/signali.md.
// Keep this copy aligned with those implementations; Turnstile processes the IP during verification.
import { html } from './html.js';
import { href } from './routes.js';

export const UPDATED = '16 ноември 2026 г.';
export const CODE_URL = 'https://github.com/midt-bg/sigma-budget';
const code = { url: CODE_URL, text: 'github.com/midt-bg/sigma-budget' };

export const PAGES = {
  S36: [
    {
      id: 's36-nakratko',
      title: 'Накратко',
      body: [
        {
          p: 'Няма регистрация и профили, нито инструменти за анализ на посещенията или реклама. Формулярите за обратна връзка използват Cloudflare Turnstile за защита от автоматични съобщения.',
        },
      ],
    },
    {
      id: 's36-brauzar',
      title: 'Какво остава само в браузъра',
      body: [
        {
          p: 'За удобство браузърът пази някои неща в своята памет (localStorage и sessionStorage). Те не се изпращат към сървъра:',
        },
        {
          list: [
            'настройките на изгледа, например обхват и мерна единица;',
            'кои новини вече са видени и дали е скрито съобщението в горната част на сайта;',
            'черновата на обратната връзка, която подготвяте, докато разделът е отворен;',
            'копие на страниците, за да се отварят и без връзка с интернет.',
          ],
        },
        {
          p: 'Числата, които въвеждате в калкулатора за данъци, също не напускат браузъра. Всичко това се изтрива от настройките на браузъра, като изчистите данните за сайта.',
        },
      ],
    },
    {
      id: 's36-vrazka',
      title: 'Обратна връзка',
      body: [
        {
          p: [
            'Формулярът ',
            { route: ['S27'], text: '„Обратна връзка“' },
            ' изпраща текста, контекста (например екран, число, източник или термин) и имейла, само ако го дадете. Сигналите се пазят в частно хранилище в ЕС до ръчното им изтриване. Сигналите се четат от екипа на СИГМА Бюджет в МИДТ и може да се обработват и с външна услуга с изкуствен интелект. Не включвайте лични данни в текста.',
          ],
        },
      ],
    },
    {
      id: 's36-hosting',
      title: 'Хостинг и сигурност',
      body: [
        {
          p: [
            'Сайтът работи в Cloudflare. При всяка заявка Cloudflare обработва IP адреса, за да достави страницата и да я защити от атаки, според ',
            {
              url: 'https://www.cloudflare.com/privacypolicy/',
              text: 'своята политика за поверителност',
            },
            '.',
          ],
        },
        {
          p: 'Общото ограничение на заявките към сайта държи IP адреса в паметта до една минута. За лимита на сигналите адресът се използва само за получаване на хеш с таен ключ, който се пази най-много един час. Адресът и хешът не влизат в сигнала. Cloudflare Turnstile обработва IP адреса при проверката. Сайтът не води дневник на посещенията.',
        },
      ],
    },
    {
      id: 's36-ai',
      title: 'AI асистенти',
      body: [
        {
          p: 'Адресът /mcp дава на AI асистенти, например ChatGPT и Claude, достъп до същите публични данни. До сайта стигат само параметрите на конкретното извикване, например думата за търсене, а не разговорът. Те не се записват. Разговорът с асистента се обработва от неговия доставчик по неговата политика за поверителност.',
        },
      ],
    },
    {
      id: 's36-kod',
      title: 'Отворен код',
      body: [
        {
          p: [
            'Кодът на сайта е публичен, така че всичко описано тук може да се провери: ',
            code,
            '.',
          ],
        },
      ],
    },
    {
      id: 's36-vaprosi',
      title: 'Въпроси',
      body: [{ p: ['Въпроси за тази политика: ', { contact: true }, '.'] }],
    },
  ],
  S37: [
    {
      id: 's37-sait',
      title: 'Какво представя сайтът',
      body: [
        {
          p: 'СИГМА Бюджет представя данните за държавния бюджет на България от официалните документи на Министерството на финансите, НСИ, Евростат и други институции. До всяко число стоят източникът, обхватът, статусът и датата.',
        },
      ],
    },
    {
      id: 's37-tochnost',
      title: 'Точност',
      body: [
        {
          p: 'Числата се извличат от документите със скриптове и се проверяват, но може да има грешки. При разлика между сайта и официалния документ важи документът.',
        },
        {
          p: 'Речникът и поясненията са редакционни текстове, а не официални данни. Сайтът е информационен и не е правен, данъчен или финансов съвет.',
        },
      ],
    },
    {
      id: 's37-danni',
      title: 'Използване на данните',
      body: [
        {
          p: 'Данните са публични: идват от официални документи и нямат отделен лиценз. Всеки първичен източник има свои условия.',
        },
        {
          p: [
            'Източниците и готовото цитиране на всеки набор са в ',
            { route: ['S24', {}, { to: 's24-sources' }], text: '„Откъде са данните?“' },
            '. При използване посочвайте първоизточника.',
          ],
        },
      ],
    },
    {
      id: 's37-api',
      title: 'Файлове, API и MCP',
      body: [
        {
          p: [
            'Файловете с данни, ',
            { route: ['S25'], text: 'API' },
            ' и MCP сървърът за AI асистенти са без ключ и без вход. Броят на заявките е ограничен, за да остане услугата достъпна за всички. При превишаване сървърът отговаря с код 429 и казва кога да опитате отново.',
          ],
        },
      ],
    },
    {
      id: 's37-vrazka',
      title: 'Сигнали и предложения',
      body: [
        {
          p: [
            'Формулярите за обратна връзка са за грешки, неясни обяснения и идеи за сайта. Изпращането изисква проверка с Cloudflare Turnstile и е ограничено до 10 сигнала на час от един адрес и 100 общо. Полученият номер потвърждава записването на сигнала. За съхранението и обработването вижте ',
            { route: ['S36'], text: 'политиката за поверителност' },
            '.',
          ],
        },
      ],
    },
    {
      id: 's37-ai',
      title: 'Отговорите на AI асистенти',
      body: [
        {
          p: 'Отговорите на AI асистентите са техни, не на сайта. Проверявайте числата по връзките към сайта, които асистентът дава.',
        },
      ],
    },
    {
      id: 's37-kod',
      title: 'Изходен код',
      body: [{ p: ['Кодът на сайта е под лиценза MIT: ', code, '.'] }],
    },
    {
      id: 's37-promeni',
      title: 'Промени',
      body: [
        { p: 'Условията може да се променят. Датата на последната промяна е под този текст.' },
      ],
    },
    {
      id: 's37-vaprosi',
      title: 'Въпроси',
      body: [{ p: ['Въпроси за условията: ', { contact: true }, '.'] }],
    },
  ],
};

/** the parts of a paragraph as a list, a lone string included */
export const partsOf = (p) => (Array.isArray(p) ? p : [p]);
/** Resolve a reference to a page or external source. */
export function target(part) {
  if (part.contact) return { href: href('S27'), text: 'страницата „Обратна връзка“' };
  if (part.url) return { href: part.url, text: part.text };
  const [id, params = {}, query = {}] = part.route;
  return { href: href(id, params, query), text: part.text };
}

/** the body of a legal page for the legacy renderer; the React one is app/routes/legal-content.tsx */
export function legalHtml(screen) {
  const parts = (p) =>
    partsOf(p).map((x) => {
      if (typeof x === 'string') return x;
      const t = target(x);
      return html`<a href="${t.href}">${t.text}</a>`;
    });
  return html`<div class="legal">${PAGES[screen].map(
    (s) =>
      html`<section class="legal-block" aria-labelledby="${s.id}"><h2 id="${s.id}" tabindex="-1">${s.title}</h2>${s.body.map(
        (b) =>
          b.list
            ? html`<ul>${b.list.map((li) => html`<li>${parts(li)}</li>`)}</ul>`
            : html`<p>${parts(b.p)}</p>`,
      )}</section>`,
  )}<p class="legal-updated">Последна промяна: ${UPDATED}</p></div>`;
}
