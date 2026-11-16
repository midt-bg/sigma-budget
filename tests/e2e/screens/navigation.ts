/** The current menu link has a visible CSS chevron before its catalogue label. */
export function menuLinkName(label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^(?:›\\s*)?${escaped}$`);
}
