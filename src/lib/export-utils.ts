/**
 * Utilitaires pour exports PDF et CSV
 */

export function formatCsvRow(fields: (string | number)[]): string {
  return fields.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(";");
}
