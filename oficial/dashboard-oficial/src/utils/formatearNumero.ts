/**
 * Formatea un número entero al estilo latinoamericano (BO):
 *   1234567 → "1.234.567"
 */
export function formatearNumero(n: number): string {
  return new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 0,
  }).format(n);
}
