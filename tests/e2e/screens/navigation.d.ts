declare module '*/client/chrome.js' {
  export const NAV_GROUPS: [string, string[]][];
}
declare module '*/client/routes.js' {
  export function match(parts: string[]): { route: { id: string } } | null;
}
