// S27 · Обратна връзка · /vrazka · no period. Three report forms share client/feedback.js.
// Link context (?from=, ?val=, ?src=, ?block=) accompanies POST /api/vrazka; val is hidden, never editable.
// Only the form being filled starts Turnstile. A receipt is shown after R2 storage; failures keep the draft.
// Unsent drafts survive re-renders in sessionStorage until this tab closes; sent reports are not archived here.
import { html } from '../html.js';
import { ROUTES, GROUPS, byKey, byId, match } from '../routes.js';
import { safe } from '../store.js';
import { facts } from '../ui/cards.js';
import { tabs } from '../ui/tabs.js';
import { srcShort } from '../ui/source.js';
import * as feedback from '../feedback.js';

export const needs = [];
export const styles = ['s27-vrazka'];
export const lede = () => 'Намери грешка, кажи какво не ти е ясно или предложи идея.';

const MIN = 5; // letters of text before a message counts (same as S03)
const DRAFT_KEY = 'bns.s27.draft.v1';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** the three forms. key = tab key (short ASCII, also the shell footer's ?type=greshka), type = feedback.js type */
const FORMS = {
  greshka: {
    type: 'error',
    tab: 'Намерих грешка',
    intro:
      'Число, което не излиза, текст с грешка или връзка, която не работи. Кажи къде е и какво трябваше да се покаже.',
    label: 'Какво не е наред?',
    hint: 'Опиши какво виждаш на екрана и какво трябваше да е там. Не пиши лични данни.',
    tooShort: 'Напиши поне няколко думи, за да разберем какво не е наред.',
  },
  neyasno: {
    type: 'unclear',
    tab: 'Още не разбирам',
    intro:
      'Обяснение, което не помага, или дума, която остава неясна. Кажи какво искаш да разбереш.',
    label: 'Какво още не ти е ясно?',
    hint: 'Пиши със свои думи. Не пиши лични данни.',
    tooShort: 'Напиши поне няколко думи, за да разберем какво не е ясно.',
  },
  ideya: {
    type: 'idea',
    tab: 'Предложи идея',
    intro: 'Какво би направило сайта по-полезен? Опиши идеята накратко.',
    label: 'Каква е идеята?',
    hint: 'Какво липсва и как би помогнало? Не пиши лични данни.',
    tooShort: 'Напиши поне няколко думи за идеята.',
  },
};
const KEYS = Object.keys(FORMS);
/** every spelling a link may use for ?type= / ?tab= (reportLink says „error“, the shell footer says „greshka“) */
const ALIAS = {
  greshka: 'greshka',
  error: 'greshka',
  bug: 'greshka',
  neyasno: 'neyasno',
  unclear: 'neyasno',
  ideya: 'ideya',
  idea: 'ideya',
};

const TOPICS = [
  { value: 'chisla', label: 'Числата и данните' },
  { value: 'grafiki', label: 'Графиките и сравненията' },
  { value: 'obyasneniya', label: 'Обясненията и речникът' },
  { value: 'kalkulator', label: 'Калкулаторът за моите данъци' },
  { value: 'obshtini', label: 'Общини и проекти' },
  { value: 'telefon', label: 'Достъпност и телефон' },
  { value: 'drugo', label: 'Нещо друго' },
];
const topicLabel = (v) => TOPICS.find((t) => t.value === v)?.label || '';

/* ------------------------------------------------------------------ context from the link */

const clip = (v, n) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);

