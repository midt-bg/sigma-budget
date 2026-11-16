// Editorial copy for the live site. The pinned release and downloadable files retain their original text.
export const catalogueDescription =
  'Набори за сваляне с източник, период, формат и дата на данните. Методика, ограничения и указания за цитиране на числата.';

export const datasetDescriptions = {
  'feed-rss':
    'Емисия за четци на новини със събитията от „Новото в данните“: публикации, промени и връзки към източниците.',
  measures2027:
    'Текстове на данъчните, осигурителните и разходните мерки от АСБП 2027–2029, с откъси от мотивите и препратки към източника.',
  schema:
    'Структура и типове на полетата в публикуваните JSON файлове за проверка на формата и обработка на данните с код.',
};

const definitions = {
  'balansiran-byudzhet':
    'Бюджет, при който приходите и разходите са равни и бюджетното салдо е нула. Това не означава, че няма натрупан дълг.',
  'byudzheten-transfer':
    'Прехвърляне на средства от един бюджет към друг, например от държавния бюджет към общински бюджет за финансиране на дейности.',
};

export const termWithDefinition = (term) =>
  definitions[term.slug] ? { ...term, def: definitions[term.slug] } : term;
