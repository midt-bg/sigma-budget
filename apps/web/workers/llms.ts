import { mcpInstall } from '../client/mcp-install';

export function llms(origin: string): Response {
  const instructions = mcpInstall(origin)
    .map(
      (item) =>
        `### ${item.title}\n\n${item.note}\n\n\`\`\`\n${item.code}\n\`\`\`\n\n- [Официални инструкции](${item.docs})`,
    )
    .join('\n\n');
  return new Response(
    `# СИГМА Бюджет

> Държавният бюджет на България на разбираем език, с официални данни, източници и дати.

## MCP: свързване

Адрес: ${origin}/mcp
Транспорт: Streamable HTTP. Без удостоверяване, регистрация или API ключ. Име: sigma-budget.
Достъп само за четене. При отговор посочвай източника, периода, мерната единица и датата на данните.

${instructions}

## Отворени данни

- [Отворени данни и MCP](${origin}/api): файлове, схеми и примери.
- [Методология](${origin}/danni): каталог и източници.
- [Проверка на данните](${origin}/proverka): обхват и проверки.
- [Каталог на файловете](${origin}/data/catalog.json): налични набори и адреси.
- [Основни бюджетни данни](${origin}/data/core.json): обща бюджетна рамка.
- [Издания на данните](${origin}/api/releases): публичен API за изданията.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
