/**
 * Recursively trims leading/trailing whitespace from every string value.
 *
 * Recurses ONLY into arrays and plain objects (prototype === Object.prototype),
 * so class instances such as Firestore `Timestamp`, `FieldValue`, `GeoPoint`
 * and `Date` are returned untouched — never rebuilt nor trimmed. Non-string
 * primitives (number, boolean, null, undefined) are returned as-is.
 *
 * Applied at the Firestore write boundary so no user-entered value is ever
 * persisted with stray leading/trailing whitespace (e.g. "ALEKSANDAR ").
 */
/**
 * Removes ALL whitespace from a string — for values that must never contain a
 * space anywhere, such as a serial number (e.g. a barcode scan may inject
 * spaces in the middle). Unlike `String.trim()`, this also drops inner spaces.
 */
export function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, '');
}

/** True if the string contains any whitespace character (inner or edge). */
export function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

export function trimDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => trimDeep(item)) as T;
  }

  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const trimmed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      trimmed[key] = trimDeep(val);
    }
    return trimmed as T;
  }

  return value;
}
