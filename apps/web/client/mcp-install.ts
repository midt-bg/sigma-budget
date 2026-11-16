/** Shared by the open-data screen and /llms.txt. No credentials or local proxy needed. */
export function mcpInstall(origin: string) {
  const url = origin.replace(/\/+$/, '') + '/mcp';
  return [
    {
      id: 'claude-code',
      title: 'Claude Code',
      note: 'Изпълни в терминала. Провери връзката с /mcp в Claude Code.',
      code: `claude mcp add --transport http sigma-budget ${url}`,
      docs: 'https://code.claude.com/docs/en/mcp',
    },
    {
      id: 'claude',
      title: 'Claude Desktop и claude.ai',
      note: 'В Customize → Connectors избери Add → Add custom connector. Име: sigma-budget. Постави адреса и избери No sign in. Наличността зависи от плана и правилата на организацията.',
      code: url,
      docs: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    },
    {
      id: 'chatgpt',
      title: 'ChatGPT',
      note: 'В ChatGPT Plugins избери + → Add custom MCP server. Име: sigma-budget. В Connection постави Server URL и избери No authentication. Създай и инсталирай личния plugin. Достъпът зависи от акаунта и правилата на организацията.',
      code: url,
      docs: 'https://developers.openai.com/api/docs/guides/custom-mcp-server',
    },
    {
      id: 'codex',
      title: 'Codex CLI',
      note: 'Добави в ~/.codex/config.toml. Ако вече има други сървъри, запази ги.',
      code: `[mcp_servers.sigma-budget]\nurl = "${url}"`,
      docs: 'https://developers.openai.com/codex/mcp',
    },
    {
      id: 'cursor',
      title: 'Cursor',
      note: 'Добави в .cursor/mcp.json за проекта или ~/.cursor/mcp.json за всички проекти. Ако файлът съществува, добави само записа sigma-budget в mcpServers.',
      code: JSON.stringify({ mcpServers: { 'sigma-budget': { url } } }, null, 2),
      docs: 'https://cursor.com/docs/mcp',
    },
    {
      id: 'vscode',
      title: 'VS Code (GitHub Copilot)',
      note: 'Добави в .mcp.json в корена на проекта. При съществуващ файл добави само записа sigma-budget в mcpServers. Следвай заявката на редактора за доверие към сървъра.',
      code: JSON.stringify(
        { mcpServers: { 'sigma-budget': { type: 'http', url, tools: ['*'] } } },
        null,
        2,
      ),
      docs: 'https://code.visualstudio.com/docs/agents/reference/mcp-configuration',
    },
    {
      id: 'gemini',
      title: 'Gemini CLI',
      note: 'Изпълни в терминала. Провери връзката с gemini mcp list.',
      code: `gemini mcp add --transport http sigma-budget ${url}`,
      docs: 'https://geminicli.com/docs/tools/mcp-server/',
    },
  ];
}
