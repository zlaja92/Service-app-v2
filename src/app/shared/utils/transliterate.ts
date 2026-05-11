const CYRILLIC_TO_LATIN: Record<string, string> = {
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Ђ': 'DJ', 'Е': 'E',
  'Ж': 'Z', 'З': 'Z', 'И': 'I', 'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'LJ',
  'М': 'M', 'Н': 'N', 'Њ': 'NJ', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S',
  'Т': 'T', 'Ћ': 'C', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'C',
  'Џ': 'DZ', 'Ш': 'S',
  'а': 'A', 'б': 'B', 'в': 'V', 'г': 'G', 'д': 'D', 'ђ': 'DJ', 'е': 'E',
  'ж': 'Z', 'з': 'Z', 'и': 'I', 'ј': 'J', 'к': 'K', 'л': 'L', 'љ': 'LJ',
  'м': 'M', 'н': 'N', 'њ': 'NJ', 'о': 'O', 'п': 'P', 'р': 'R', 'с': 'S',
  'т': 'T', 'ћ': 'C', 'у': 'U', 'ф': 'F', 'х': 'H', 'ц': 'C', 'ч': 'C',
  'џ': 'DZ', 'ш': 'S',
  'Č': 'C', 'č': 'C', 'Ć': 'C', 'ć': 'C', 'Đ': 'DJ', 'đ': 'DJ',
  'Š': 'S', 'š': 'S', 'Ž': 'Z', 'ž': 'Z',
};

/**
 * Transliterates Cyrillic and Serbian Latin diacritics to plain Latin uppercase.
 * Used to normalize names for storage in *Srch fields AND for search input,
 * so both sides use the same canonical form.
 *
 * Examples:
 *   "Marko"  → "MARKO"
 *   "Đorđe"  → "DJORDJE"
 *   "Стефан" → "STEFAN"
 *   "šarko"  → "SARKO"
 */
export function toLatinUpperCase(value: string): string {
  return value
    .split('')
    .map(ch => CYRILLIC_TO_LATIN[ch] ?? ch.toUpperCase())
    .join('');
}