/** a screen key („prihodi“) or a path („prihodi/dds“, „razhodi/obrazovanie“) -> the key of the screen in the menu, or '' */
function screenKey(raw) {
  const s = String(raw || '')
    .replace(/^#?\/?/, '')
    .split('?')[0];
  if (!s) return '';
  let r = byKey[s] || match(s.split('/').filter(Boolean))?.route;
  while (r && !r.nav && r.parent) r = byId[r.parent];
  return r && r.nav ? r.key : '';
}

function readContext(ctx) {
  const q = ctx.query || {};
  const src = String(q.src || '');
  return {
    from: screenKey(q.from),
    val: clip(q.val, 120),
    src: Object.prototype.hasOwnProperty.call(ctx.core?.sources || {}, src) ? src : '',
    block: /^[\w.:-]{1,60}$/.test(String(q.block || '')) ? String(q.block) : '',
  };
}
const activeKey = (q) => ALIAS[q.tab] || ALIAS[q.type] || 'greshka';

/* ------------------------------------------------------------------ draft (unsent text, this tab only) */

function readDraft() {
  try {
    const d = JSON.parse(safe.get('sessionStorage', DRAFT_KEY) || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}
function writeDraft(key, values) {
  const d = readDraft();
  const has = Object.values(values).some((v) => v);
  if (has) d[key] = values;
  else delete d[key];
  if (Object.keys(d).length) safe.set('sessionStorage', DRAFT_KEY, JSON.stringify(d));
  else safe.del('sessionStorage', DRAFT_KEY);
}

/* ------------------------------------------------------------------ pieces */

const MENU = GROUPS.filter((g) => g.id !== 'util')
  .map((g) => ({ label: g.label, items: ROUTES.filter((r) => r.group === g.id && r.nav) }))
  .filter((g) => g.items.length);

function screenSelect(id, value, hintId) {
  return html`<span class="select"><select id="${id}" name="from" aria-describedby="${hintId} ${id}-err">
    <option value="">Не знам или не е за един екран</option>
    ${MENU.map((g) => html`<optgroup label="${g.label}">${g.items.map((r) => html`<option value="${r.key}"${r.key === value ? html` selected` : ''}>${r.title}</option>`)}</optgroup>`)}
  </select></span>`;
}

/** one labelled field with a persistent (empty) alert for its error, so the message is spoken when it is filled in */
function fld(o) {
  const hintId = o.hint ? `${o.id}-hint` : '';
  return html`<div class="field">
    <label class="field-label" for="${o.id}">${o.label}${o.optional ? html` <span class="s27-opt">(по желание)</span>` : html` <span class="s27-req" aria-hidden="true">задължително</span>`}</label>
    ${o.hint ? html`<p class="field-hint" id="${hintId}">${o.hint}</p>` : ''}
    ${o.control(hintId)}
    <p class="field-error" id="${o.id}-err" role="alert"></p>
  </div>`;
}

function textField(key, spec, value) {
  const id = `s27-${key}-text`;
  return html`${fld({
    id,
    label: spec.label,
    hint: spec.hint,
    control: (
      hid,
    ) => html`<textarea class="input s27-textarea" id="${id}" name="text" rows="5" maxlength="${feedback.MAX_TEXT}" required aria-describedby="${hid} ${id}-err">${value}</textarea>
      <span class="s27-count" data-s27-count aria-hidden="true">${[...value].length} / ${feedback.MAX_TEXT}</span>`,
  })}`;
}

function form(key, ctx, ctxInfo, draft) {
  const spec = FORMS[key];
  const d = draft[key] || {};
  const fromVal = key !== 'ideya' ? ctxInfo.from || d.from || '' : '';
  const body = [];
  body.push(textField(key, spec, d.text || ''));
  if (key === 'greshka') {
    body.push(html`${fld({ id: 's27-greshka-from', label: 'За кой екран?', optional: true, hint: ctxInfo.from ? 'Попълнихме го от мястото, откъдето дойде.' : 'Така по-лесно ще намерим мястото.', control: (hid) => screenSelect('s27-greshka-from', fromVal, hid) })}
      <input type="hidden" name="val" value="${ctxInfo.val}">`);
    if (ctxInfo.src)
      body.push(
        facts([{ k: 'Източник на числото', v: srcShort(ctxInfo.src) }], { cls: 's27-src' }),
      );
  } else if (key === 'neyasno') {
    body.push(
      fld({
        id: 's27-neyasno-from',
        label: 'За кой екран?',
        optional: true,
        hint: ctxInfo.from
          ? 'Попълнихме го от мястото, откъдето дойде.'
          : 'Така по-лесно ще видим къде е неясно.',
        control: (hid) => screenSelect('s27-neyasno-from', fromVal, hid),
      }),
    );
  } else {
    body.push(html`<div class="s27-pair">
      ${fld({
        id: 's27-ideya-topic',
        label: 'За коя част от сайта?',
        optional: true,
        hint: 'Избери най-близкото.',
        control: (
          hid,
        ) => html`<span class="select"><select id="s27-ideya-topic" name="topic" aria-describedby="${hid} s27-ideya-topic-err">
          <option value="">Не знам или е за целия сайт</option>
          ${TOPICS.map((t) => html`<option value="${t.value}"${t.value === d.topic ? html` selected` : ''}>${t.label}</option>`)}</select></span>`,
      })}
      ${fld({
        id: 's27-ideya-contact',
        label: 'Имейл за отговор',
        optional: true,
        hint: 'Само ако искаш да ти отговорим.',
        control: (hid) =>
          html`<input class="input" id="s27-ideya-contact" name="contact" type="email" inputmode="email" autocomplete="email" maxlength="254" value="${d.contact || ''}" aria-describedby="${hid} s27-ideya-contact-err">`,
      })}
    </div>`);
  }
  return html`<p class="s27-intro">${spec.intro}</p>
    <form class="s27-form" data-s27-form="${key}" novalidate>
      ${body}
      ${feedback.controls()}
      <div class="cluster"><button type="submit" class="btn btn-primary">${feedback.send()}</button></div>
    </form>
    <div class="s27-ok" data-s27-ok="${key}" hidden>
      <h3 class="s27-ok-h" tabindex="-1"></h3>
      <button type="button" class="btn" data-s27-again="${key}">Изпрати още едно</button>
    </div>`;
}

export function render(ctx) {
  const info = readContext(ctx);
  const draft = readDraft();
  return html`
    <section class="s27-main" aria-labelledby="s27-main-h">
      <h2 id="s27-main-h">Какво искаш да ни кажеш?</h2>
      ${tabs({
        id: 's27-tabs',
        label: 'Вид съобщение',
        query: 'tab',
        active: activeKey(ctx.query || {}),
        tabs: KEYS.map((k) => ({ key: k, label: FORMS[k].tab, body: form(k, ctx, info, draft) })),
      })}
    </section>
`;
}

/* ------------------------------------------------------------------ behaviour */

export function mount(root, ctx) {
  const off = [feedback.mountForms(root)];
  const on = (el, ev, fn, opt) => {
    el.addEventListener(ev, fn, opt);
    off.push(() => el.removeEventListener(ev, fn, opt));
  };
  const info = readContext(ctx);
  const pending = new Map(); // form -> debounce timer of its draft

  const values = (f) => ({
    text: f.elements.text.value,
    from: f.elements.from?.value || '',
    val: f.elements.val?.value || '',
    topic: f.elements.topic?.value || '',
    contact: f.elements.contact?.value || '',
  });
  const saveDraft = (f) => writeDraft(f.dataset.s27Form, values(f));
  const queueDraft = (f) => {
    clearTimeout(pending.get(f));
    pending.set(
      f,
      setTimeout(() => {
        pending.delete(f);
        saveDraft(f);
      }, 250),
    );
  };
  const dropDraft = (f) => {
    clearTimeout(pending.get(f));
    pending.delete(f);
    writeDraft(f.dataset.s27Form, {});
  };
  const flushDrafts = () => {
    for (const [f, t] of pending) {
      clearTimeout(t);
      saveDraft(f);
    }
    pending.clear();
  };

  function setError(control, message) {
    const err = root.querySelector(`#${control.id}-err`);
    if (err) err.textContent = message;
    if (message) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  }

  on(root, 'submit', async (e) => {
    const f = e.target.closest('form[data-s27-form]');
    if (!f) return;
    e.preventDefault();
    const key = f.dataset.s27Form,
      spec = FORMS[key];
    const v = values(f);
    const text = v.text.trim();
    const bad = [];
    setError(f.elements.text, '');
    if (text.length < MIN) {
      setError(f.elements.text, spec.tooShort);
      bad.push(f.elements.text);
    }
    if (f.elements.contact) {
      const c = v.contact.trim();
      const wrong = c && !EMAIL.test(c);
      setError(
        f.elements.contact,
        wrong ? 'Това не прилича на имейл адрес. Провери го или го остави празно.' : '',
      );
      if (wrong) bad.push(f.elements.contact);
    }
    if (bad.length) {
      bad
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        )[0]
        .focus();
      return;
    }
    const id = await feedback.submit(f, {
      type: spec.type,
      text: v.text,
      route: byKey[v.from]?.id || 'S27',
      value: v.val || topicLabel(v.topic),
      contact: v.contact.trim(),
      source: info.src,
      block: info.block,
    });
    if (!id) return;
    dropDraft(f);
    f.reset();
    f.querySelector('[data-s27-count]').textContent = `0 / ${feedback.MAX_TEXT}`;
    // reset() brings back the markup defaults: the draft is gone and the link's context stays for the next report
    if (key === 'greshka') {
      if (f.elements.from) f.elements.from.value = info.from;
      if (f.elements.val) f.elements.val.value = info.val;
    }
    if (key === 'neyasno' && f.elements.from) f.elements.from.value = info.from;
    const ok = root.querySelector(`[data-s27-ok="${key}"]`);
    ok.querySelector('.s27-ok-h').textContent = feedback.sent(id);
    f.hidden = true;
    ok.hidden = false;
    ok.querySelector('.s27-ok-h').focus();
    ctx.announce(feedback.sent(id));
  });

  on(root, 'input', (e) => {
    const c = e.target.closest?.('form[data-s27-form] :is(textarea, input, select)');
    if (!c) return;
    if (c.getAttribute('aria-invalid')) setError(c, '');
    if (c.matches('textarea'))
      c.parentElement.querySelector('[data-s27-count]').textContent =
        `${[...c.value].length} / ${feedback.MAX_TEXT}`;
    queueDraft(c.form);
  });
  on(root, 'change', (e) => {
    const c = e.target.closest?.('form[data-s27-form] select');
    if (c) saveDraft(c.form);
  });
  on(root, 'keydown', (e) => {
    if (
      e.key === 'Enter' &&
      (e.ctrlKey || e.metaKey) &&
      e.target.matches?.('form[data-s27-form] textarea')
    ) {
      e.preventDefault();
      e.target.form.requestSubmit();
    }
  });
  on(root, 'click', (e) => {
    const again = e.target.closest('[data-s27-again]');
    if (again) {
      const key = again.dataset.s27Again;
      const f = root.querySelector(`form[data-s27-form="${key}"]`);
      root.querySelector(`[data-s27-ok="${key}"]`).hidden = true;
      f.hidden = false;
      f.elements.text.focus();
      return;
    }
  });

  return () => {
    flushDrafts();
    off.forEach((f) => f());
  };
}
