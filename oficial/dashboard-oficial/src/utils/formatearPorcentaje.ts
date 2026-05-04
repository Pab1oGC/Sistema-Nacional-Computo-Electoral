/**
 * Formatea un número como porcentaje al estilo latinoamericano (BO):
 *   38.21 → "38,2%"
 *    1.5  → "1,5%"
 *   100   → "100%"
 *
 * Acepta un valor numérico ya en escala 0..100 (no fracción 0..1).
 */
export function formatearPorcentaje(n: number): string {
  const formatted = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n);
  return `${formatted}%`;
}
