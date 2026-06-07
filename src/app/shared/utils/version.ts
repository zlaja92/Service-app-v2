/**
 * Compares two dotted numeric version strings (e.g. "2.0.4" vs "2.1.0").
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Missing/short segments count as 0,
 * non-numeric segments as 0, so it is tolerant of partial inputs like "2.1".
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i], 10) || 0;
    const nb = parseInt(pb[i], 10) || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
