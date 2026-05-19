export function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

export function extractName(address: string): string {
  const match = address.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return address.split('@')[0];
}

export function extractEmail(address: string): string {
  const match = address.match(/<([^>]+)>/);
  if (match) return match[1];
  return address.trim();
}
