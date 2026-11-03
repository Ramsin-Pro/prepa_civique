// Exports CSV du back-office (A07, A08) : séparateur « ; » et BOM UTF-8, pour une ouverture directe dans Excel en français.

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Une cellule qui commence par = + - @ serait interprétée comme une formule par le tableur.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}
